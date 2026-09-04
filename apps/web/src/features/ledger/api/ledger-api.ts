import type {
  LedgerAccount,
  LedgerBook,
  LedgerCategory,
  LedgerClassificationRule,
  LedgerCommonCode,
  LedgerInstallmentInput,
  LedgerDashboardData,
  LedgerMonthSummary,
  LedgerStatementProfile,
  LedgerTransaction,
  LedgerTransactionInput,
} from '@home/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;

const asString = (value: unknown) => String(value ?? '');
const ensure = (error: { message?: string } | null) => {
  if (error) throw new Error('가계부 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
};

const mapBook = (row: Row): LedgerBook => ({
  id: asString(row.id),
  householdId: asString(row.household_id),
  ownerUserId: asString(row.owner_user_id),
  visibility: row.visibility as LedgerBook['visibility'],
  name: asString(row.name),
  currency: 'KRW',
  isActive: Boolean(row.is_active),
  createdAt: asString(row.created_at),
  updatedAt: asString(row.updated_at),
});
const mapAccount = (row: Row): LedgerAccount => ({
  id: asString(row.id),
  bookId: asString(row.book_id),
  householdId: asString(row.household_id),
  ownerUserId: asString(row.owner_user_id),
  type: row.type as LedgerAccount['type'],
  name: asString(row.name),
  openingBalance: asString(row.opening_balance),
  sortOrder: Number(row.sort_order),
  isActive: Boolean(row.is_active),
  createdAt: asString(row.created_at),
  updatedAt: asString(row.updated_at),
});
const mapCategory = (row: Row): LedgerCategory => ({
  id: asString(row.id),
  bookId: asString(row.book_id),
  householdId: asString(row.household_id),
  type: row.type as LedgerCategory['type'],
  name: asString(row.name),
  icon: asString(row.icon),
  color: asString(row.color),
  sortOrder: Number(row.sort_order),
  isDefault: Boolean(row.is_default),
  isActive: Boolean(row.is_active),
  createdBy: asString(row.created_by),
  createdAt: asString(row.created_at),
  updatedAt: asString(row.updated_at),
});
const mapClassificationRule = (row: Row): LedgerClassificationRule => ({
  id: asString(row.id),
  householdId: asString(row.household_id),
  bookId: asString(row.book_id),
  transactionType: row.transaction_type as LedgerClassificationRule['transactionType'],
  targetField: row.target_field as LedgerClassificationRule['targetField'],
  matchType: row.match_type as LedgerClassificationRule['matchType'],
  keyword: asString(row.keyword),
  categoryId: asString(row.category_id),
  priority: Number(row.priority),
  isActive: Boolean(row.is_active),
  createdBy: asString(row.created_by),
  createdAt: asString(row.created_at),
  updatedAt: asString(row.updated_at),
});
const mapStatementProfile = (row: Row): LedgerStatementProfile => ({
  id: asString(row.id),
  householdId: asString(row.household_id),
  bookId: asString(row.book_id),
  name: asString(row.name),
  headerSignature: asString(row.header_signature),
  mapping: (row.mapping ?? {}) as Record<string, number>,
  encoding: row.encoding as LedgerStatementProfile['encoding'],
  sheetName: asString(row.sheet_name),
  isActive: Boolean(row.is_active),
  createdBy: asString(row.created_by),
  createdAt: asString(row.created_at),
  updatedAt: asString(row.updated_at),
});
const mapTransaction = (row: Row): LedgerTransaction => ({
  id: asString(row.id),
  bookId: asString(row.book_id),
  householdId: asString(row.household_id),
  type: row.type as LedgerTransaction['type'],
  amount: asString(row.amount),
  occurredAt: asString(row.occurred_at),
  accountId: asString(row.account_id),
  transferAccountId: row.transfer_account_id ? asString(row.transfer_account_id) : null,
  categoryId: row.category_id ? asString(row.category_id) : null,
  merchant: asString(row.merchant),
  memo: asString(row.memo),
  payerUserId: asString(row.payer_user_id),
  createdBy: asString(row.created_by),
  updatedBy: asString(row.updated_by),
  source: row.source as LedgerTransaction['source'],
  clientRequestId: asString(row.client_request_id),
  installmentGroupId: row.installment_group_id ? asString(row.installment_group_id) : null,
  installmentNumber: row.installment_number == null ? null : Number(row.installment_number),
  installmentCount: row.installment_count == null ? null : Number(row.installment_count),
  installmentOriginalTotal:
    row.installment_original_total == null ? null : asString(row.installment_original_total),
  createdAt: asString(row.created_at),
  updatedAt: asString(row.updated_at),
});

export function createLedgerApi(client: SupabaseClient) {
  return {
    async listBooks(householdId: string) {
      const { data, error } = await client
        .from('ledger_books')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('visibility');
      ensure(error);
      return ((data ?? []) as Row[]).map(mapBook);
    },
    async getDashboard(bookId: string, from: string, to: string) {
      const { data, error } = await client.rpc('get_ledger_dashboard', {
        p_book_id: bookId,
        p_from: from,
        p_to: to,
      });
      ensure(error);
      return data as LedgerDashboardData;
    },
    async createDefaultBook(
      householdId: string,
      visibility: LedgerBook['visibility'],
      name: string,
    ) {
      const { data, error } = await client.rpc('create_default_ledger_book', {
        p_household_id: householdId,
        p_visibility: visibility,
        p_name: name.trim(),
      });
      ensure(error);
      return asString(data);
    },
    async listAccounts(bookId: string) {
      const { data, error } = await client
        .from('ledger_accounts')
        .select('*')
        .eq('book_id', bookId)
        .eq('is_active', true)
        .order('sort_order');
      ensure(error);
      return ((data ?? []) as Row[]).map(mapAccount);
    },
    async createAccount(
      bookId: string,
      householdId: string,
      ownerUserId: string,
      name: string,
      type: LedgerAccount['type'],
    ) {
      const { data, error } = await client
        .from('ledger_accounts')
        .insert({
          book_id: bookId,
          household_id: householdId,
          owner_user_id: ownerUserId,
          name: name.trim(),
          type,
        })
        .select('*')
        .single();
      ensure(error);
      return mapAccount(data as Row);
    },
    async listPaymentMethodCodes(householdId: string, includeInactive = false) {
      let query = client
        .from('common_codes')
        .select('*')
        .eq('household_id', householdId)
        .eq('group_key', 'payment_method_type')
        .order('sort_order');
      if (!includeInactive) query = query.eq('is_active', true);
      const { data, error } = await query;
      ensure(error);
      return ((data ?? []) as Row[]).map((row): LedgerCommonCode => ({
        id: asString(row.id),
        householdId: asString(row.household_id),
        groupKey: asString(row.group_key),
        groupLabel: asString(row.group_label),
        code: asString(row.code),
        label: asString(row.label),
        sortOrder: Number(row.sort_order),
        isSystem: Boolean(row.is_system),
        isAdminEditable: Boolean(row.is_admin_editable),
        isActive: Boolean(row.is_active),
      }));
    },
    async createPaymentMethodCode(
      householdId: string,
      code: string,
      label: string,
      sortOrder: number,
      userId: string,
    ) {
      const { error } = await client.from('common_codes').insert({
        household_id: householdId,
        group_key: 'payment_method_type',
        group_label: '결제수단 유형',
        code,
        label: label.trim(),
        sort_order: sortOrder,
        is_system: false,
        is_admin_editable: true,
        created_by: userId,
      });
      ensure(error);
    },
    async updatePaymentMethodCode(id: string, label: string, isActive: boolean, sortOrder: number) {
      const { error } = await client
        .from('common_codes')
        .update({ label: label.trim(), is_active: isActive, sort_order: sortOrder })
        .eq('id', id);
      ensure(error);
    },
    async listCategories(bookId: string) {
      const { data, error } = await client
        .from('ledger_categories')
        .select('*')
        .eq('book_id', bookId)
        .eq('is_active', true)
        .order('sort_order');
      ensure(error);
      return ((data ?? []) as Row[]).map(mapCategory);
    },
    async listClassificationRules(bookId: string) {
      const { data, error } = await client
        .from('ledger_classification_rules')
        .select('*')
        .eq('book_id', bookId)
        .order('priority')
        .order('created_at');
      ensure(error);
      return ((data ?? []) as Row[]).map(mapClassificationRule);
    },
    async createClassificationRule(
      bookId: string,
      householdId: string,
      input: Pick<
        LedgerClassificationRule,
        'transactionType' | 'targetField' | 'matchType' | 'keyword' | 'categoryId' | 'priority'
      >,
    ) {
      const { data, error } = await client
        .from('ledger_classification_rules')
        .insert({
          book_id: bookId,
          household_id: householdId,
          transaction_type: input.transactionType,
          target_field: input.targetField,
          match_type: input.matchType,
          keyword: input.keyword.trim(),
          category_id: input.categoryId,
          priority: input.priority,
        })
        .select('*')
        .single();
      ensure(error);
      return mapClassificationRule(data as Row);
    },
    async updateClassificationRule(id: string, priority: number, isActive: boolean) {
      const { error } = await client
        .from('ledger_classification_rules')
        .update({ priority, is_active: isActive })
        .eq('id', id);
      ensure(error);
    },
    async deleteClassificationRule(id: string) {
      const { error } = await client.from('ledger_classification_rules').delete().eq('id', id);
      ensure(error);
    },
    async listStatementProfiles(bookId: string) {
      const { data, error } = await client
        .from('ledger_statement_profiles')
        .select('*')
        .eq('book_id', bookId)
        .eq('is_active', true)
        .order('name');
      ensure(error);
      return ((data ?? []) as Row[]).map(mapStatementProfile);
    },
    async createStatementProfile(
      bookId: string,
      householdId: string,
      input: Pick<
        LedgerStatementProfile,
        'name' | 'headerSignature' | 'mapping' | 'encoding' | 'sheetName'
      >,
    ) {
      const { data, error } = await client
        .from('ledger_statement_profiles')
        .insert({
          book_id: bookId,
          household_id: householdId,
          name: input.name.trim(),
          header_signature: input.headerSignature,
          mapping: input.mapping,
          encoding: input.encoding,
          sheet_name: input.sheetName,
        })
        .select('*')
        .single();
      ensure(error);
      return mapStatementProfile(data as Row);
    },
    async deleteStatementProfile(id: string) {
      const { error } = await client.from('ledger_statement_profiles').delete().eq('id', id);
      ensure(error);
    },
    async createCategory(
      bookId: string,
      householdId: string,
      type: LedgerCategory['type'],
      name: string,
      userId: string,
    ) {
      const { data, error } = await client
        .from('ledger_categories')
        .insert({
          book_id: bookId,
          household_id: householdId,
          type,
          name: name.trim(),
          created_by: userId,
        })
        .select('*')
        .single();
      ensure(error);
      return mapCategory(data as Row);
    },
    async listTransactions(bookId: string, start: string, end: string) {
      const { data, error } = await client
        .from('ledger_transactions')
        .select('*')
        .eq('book_id', bookId)
        .is('deleted_at', null)
        .gte('occurred_at', start)
        .lt('occurred_at', end)
        .order('occurred_at', { ascending: false });
      ensure(error);
      return ((data ?? []) as Row[]).map(mapTransaction);
    },
    async getMonthSummary(bookId: string, month: string) {
      const { data, error } = await client.rpc('get_ledger_month_summary', {
        p_book_id: bookId,
        p_month: `${month}-01`,
      });
      ensure(error);
      const row = ((data ?? [])[0] ?? {}) as Row;
      return {
        incomeTotal: asString(row.income_total || '0'),
        expenseTotal: asString(row.expense_total || '0'),
        netTotal: asString(row.net_total || '0'),
      } satisfies LedgerMonthSummary;
    },
    async getAccountBalances(bookId: string) {
      const { data, error } = await client.rpc('get_ledger_account_balances', {
        p_book_id: bookId,
      });
      ensure(error);
      return Object.fromEntries(
        ((data ?? []) as Row[]).map((row) => [asString(row.account_id), asString(row.balance)]),
      );
    },
    async createTransaction(input: LedgerTransactionInput, userId: string) {
      const { data, error } = await client
        .from('ledger_transactions')
        .insert({
          book_id: input.bookId,
          household_id: input.householdId,
          type: input.type,
          amount: input.amount,
          occurred_at: input.occurredAt,
          account_id: input.accountId,
          transfer_account_id: input.transferAccountId,
          category_id: input.categoryId,
          merchant: input.merchant.trim(),
          memo: input.memo,
          payer_user_id: input.payerUserId,
          created_by: userId,
          updated_by: userId,
          client_request_id: input.clientRequestId,
        })
        .select('*')
        .single();
      ensure(error);
      return mapTransaction(data as Row);
    },
    async updateTransaction(id: string, input: LedgerTransactionInput, userId: string) {
      const { data, error } = await client
        .from('ledger_transactions')
        .update({
          type: input.type,
          amount: input.amount,
          occurred_at: input.occurredAt,
          account_id: input.accountId,
          transfer_account_id: input.transferAccountId,
          category_id: input.categoryId,
          merchant: input.merchant.trim(),
          memo: input.memo,
          payer_user_id: input.payerUserId,
          updated_by: userId,
        })
        .eq('id', id)
        .select('*')
        .single();
      ensure(error);
      return mapTransaction(data as Row);
    },
    async createInstallment(input: LedgerInstallmentInput) {
      const { data, error } = await client.rpc('create_ledger_installment', {
        p_book_id: input.bookId,
        p_total: input.total,
        p_installment_count: input.installmentCount,
        p_occurred_on: input.occurredOn,
        p_account_id: input.accountId,
        p_category_id: input.categoryId,
        p_merchant: input.merchant.trim(),
        p_memo: input.memo,
        p_payer_user_id: input.payerUserId,
      });
      ensure(error);
      return asString(data);
    },
    async softDeleteTransaction(id: string) {
      const { error } = await client.rpc('soft_delete_ledger_transaction', {
        p_transaction_id: id,
      });
      ensure(error);
    },
    async commitImport(
      bookId: string,
      accountId: string,
      fileName: string,
      fileFingerprint: string,
      rows: unknown[],
    ) {
      const { data, error } = await client.rpc('commit_ledger_import', {
        p_book_id: bookId,
        p_account_id: accountId,
        p_display_filename: fileName,
        p_file_fingerprint: fileFingerprint,
        p_rows: rows,
      });
      ensure(error);
      return Number(((data ?? [])[0] as Row | undefined)?.committed_rows ?? 0);
    },
    async findImportDuplicates(bookId: string, accountId: string, rows: unknown[]) {
      const { data, error } = await client.rpc('find_ledger_import_duplicates', {
        p_book_id: bookId,
        p_account_id: accountId,
        p_rows: rows,
      });
      ensure(error);
      return ((data ?? []) as Row[]).map((row) => Number(row.source_row_number));
    },
  };
}
