import type { Goal } from '@home/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FeedbackDialog, type Feedback } from '../../components/FeedbackDialog';
import { useAccess, useAuth } from '../auth/auth';
import { createGoalsApi } from './api/goals-api';
import { GoalsPage } from './GoalsPage';

export function GoalsContainer() {
  const { client, user } = useAuth();
  const { access } = useAccess();
  const active = access?.kind === 'active' ? access : null;
  const api = useMemo(() => createGoalsApi(client), [client]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const load = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      setGoals(await api.list(active.householdId));
    } catch (reason) {
      setFeedback({
        type: 'error',
        message: reason instanceof Error ? reason.message : '목표를 불러오지 못했습니다.',
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
      <GoalsPage
        goals={goals}
        loading={loading}
        currentUserId={user.id}
        householdId={active.householdId}
        role={active.role}
        onCreate={(input) => run(() => api.create(input), '목표를 추가했습니다.')}
        onUpdate={(id, input) => run(() => api.update(id, input), '목표를 수정했습니다.')}
        onDelete={(id) => run(() => api.remove(id), '목표를 삭제했습니다.')}
        onFeedback={(type, message) => setFeedback({ type, message })}
      />
      <FeedbackDialog feedback={feedback} onClose={() => setFeedback(null)} />
    </>
  );
}
