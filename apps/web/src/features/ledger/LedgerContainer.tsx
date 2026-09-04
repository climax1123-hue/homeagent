import {
  ledgerMonthRangeUtc,
  type LedgerAccount,
  type LedgerBook,
  type LedgerCategory,
  type LedgerClassificationRule,
  type LedgerCommonCode,
  type LedgerInstallmentInput,
  type LedgerMonthSummary,
  type LedgerStatementProfile,
  type LedgerTransaction,
  type LedgerTransactionInput,
} from '@home/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccess, useAuth } from '../auth/auth';
import { FeedbackDialog, type Feedback } from '../../components/FeedbackDialog';
import { createHouseholdApi } from '../household/api/household-api';
import { createLedgerApi } from './api/ledger-api';
import { LedgerPage } from './LedgerPage';

const EMPTY_SUMMARY: LedgerMonthSummary = { incomeTotal: '0', expenseTotal: '0', netTotal: '0' };

export function LedgerContainer() {
  const { client, user } = useAuth();
  const { access } = useAccess();
  const active = access?.kind === 'active' ? access : null;
  const api = useMemo(() => createLedgerApi(client), [client]);
  const householdApi = useMemo(() => createHouseholdApi(client), [client]);
  const [month, setMonth] = useState(() =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
    }).format(new Date()),
  );
  const [books, setBooks] = useState<LedgerBook[]>([]);
  const [bookId, setBookId] = useState('');
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [categories, setCategories] = useState<LedgerCategory[]>([]);
  const [paymentCodes, setPaymentCodes] = useState<LedgerCommonCode[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [classificationRules, setClassificationRules] = useState<LedgerClassificationRule[]>([]);
  const [statementProfiles, setStatementProfiles] = useState<LedgerStatementProfile[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadBooks = useCallback(async () => {
    if (!active) return [];
    const next = await api.listBooks(active.householdId);
    setBooks(next);
    setBookId((current) =>
      next.some((book) => book.id === current) ? current : (next[0]?.id ?? ''),
    );
    return next;
  }, [active, api]);

  useEffect(() => {
    if (!active) return;
    void (async () => {
      setLoading(true);
      try {
        const [nextMembers, , nextCodes] = await Promise.all([
          householdApi.listMembers(active.householdId),
          loadBooks(),
          api.listPaymentMethodCodes(active.householdId, active.role === 'admin'),
        ]);
        setMembers(
          nextMembers
            .filter((member) => member.status === 'active')
            .map((member) => ({ id: member.userId, name: member.displayName })),
        );
        setPaymentCodes(nextCodes);
      } catch (reason) {
        setFeedback({
          type: 'error',
          message: reason instanceof Error ? reason.message : '가계부를 불러오지 못했습니다.',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [active, api, householdApi, loadBooks]);

  const loadLedger = useCallback(async () => {
    if (!bookId) {
      setAccounts([]);
      setCategories([]);
      setTransactions([]);
      setClassificationRules([]);
      setStatementProfiles([]);
      setSummary(EMPTY_SUMMARY);
      return;
    }
    setLoading(true);
    try {
      const range = ledgerMonthRangeUtc(month);
      const [
        nextAccounts,
        nextCategories,
        nextTransactions,
        nextSummary,
        nextBalances,
        nextRules,
        nextProfiles,
      ] = await Promise.all([
        api.listAccounts(bookId),
        api.listCategories(bookId),
        api.listTransactions(bookId, range.start, range.end),
        api.getMonthSummary(bookId, month),
        api.getAccountBalances(bookId),
        api.listClassificationRules(bookId).catch(() => []),
        api.listStatementProfiles(bookId).catch(() => []),
      ]);
      setAccounts(nextAccounts);
      setCategories(nextCategories);
      setTransactions(nextTransactions);
      setSummary(nextSummary);
      setBalances(nextBalances);
      setClassificationRules(nextRules);
      setStatementProfiles(nextProfiles);
    } catch (reason) {
      setFeedback({
        type: 'error',
        message: reason instanceof Error ? reason.message : '가계부를 불러오지 못했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [api, bookId, month]);
  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);
  if (!active || !user) return null;

  const currentBook = books.find((book) => book.id === bookId) ?? null;
  const run = async (action: () => Promise<unknown>, successMessage: string) => {
    try {
      await action();
      await loadLedger();
      setFeedback({ type: 'success', message: successMessage });
    } catch (reason) {
      setFeedback({
        type: 'error',
        message: reason instanceof Error ? reason.message : '요청을 처리하지 못했습니다.',
      });
      throw reason;
    }
  };
  const canManageConfiguration = Boolean(
    currentBook &&
    (currentBook.visibility === 'private'
      ? currentBook.ownerUserId === user.id
      : active.role === 'admin'),
  );
  return (
    <>
      <LedgerPage
        accounts={accounts}
        balances={balances}
        books={books}
        categories={categories}
        classificationRules={classificationRules}
        statementProfiles={statementProfiles}
        canManageConfiguration={canManageConfiguration}
        currentBook={currentBook}
        currentUserId={user.id}
        householdId={active.householdId}
        loading={loading}
        members={members}
        month={month}
        paymentCodes={paymentCodes}
        role={active.role}
        summary={summary}
        transactions={transactions}
        onBookChange={setBookId}
        onMonthChange={setMonth}
        onCreateBook={async (visibility, name) => {
          try {
            const createdId = await api.createDefaultBook(active.householdId, visibility, name);
            await loadBooks();
            setBookId(createdId);
            setFeedback({ type: 'success', message: '새 가계부를 만들었습니다.' });
          } catch (reason) {
            setFeedback({
              type: 'error',
              message: reason instanceof Error ? reason.message : '가계부를 만들지 못했습니다.',
            });
            throw reason;
          }
        }}
        onCreateAccount={(name, type) =>
          run(
            () => api.createAccount(bookId, active.householdId, user.id, name, type),
            '결제수단을 추가했습니다.',
          )
        }
        onCreateCategory={(type, name) =>
          run(
            () => api.createCategory(bookId, active.householdId, type, name, user.id),
            '카테고리를 추가했습니다.',
          )
        }
        onCreateTransaction={(input: LedgerTransactionInput) =>
          run(() => api.createTransaction(input, user.id), '거래를 정상적으로 추가했습니다.')
        }
        onCreateInstallment={(input: LedgerInstallmentInput) =>
          run(() => api.createInstallment(input), '할부 거래를 정상적으로 추가했습니다.')
        }
        onUpdateTransaction={(id, input) =>
          run(() => api.updateTransaction(id, input, user.id), '거래를 정상적으로 수정했습니다.')
        }
        onCommitImport={async (accountId, fileName, fileFingerprint, rows) => {
          const count = await api.commitImport(bookId, accountId, fileName, fileFingerprint, rows);
          await loadLedger();
          return count;
        }}
        onFindImportDuplicates={(accountId, rows) =>
          api.findImportDuplicates(bookId, accountId, rows)
        }
        onCreateClassificationRule={(input) =>
          run(
            () => api.createClassificationRule(bookId, active.householdId, input),
            '분류 규칙을 추가했습니다.',
          )
        }
        onUpdateClassificationRule={(id, priority, isActive) =>
          run(
            () => api.updateClassificationRule(id, priority, isActive),
            '분류 규칙을 수정했습니다.',
          )
        }
        onDeleteClassificationRule={(id) =>
          run(() => api.deleteClassificationRule(id), '분류 규칙을 삭제했습니다.')
        }
        onCreateStatementProfile={(input) =>
          run(
            () => api.createStatementProfile(bookId, active.householdId, input),
            '명세서 양식을 저장했습니다.',
          )
        }
        onDeleteStatementProfile={(id) =>
          run(() => api.deleteStatementProfile(id), '명세서 양식을 삭제했습니다.')
        }
        onDeleteTransaction={(id) =>
          run(() => api.softDeleteTransaction(id), '거래를 정상적으로 삭제했습니다.')
        }
        onFeedback={(type, message) => setFeedback({ type, message })}
      />
      <FeedbackDialog feedback={feedback} onClose={() => setFeedback(null)} />
    </>
  );
}
