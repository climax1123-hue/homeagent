import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  detectMapping,
  normalizeMatrix,
  parseCsv,
  parseStatementFile,
  reviseStatementRow,
  statementHeaderSignature,
} from './index';

describe('statement parser', () => {
  it('parses quoted csv and detects Korean columns', () => {
    const rows = parseCsv('거래일,적요,출금액,입금액\n2026-08-01,"마트, 본점","12,000",\n');
    expect(rows[1][1]).toBe('마트, 본점');
    expect(detectMapping(rows[0])).toMatchObject({
      occurredOn: 0,
      merchant: 1,
      expense: 2,
      income: 3,
    });
  });
  it('normalizes income and expense without floating point', async () => {
    const matrix = [
      ['날짜', '내용', '출금', '입금'],
      ['2026.08.01', '마트', '12,000', ''],
      ['20260802', '급여', '', '3000000'],
    ];
    const rows = await normalizeMatrix(matrix, detectMapping(matrix[0]));
    expect(rows.map((row) => [row.type, row.amount, row.included])).toEqual([
      ['expense', '12000', true],
      ['income', '3000000', true],
    ]);
    expect(rows[0].fingerprint).toHaveLength(64);
  });
  it('marks invalid rows instead of importing them', async () => {
    const matrix = [
      ['날짜', '금액'],
      ['잘못된 날짜', '0'],
    ];
    const [row] = await normalizeMatrix(matrix, detectMapping(matrix[0]));
    expect(row.included).toBe(false);
    expect(row.errors).toEqual(expect.arrayContaining(['DATE_INVALID', 'AMOUNT_INVALID']));
  });
  it('rejects unsupported files', async () => {
    await expect(parseStatementFile(new ArrayBuffer(1), 'statement.pdf')).rejects.toThrow(
      'FILE_TYPE_UNSUPPORTED',
    );
  });
  it('rejects a renamed non-XLSX file by signature', async () => {
    await expect(
      parseStatementFile(new TextEncoder().encode('not a workbook').buffer, 'statement.xlsx'),
    ).rejects.toThrow('FILE_SIGNATURE_INVALID');
  });
  it('reads a selected XLSX sheet', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['날짜', '금액'],
        ['2026-08-01', '100'],
      ]),
      '첫째',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['거래일', '출금'],
        ['2026-08-02', '2500'],
      ]),
      '둘째',
    );
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const result = await parseStatementFile(bytes, 'synthetic.xlsx', { sheetName: '둘째' });
    expect(result.selectedSheet).toBe('둘째');
    expect(result.rows[0]).toMatchObject({ type: 'expense', amount: '2500' });
  });
  it('revalidates a manually edited row', async () => {
    const [row] = await normalizeMatrix(
      [
        ['날짜', '금액'],
        ['2026-08-01', '100'],
      ],
      { occurredOn: 0, amount: 1 },
    );
    const revised = await reviseStatementRow(row, { occurredOn: 'invalid', amount: '0' });
    expect(revised.errors).toEqual(['DATE_INVALID', 'AMOUNT_INVALID']);
    expect(revised.included).toBe(false);
  });
  it('creates a stable normalized header signature', async () => {
    expect(await statementHeaderSignature([' 거래일 ', '출금_액'])).toBe(
      await statementHeaderSignature(['거래일', '출금액']),
    );
  });
});
