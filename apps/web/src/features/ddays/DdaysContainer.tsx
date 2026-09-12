import type { Dday } from '@home/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FeedbackDialog, type Feedback } from '../../components/FeedbackDialog';
import { useAccess, useAuth } from '../auth/auth';
import { createDdaysApi } from './api/ddays-api';
import { DdaysPage } from './DdaysPage';
export function DdaysContainer() {
  const { client, user } = useAuth(),
    { access } = useAccess(),
    active = access?.kind === 'active' ? access : null,
    api = useMemo(() => createDdaysApi(client), [client]);
  const [ddays, setDdays] = useState<Dday[]>([]),
    [loading, setLoading] = useState(true),
    [feedback, setFeedback] = useState<Feedback | null>(null);
  const load = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      setDdays(await api.list(active.householdId));
    } catch (reason) {
      setFeedback({
        type: 'error',
        message: reason instanceof Error ? reason.message : '디데이를 불러오지 못했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [active, api]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!active || !user) return null;
  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      await load();
      setFeedback({ type: 'success', message });
    } catch (reason) {
      setFeedback({
        type: 'error',
        message: reason instanceof Error ? reason.message : '요청을 처리하지 못했습니다.',
      });
      throw reason;
    }
  };
  return (
    <>
      <DdaysPage
        ddays={ddays}
        loading={loading}
        currentUserId={user.id}
        householdId={active.householdId}
        role={active.role}
        onCreate={(i) => run(() => api.create(i), '디데이를 추가했습니다.')}
        onUpdate={(id, i) => run(() => api.update(id, i), '디데이를 수정했습니다.')}
        onDelete={(id) => run(() => api.remove(id), '디데이를 삭제했습니다.')}
        onFeedback={(type, message) => setFeedback({ type, message })}
      />
      <FeedbackDialog feedback={feedback} onClose={() => setFeedback(null)} />
    </>
  );
}
