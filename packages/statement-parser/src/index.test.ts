import { describe, expect, it } from 'vitest';
import type { NormalizedStatementRow } from './index';

describe('NormalizedStatementRow', () => {
  it('represents money in minor units', () => {
    const row: NormalizedStatementRow = {
      occurredOn: '2026-08-24',
      amountMinor: 84500n,
      direction: 'expense',
      merchant: '테스트 마트',
    };

    expect(row.amountMinor).toBe(84500n);
  });
});
