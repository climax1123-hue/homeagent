import {
  ledgerDashboardRange,
  type LedgerBook,
  type LedgerDashboardData,
  type LedgerDashboardRangePreset,
} from '@home/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccess, useAuth } from '../../auth/auth';
import { createLedgerApi } from '../api/ledger-api';
import { LedgerDashboardPage } from './LedgerDashboardPage';

export function LedgerDashboardContainer() {
  const { client } = useAuth();
  const { access } = useAccess();
  const active = access?.kind === 'active' ? access : null;
  const api = useMemo(() => createLedgerApi(client), [client]);
  const initial = useMemo(() => ledgerDashboardRange('6m'), []);
  const [books, setBooks] = useState<LedgerBook[]>([]);
  const [bookId, setBookId] = useState('');
  const [preset, setPreset] = useState<LedgerDashboardRangePreset>('6m');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<LedgerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) return;
    void api
      .listBooks(active.householdId)
      .then((next) => {
        setBooks(next);
        setBookId(next[0]?.id ?? '');
      })
      .catch(() => setError('장부 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [active, api]);

  const load = useCallback(async () => {
    if (!bookId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setData(await api.getDashboard(bookId, from, to));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '대시보드를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [api, bookId, from, to]);
  useEffect(() => {
    void load();
  }, [load]);

  const applyPreset = (value: LedgerDashboardRangePreset) => {
    const range = ledgerDashboardRange(value);
    setPreset(value);
    setFrom(range.from);
    setTo(range.to);
  };
  if (!active) return null;
  return (
    <LedgerDashboardPage
      books={books}
      bookId={bookId}
      data={data}
      error={error}
      from={from}
      loading={loading}
      preset={preset}
      to={to}
      onBookChange={setBookId}
      onPresetChange={applyPreset}
      onFromChange={(value) => {
        setPreset('custom');
        setFrom(value);
      }}
      onToChange={(value) => {
        setPreset('custom');
        setTo(value);
      }}
    />
  );
}
