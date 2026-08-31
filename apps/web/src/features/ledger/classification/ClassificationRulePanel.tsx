import type {
  LedgerCategory,
  LedgerClassificationMatchType,
  LedgerClassificationRule,
  LedgerClassificationTargetField,
} from '@home/shared';
import { useState, type FormEvent } from 'react';

type Props = {
  rules: LedgerClassificationRule[];
  categories: LedgerCategory[];
  onClose(): void;
  onCreate(
    input: Pick<
      LedgerClassificationRule,
      'transactionType' | 'targetField' | 'matchType' | 'keyword' | 'categoryId' | 'priority'
    >,
  ): Promise<unknown>;
  onUpdate(id: string, priority: number, isActive: boolean): Promise<unknown>;
  onDelete(id: string): Promise<unknown>;
};

export function ClassificationRulePanel({
  rules,
  categories,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense'),
    [targetField, setTargetField] = useState<LedgerClassificationTargetField>('merchant'),
    [matchType, setMatchType] = useState<LedgerClassificationMatchType>('contains'),
    [keyword, setKeyword] = useState(''),
    [categoryId, setCategoryId] = useState(''),
    [priority, setPriority] = useState(100),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const available = categories.filter(
    (category) => category.type === transactionType && category.isActive,
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const selectedCategory = categoryId || available[0]?.id;
    if (!selectedCategory) return;
    setBusy(true);
    setError('');
    try {
      await onCreate({
        transactionType,
        targetField,
        matchType,
        keyword,
        categoryId: selectedCategory,
        priority,
      });
      setKeyword('');
      setCategoryId('');
    } catch {
      setError('규칙을 추가하지 못했습니다. 같은 키워드 규칙이 있는지 확인해 주세요.');
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
      <section className="ledger-form classification-rules">
        <div className="ledger-form-head">
          <div>
            <h2>분류 규칙 관리</h2>
            <p className="ledger-help">거래처와 메모에서 키워드를 찾아 카테고리를 추천합니다.</p>
          </div>
          <button className="icon-button" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>
        {error && (
          <p className="ledger-error" role="alert">
            {error}
          </p>
        )}
        <form className="classification-rule-form" onSubmit={(event) => void submit(event)}>
          <label>
            거래 유형
            <select
              value={transactionType}
              onChange={(event) => {
                setTransactionType(event.target.value as 'income' | 'expense');
                setCategoryId('');
              }}
            >
              <option value="expense">지출</option>
              <option value="income">수입</option>
            </select>
          </label>
          <label>
            검색 대상
            <select
              value={targetField}
              onChange={(event) =>
                setTargetField(event.target.value as LedgerClassificationTargetField)
              }
            >
              <option value="merchant">거래처</option>
              <option value="memo">메모</option>
              <option value="both">거래처와 메모</option>
            </select>
          </label>
          <label>
            비교 방식
            <select
              value={matchType}
              onChange={(event) =>
                setMatchType(event.target.value as LedgerClassificationMatchType)
              }
            >
              <option value="contains">포함</option>
              <option value="exact">정확히 일치</option>
            </select>
          </label>
          <label>
            키워드
            <input
              required
              minLength={2}
              maxLength={100}
              placeholder="예: 스타벅스"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
          <label>
            추천 카테고리
            <select
              required
              value={categoryId || available[0]?.id || ''}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {available.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            우선순위
            <input
              type="number"
              min={0}
              max={9999}
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value))}
            />
          </label>
          <button className="primary" disabled={busy || !available.length}>
            규칙 추가
          </button>
        </form>
        <div className="classification-rule-list">
          {!rules.length ? (
            <p className="ledger-state">등록된 규칙이 없습니다.</p>
          ) : (
            rules.map((rule) => (
              <article key={rule.id}>
                <div>
                  <strong>{rule.keyword}</strong>
                  <span>
                    {rule.transactionType === 'expense' ? '지출' : '수입'} ·{' '}
                    {rule.targetField === 'merchant'
                      ? '거래처'
                      : rule.targetField === 'memo'
                        ? '메모'
                        : '거래처·메모'}{' '}
                    · {rule.matchType === 'contains' ? '포함' : '정확히 일치'} →{' '}
                    {categories.find((category) => category.id === rule.categoryId)?.name ??
                      '카테고리 없음'}
                  </span>
                </div>
                <label>
                  우선순위
                  <input
                    aria-label={`${rule.keyword} 우선순위`}
                    type="number"
                    min={0}
                    max={9999}
                    value={rule.priority}
                    onChange={(event) =>
                      void onUpdate(rule.id, Number(event.target.value), rule.isActive)
                    }
                  />
                </label>
                <button onClick={() => void onUpdate(rule.id, rule.priority, !rule.isActive)}>
                  {rule.isActive ? '비활성화' : '활성화'}
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    if (window.confirm(`'${rule.keyword}' 규칙을 삭제할까요?`))
                      void onDelete(rule.id);
                  }}
                >
                  삭제
                </button>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
