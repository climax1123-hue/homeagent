import {
  classifyLedgerStatement,
  type LedgerAccount,
  type LedgerCategory,
  type LedgerClassificationRule,
  type LedgerStatementProfile,
} from '@home/shared';
import {
  normalizeMatrix,
  parseStatementFile,
  reviseStatementRow,
  statementHeaderSignature,
  type StatementColumnMapping,
  type StatementDraftRow,
  type StatementPreview,
} from '@home/statement-parser';
import { useState, type ChangeEvent } from 'react';
import './statement-import.css';

type ProfileInput = Pick<
  LedgerStatementProfile,
  'name' | 'headerSignature' | 'mapping' | 'encoding' | 'sheetName'
>;
type Props = {
  accounts: LedgerAccount[];
  categories: LedgerCategory[];
  rules: LedgerClassificationRule[];
  profiles: LedgerStatementProfile[];
  canManageProfiles: boolean;
  onClose(): void;
  onCommit(
    accountId: string,
    fileName: string,
    fingerprint: string,
    rows: unknown[],
  ): Promise<number>;
  onFindDuplicates(accountId: string, rows: unknown[]): Promise<number[]>;
  onCreateProfile(input: ProfileInput): Promise<unknown>;
  onDeleteProfile(id: string): Promise<unknown>;
};
type SourceFile = { buffer: ArrayBuffer; name: string };
const fieldLabels: Record<keyof StatementColumnMapping, string> = {
  occurredOn: '거래일',
  merchant: '거래처',
  memo: '메모',
  amount: '단일 금액',
  expense: '출금액',
  income: '입금액',
};
const errorLabels: Record<string, string> = {
  HEADER_NOT_FOUND: '필수 열을 찾지 못했습니다.',
  DATE_INVALID: '날짜 오류',
  AMOUNT_INVALID: '금액 오류',
  DIRECTION_AMBIGUOUS: '수입·지출 구분 오류',
  FILE_TOO_LARGE: '파일은 10MB 이하여야 합니다.',
  ROW_LIMIT_EXCEEDED: '최대 10,000행까지 처리할 수 있습니다.',
  FILE_TYPE_UNSUPPORTED: 'CSV 또는 XLSX 파일만 선택해 주세요.',
  FILE_SIGNATURE_INVALID: '파일 확장자와 실제 형식이 일치하지 않습니다.',
};

export function StatementImportPanel({
  accounts,
  categories,
  rules,
  profiles,
  canManageProfiles,
  onClose,
  onCommit,
  onFindDuplicates,
  onCreateProfile,
  onDeleteProfile,
}: Props) {
  const [preview, setPreview] = useState<StatementPreview | null>(null),
    [source, setSource] = useState<SourceFile | null>(null),
    [accountId, setAccountId] = useState(accounts[0]?.id ?? ''),
    [defaultCategoryId, setDefaultCategoryId] = useState(''),
    [profileName, setProfileName] = useState(''),
    [appliedProfile, setAppliedProfile] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');

  const classifyRow = (row: StatementDraftRow) => {
    if (row.classificationReason === '직접 선택') return row;
    const suggestion = classifyLedgerStatement(row, rules);
    return {
      ...row,
      categoryId: suggestion?.categoryId ?? null,
      classificationRuleId: suggestion?.ruleId,
      classificationReason: suggestion?.reason,
    };
  };
  const markDuplicates = async (next: StatementPreview, nextAccountId = accountId) => {
    if (!nextAccountId) return next;
    const candidates = next.rows.filter((row) => !row.errors.length),
      duplicateRows = new Set(await onFindDuplicates(nextAccountId, candidates));
    return {
      ...next,
      rows: next.rows.map((row) =>
        duplicateRows.has(row.sourceRowNumber)
          ? { ...row, duplicateCandidate: true, included: false }
          : { ...row, duplicateCandidate: false },
      ),
    };
  };
  const preparePreview = async (parsed: StatementPreview) => {
    const signature = await statementHeaderSignature(parsed.headers),
      profile = profiles.find((item) => item.isActive && item.headerSignature === signature);
    let next = parsed;
    if (profile) {
      const rows = await normalizeMatrix(
        parsed.matrix,
        profile.mapping as Partial<StatementColumnMapping>,
      );
      next = { ...parsed, mapping: profile.mapping as Partial<StatementColumnMapping>, rows };
      setAppliedProfile(profile.name);
    } else setAppliedProfile('');
    next = { ...next, rows: next.rows.map(classifyRow) };
    return markDuplicates(next);
  };
  const parseSource = async (
    nextSource: SourceFile,
    options?: { encoding?: 'utf-8' | 'euc-kr'; sheetName?: string },
  ) => {
    setBusy(true);
    setError('');
    try {
      const parsed = await parseStatementFile(nextSource.buffer, nextSource.name, options);
      setPreview(await preparePreview(parsed));
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : '';
      setError(errorLabels[code] ?? '파일을 읽지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };
  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const next = { buffer: await file.arrayBuffer(), name: file.name.replace(/^.*[\\/]/, '') };
    setSource(next);
    setMessage('');
    await parseSource(next);
  };
  const reparse = async (options: { encoding?: 'utf-8' | 'euc-kr'; sheetName?: string }) => {
    if (source) await parseSource(source, options);
  };
  const applySavedProfile = async (id: string) => {
    const profile = profiles.find((item) => item.id === id);
    if (!source || !profile) return;
    setBusy(true);
    setError('');
    try {
      const parsed = await parseStatementFile(source.buffer, source.name, {
          encoding: profile.encoding === 'xlsx' ? undefined : profile.encoding,
          sheetName: profile.sheetName || undefined,
        }),
        rows = await normalizeMatrix(
          parsed.matrix,
          profile.mapping as Partial<StatementColumnMapping>,
        );
      setAppliedProfile(profile.name);
      setPreview(
        await markDuplicates({
          ...parsed,
          mapping: profile.mapping as Partial<StatementColumnMapping>,
          rows: rows.map(classifyRow),
        }),
      );
    } catch {
      setError('저장된 양식을 적용하지 못했습니다. 열 매핑을 직접 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };
  const remap = async (field: keyof StatementColumnMapping, value: string) => {
    if (!preview) return;
    const mapping = { ...preview.mapping };
    if (value === '') delete mapping[field];
    else mapping[field] = Number(value);
    const rows = await normalizeMatrix(preview.matrix, mapping);
    setAppliedProfile('');
    setPreview(await markDuplicates({ ...preview, mapping, rows: rows.map(classifyRow) }));
  };
  const revise = async (
    index: number,
    patch: Partial<Pick<StatementDraftRow, 'occurredOn' | 'type' | 'amount' | 'merchant' | 'memo'>>,
  ) => {
    if (!preview) return;
    let changed = await reviseStatementRow(preview.rows[index], patch);
    changed = classifyRow(changed);
    const duplicates =
      accountId && !changed.errors.length ? await onFindDuplicates(accountId, [changed]) : [];
    changed.duplicateCandidate = duplicates.includes(changed.sourceRowNumber);
    if (changed.duplicateCandidate) changed.included = false;
    setPreview({
      ...preview,
      rows: preview.rows.map((row, rowIndex) => (rowIndex === index ? changed : row)),
    });
  };
  const changeRowCategory = (index: number, value: string) =>
    setPreview((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row, rowIndex) =>
              rowIndex === index
                ? {
                    ...row,
                    categoryId: value || null,
                    classificationRuleId: undefined,
                    classificationReason: value ? '직접 선택' : undefined,
                  }
                : row,
            ),
          }
        : current,
    );
  const changeAccount = async (value: string) => {
    setAccountId(value);
    if (preview) setPreview(await markDuplicates(preview, value));
  };
  const saveProfile = async () => {
    if (!preview || !profileName.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onCreateProfile({
        name: profileName.trim(),
        headerSignature: await statementHeaderSignature(preview.headers),
        mapping: preview.mapping as Record<string, number>,
        encoding: preview.encoding,
        sheetName: preview.selectedSheet,
      });
      setAppliedProfile(profileName.trim());
      setProfileName('');
      setMessage('현재 은행 양식을 저장했습니다. 다음 파일부터 자동으로 적용합니다.');
    } catch {
      setError('양식을 저장하지 못했습니다. 같은 헤더의 양식이 이미 있는지 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };
  const commit = async () => {
    if (!preview || !accountId || !source) return;
    const fallback = categories.find((category) => category.id === defaultCategoryId);
    const rows = preview.rows
      .filter((row) => row.included && !row.errors.length)
      .map((row) => ({
        ...row,
        categoryId: row.categoryId || (fallback?.type === row.type ? fallback.id : null),
      }));
    if (!rows.length) {
      setError('반영할 정상 행을 선택해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const count = await onCommit(accountId, source.name, preview.fileFingerprint, rows);
      setMessage(`${count}건을 가계부에 반영했습니다.`);
      setPreview(null);
      setSource(null);
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : '';
      setError(
        code.includes('FILE_ALREADY_IMPORTED')
          ? '이미 반영한 파일입니다.'
          : code.includes('IMPORT_ACCESS_DENIED')
            ? '이 장부에 명세를 반영할 권한이 없습니다.'
            : '명세를 반영하지 못했습니다.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="ledger-modal"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className="ledger-form statement-import">
        <div className="ledger-form-head">
          <h2>은행·카드 명세 가져오기</h2>
          <button className="icon-button" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="ledger-help">
          CSV/XLSX는 브라우저에서만 읽고 원본 파일은 서버에 저장하지 않습니다.
        </p>
        <label className="statement-file">
          파일 선택
          <input type="file" accept=".csv,.xlsx" onChange={(event) => void load(event)} />
        </label>
        {busy && <p role="status">처리 중…</p>}
        {error && (
          <p className="ledger-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="statement-success" role="status">
            {message}
          </p>
        )}
        {source && profiles.length > 0 && (
          <label>
            저장된 은행 양식
            <select
              aria-label="저장된 은행 양식"
              value=""
              onChange={(event) => void applySavedProfile(event.target.value)}
            >
              <option value="">필요한 경우 선택</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {preview && source && (
          <>
            <div className="statement-summary">
              <b>{source.name}</b>
              <span>
                전체 {preview.rows.length}건 · 추천{' '}
                {preview.rows.filter((row) => row.classificationRuleId).length}건 · 중복 후보{' '}
                {preview.rows.filter((row) => row.duplicateCandidate).length}건 · 오류{' '}
                {preview.rows.filter((row) => row.errors.length).length}건
              </span>
            </div>
            {appliedProfile && (
              <p className="statement-profile-applied">
                저장된 양식 ‘{appliedProfile}’을 적용했습니다.
              </p>
            )}
            <div className="statement-options">
              {preview.encoding !== 'xlsx' && (
                <label>
                  문자 인코딩
                  <select
                    value={preview.encoding}
                    onChange={(event) =>
                      void reparse({ encoding: event.target.value as 'utf-8' | 'euc-kr' })
                    }
                  >
                    <option value="utf-8">UTF-8</option>
                    <option value="euc-kr">CP949/EUC-KR</option>
                  </select>
                </label>
              )}
              {preview.sheetNames.length > 1 && (
                <label>
                  엑셀 시트
                  <select
                    value={preview.selectedSheet}
                    onChange={(event) => void reparse({ sheetName: event.target.value })}
                  >
                    {preview.sheetNames.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
              )}
              {canManageProfiles && (
                <div className="statement-profile-save">
                  <label>
                    현재 양식 이름
                    <input
                      placeholder="예: 국민은행 거래내역"
                      maxLength={60}
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!profileName.trim()}
                    onClick={() => void saveProfile()}
                  >
                    현재 열 매핑 저장
                  </button>
                </div>
              )}
            </div>
            {canManageProfiles && profiles.length > 0 && (
              <div className="statement-profile-list">
                {profiles.map((profile) => (
                  <span key={profile.id}>
                    {profile.name}
                    <button
                      aria-label={`${profile.name} 양식 삭제`}
                      onClick={() => {
                        if (window.confirm(`'${profile.name}' 양식을 삭제할까요?`))
                          void onDeleteProfile(profile.id);
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="statement-mapping">
              {(Object.keys(fieldLabels) as Array<keyof StatementColumnMapping>).map((field) => (
                <label key={field}>
                  {fieldLabels[field]}
                  <select
                    value={preview.mapping[field] ?? ''}
                    onChange={(event) => void remap(field, event.target.value)}
                  >
                    <option value="">사용 안 함</option>
                    {preview.headers.map((header, index) => (
                      <option key={`${field}-${index}`} value={index}>
                        {header || `열 ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="statement-target">
              <label>
                결제수단
                <select
                  required
                  value={accountId}
                  onChange={(event) => void changeAccount(event.target.value)}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                추천 없는 행의 기본 카테고리
                <select
                  value={defaultCategoryId}
                  onChange={(event) => setDefaultCategoryId(event.target.value)}
                >
                  <option value="">미분류</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.type === 'expense' ? '지출' : '수입'} · {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="statement-table">
              <table>
                <thead>
                  <tr>
                    <th>포함</th>
                    <th>행</th>
                    <th>일자</th>
                    <th>구분</th>
                    <th>금액</th>
                    <th>거래처</th>
                    <th>메모</th>
                    <th>카테고리</th>
                    <th>상태·추천 이유</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 1000).map((row, index) => (
                    <tr
                      key={row.sourceRowNumber}
                      className={`${row.errors.length ? 'invalid ' : ''}${row.duplicateCandidate ? 'duplicate' : ''}`}
                    >
                      <td data-label="포함">
                        <input
                          aria-label={`${row.sourceRowNumber}행 포함`}
                          type="checkbox"
                          checked={row.included}
                          disabled={!!row.errors.length}
                          onChange={(event) =>
                            setPreview((current) =>
                              current
                                ? {
                                    ...current,
                                    rows: current.rows.map((item, rowIndex) =>
                                      rowIndex === index
                                        ? { ...item, included: event.target.checked }
                                        : item,
                                    ),
                                  }
                                : current,
                            )
                          }
                        />
                      </td>
                      <td data-label="원본 행">{row.sourceRowNumber}</td>
                      <td data-label="일자">
                        <input
                          aria-label={`${row.sourceRowNumber}행 일자`}
                          type="date"
                          value={row.occurredOn}
                          onChange={(event) =>
                            void revise(index, { occurredOn: event.target.value })
                          }
                        />
                      </td>
                      <td data-label="구분">
                        <select
                          aria-label={`${row.sourceRowNumber}행 구분`}
                          value={row.type}
                          onChange={(event) =>
                            void revise(index, {
                              type: event.target.value as StatementDraftRow['type'],
                            })
                          }
                        >
                          <option value="expense">지출</option>
                          <option value="income">수입</option>
                        </select>
                      </td>
                      <td data-label="금액">
                        <input
                          aria-label={`${row.sourceRowNumber}행 금액`}
                          inputMode="numeric"
                          value={row.amount}
                          onChange={(event) => void revise(index, { amount: event.target.value })}
                        />
                      </td>
                      <td data-label="거래처">
                        <input
                          aria-label={`${row.sourceRowNumber}행 거래처`}
                          value={row.merchant}
                          onChange={(event) => void revise(index, { merchant: event.target.value })}
                        />
                      </td>
                      <td data-label="메모">
                        <input
                          aria-label={`${row.sourceRowNumber}행 메모`}
                          value={row.memo}
                          onChange={(event) => void revise(index, { memo: event.target.value })}
                        />
                      </td>
                      <td data-label="카테고리">
                        <select
                          aria-label={`${row.sourceRowNumber}행 카테고리`}
                          value={row.categoryId ?? ''}
                          onChange={(event) => changeRowCategory(index, event.target.value)}
                        >
                          <option value="">미분류</option>
                          {categories
                            .filter((category) => category.type === row.type)
                            .map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td data-label="상태·추천">
                        {row.errors.length
                          ? row.errors.map((code) => errorLabels[code] ?? code).join(', ')
                          : row.duplicateCandidate
                            ? '중복 후보 · 필요하면 포함 선택'
                            : (row.classificationReason ?? '정상')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="primary submit"
              disabled={busy || !accountId}
              onClick={() => void commit()}
            >
              선택 거래 반영
            </button>
          </>
        )}
      </section>
    </div>
  );
}
