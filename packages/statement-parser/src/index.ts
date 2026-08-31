export type StatementDirection = 'income' | 'expense';
export type StatementColumnMapping = {
  occurredOn: number;
  merchant?: number;
  memo?: number;
  amount?: number;
  expense?: number;
  income?: number;
};
export type StatementParseErrorCode =
  'HEADER_NOT_FOUND' | 'DATE_INVALID' | 'AMOUNT_INVALID' | 'DIRECTION_AMBIGUOUS';
export type StatementDraftRow = {
  sourceRowNumber: number;
  occurredOn: string;
  type: StatementDirection;
  amount: string;
  merchant: string;
  memo: string;
  fingerprint: string;
  included: boolean;
  duplicateCandidate?: boolean;
  categoryId?: string | null;
  classificationRuleId?: string;
  classificationReason?: string;
  errors: StatementParseErrorCode[];
};
export type StatementPreview = {
  headers: string[];
  matrix: string[][];
  mapping: Partial<StatementColumnMapping>;
  rows: StatementDraftRow[];
  fileFingerprint: string;
  encoding: 'utf-8' | 'euc-kr' | 'xlsx';
  sheetNames: string[];
  selectedSheet: string;
};
export type NormalizedStatementRow = {
  occurredOn: string;
  amountMinor: bigint;
  direction: StatementDirection;
  merchant: string;
  memo?: string;
};

const aliases: Record<keyof StatementColumnMapping, string[]> = {
  occurredOn: ['거래일', '이용일', '승인일', '날짜', 'date'],
  merchant: ['적요', '내용', '가맹점', '사용처', '거래처', 'merchant'],
  memo: ['메모', '비고', '거래내용', 'memo'],
  amount: ['금액', '거래금액', 'amount'],
  expense: ['출금액', '이용금액', '사용금액', '출금', 'debit'],
  income: ['입금액', '입금', 'credit'],
};
const clean = (value: unknown) =>
  Array.from(String(value ?? ''), (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
const headerKey = (value: string) =>
  clean(value)
    .toLowerCase()
    .replaceAll('/', '')
    .replace(/[\s_()[\].-]/g, '');
export function detectMapping(headers: string[]): Partial<StatementColumnMapping> {
  const result: Partial<StatementColumnMapping> = {};
  headers.forEach((header, index) => {
    const key = headerKey(header);
    (Object.keys(aliases) as Array<keyof StatementColumnMapping>).forEach((field) => {
      if (result[field] === undefined && aliases[field].some((alias) => key === headerKey(alias)))
        result[field] = index;
    });
  });
  return result;
}
function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = ([',', '\t', ';'] as const).map((delimiter) => ({
    delimiter,
    count: firstLine.split(delimiter).length - 1,
  }));
  return counts.sort((a, b) => b.count - a.count)[0]?.delimiter ?? ',';
}
export function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text),
    rows: string[][] = [],
    row: string[] = [],
    pushRow = () => {
      if (row.some((cell) => cell.trim())) rows.push(row.splice(0));
    };
  let cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(clean(cell));
      cell = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(clean(cell));
      cell = '';
      pushRow();
    } else cell += char;
  }
  row.push(clean(cell));
  pushRow();
  return rows;
}
function decodeCsv(buffer: ArrayBuffer, preferred?: 'utf-8' | 'euc-kr') {
  const utf = new TextDecoder('utf-8', { fatal: false }).decode(buffer).replace(/^\uFEFF/, '');
  if (preferred === 'utf-8' || (!preferred && (utf.match(/�/g)?.length ?? 0) < 2))
    return { text: utf, encoding: 'utf-8' as const };
  return { text: new TextDecoder('euc-kr').decode(buffer), encoding: 'euc-kr' as const };
}
function dateValue(value: string): string | null {
  const v = clean(value);
  if (/^[3-8][0-9]{4}(?:\.0+)?$/.test(v)) {
    const serial = Math.trunc(Number(v));
    return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
  }
  const match = v.match(/^(\d{4})[./-]?(\d{1,2})[./-]?(\d{1,2})/);
  if (!match) return null;
  const result = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  const d = new Date(`${result}T00:00:00Z`);
  return Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== result ? null : result;
}
function moneyValue(value: string): bigint | null {
  const normalized = clean(value)
    .replace(/[₩원,\s]/g, '')
    .replace(/^\((.*)\)$/, '-$1');
  if (!/^[+-]?\d+$/.test(normalized)) return null;
  try {
    return BigInt(normalized);
  } catch {
    return null;
  }
}
async function sha256(value: string | ArrayBuffer) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function statementHeaderSignature(headers: readonly string[]) {
  return sha256(headers.map((header) => headerKey(header)).join('|'));
}
export async function reviseStatementRow(
  row: StatementDraftRow,
  patch: Partial<Pick<StatementDraftRow, 'occurredOn' | 'type' | 'amount' | 'merchant' | 'memo'>>,
): Promise<StatementDraftRow> {
  const next = { ...row, ...patch },
    errors: StatementParseErrorCode[] = [];
  const occurredOn = dateValue(next.occurredOn);
  if (!occurredOn) errors.push('DATE_INVALID');
  const amount = moneyValue(next.amount);
  if (amount === null || amount <= 0n) errors.push('AMOUNT_INVALID');
  const merchant = clean(next.merchant),
    memo = clean(next.memo),
    basis = `${occurredOn ?? ''}|${next.type}|${amount?.toString() ?? ''}|${merchant.toLowerCase()}|${memo.toLowerCase()}`;
  return {
    ...next,
    occurredOn: occurredOn ?? next.occurredOn,
    amount: amount?.toString() ?? next.amount,
    merchant,
    memo,
    fingerprint: await sha256(basis),
    included: errors.length === 0 && next.included,
    duplicateCandidate: false,
    errors,
  };
}
export async function normalizeMatrix(
  matrix: string[][],
  mapping: Partial<StatementColumnMapping>,
): Promise<StatementDraftRow[]> {
  if (mapping.occurredOn === undefined) return [];
  const result: StatementDraftRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const source = matrix[i],
      errors: StatementParseErrorCode[] = [];
    const occurredOn = dateValue(source[mapping.occurredOn] ?? '');
    if (!occurredOn) errors.push('DATE_INVALID');
    let type: StatementDirection | undefined,
      amount: bigint | null = null;
    if (mapping.expense !== undefined || mapping.income !== undefined) {
      const expense =
          mapping.expense === undefined ? 0n : (moneyValue(source[mapping.expense] ?? '') ?? 0n),
        income =
          mapping.income === undefined ? 0n : (moneyValue(source[mapping.income] ?? '') ?? 0n);
      if (expense !== 0n && income === 0n) {
        type = 'expense';
        amount = expense < 0n ? -expense : expense;
      } else if (income !== 0n && expense === 0n) {
        type = 'income';
        amount = income < 0n ? -income : income;
      } else errors.push('DIRECTION_AMBIGUOUS');
    } else if (mapping.amount !== undefined) {
      const signed = moneyValue(source[mapping.amount] ?? '');
      if (signed === null || signed === 0n) errors.push('AMOUNT_INVALID');
      else {
        type = signed < 0n ? 'expense' : 'income';
        amount = signed < 0n ? -signed : signed;
      }
    } else errors.push('AMOUNT_INVALID');
    if (amount === null || amount <= 0n) {
      if (!errors.includes('AMOUNT_INVALID') && !errors.includes('DIRECTION_AMBIGUOUS'))
        errors.push('AMOUNT_INVALID');
    }
    const merchant = mapping.merchant === undefined ? '' : clean(source[mapping.merchant]),
      memo = mapping.memo === undefined ? '' : clean(source[mapping.memo]);
    const basis = `${occurredOn ?? ''}|${type ?? ''}|${amount?.toString() ?? ''}|${merchant.toLowerCase()}|${memo.toLowerCase()}`;
    result.push({
      sourceRowNumber: i + 1,
      occurredOn: occurredOn ?? '',
      type: type ?? 'expense',
      amount: amount?.toString() ?? '',
      merchant,
      memo,
      fingerprint: await sha256(basis),
      included: errors.length === 0,
      errors,
    });
  }
  return result;
}
export async function parseStatementFile(
  buffer: ArrayBuffer,
  fileName: string,
  options?: { encoding?: 'utf-8' | 'euc-kr'; sheetName?: string },
): Promise<StatementPreview> {
  if (buffer.byteLength > 10 * 1024 * 1024) throw new Error('FILE_TOO_LARGE');
  const ext = fileName.toLowerCase().split('.').pop(),
    signature = new Uint8Array(buffer.slice(0, 4)),
    isZip = signature[0] === 0x50 && signature[1] === 0x4b;
  if (ext === 'xlsx' && !isZip) throw new Error('FILE_SIGNATURE_INVALID');
  if (ext === 'csv' && isZip) throw new Error('FILE_SIGNATURE_INVALID');
  let matrix: string[][] = [],
    encoding: StatementPreview['encoding'] = 'utf-8',
    sheetNames: string[] = [],
    selectedSheet = '';
  if (ext === 'csv') {
    const decoded = decodeCsv(buffer, options?.encoding);
    encoding = decoded.encoding;
    matrix = parseCsv(decoded.text);
  } else if (ext === 'xlsx') {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
    });
    sheetNames = workbook.SheetNames;
    selectedSheet =
      options?.sheetName && sheetNames.includes(options.sheetName)
        ? options.sheetName
        : (sheetNames[0] ?? '');
    if (!selectedSheet) throw new Error('HEADER_NOT_FOUND');
    matrix = XLSX.utils
      .sheet_to_json<string[]>(workbook.Sheets[selectedSheet], {
        header: 1,
        raw: false,
        defval: '',
      })
      .map((row) => row.map(clean));
    encoding = 'xlsx';
  } else throw new Error('FILE_TYPE_UNSUPPORTED');
  if (matrix.length < 2 || matrix.length > 10001)
    throw new Error(matrix.length > 10001 ? 'ROW_LIMIT_EXCEEDED' : 'HEADER_NOT_FOUND');
  const headers = matrix[0].map(clean),
    mapping = detectMapping(headers),
    rows = await normalizeMatrix(matrix, mapping);
  return {
    headers,
    matrix,
    mapping,
    rows,
    fileFingerprint: await sha256(buffer),
    encoding,
    sheetNames,
    selectedSheet,
  };
}
