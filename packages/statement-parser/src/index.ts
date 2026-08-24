export type NormalizedStatementRow = {
  occurredOn: string;
  amountMinor: bigint;
  direction: 'income' | 'expense';
  merchant: string;
  memo?: string;
};
