import { useCallback, useEffect, useState } from 'react';
import { FeedbackDialog, type Feedback } from '../../components/FeedbackDialog';
import { useAccess, useAuth } from '../auth/auth';
import './operations.css';

type ErrorLog = {
  id: string;
  feature: string;
  route: string;
  user_message: string;
  created_at: string;
  resolved_at: string | null;
};

const featureLabel = (feature: string) =>
  ({ calendar: '일정', ledger: '가계부', goals: '목표', ddays: '디데이', app: '홈' })[feature] ?? feature;

export function ErrorLogsPage() {
  const { client, user } = useAuth();
  const { access } = useAccess();
  const householdId = access?.kind === 'active' ? access.householdId : null;
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const load = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    const { data, error } = await client
      .from('app_error_logs')
      .select('id, feature, route, user_message, created_at, resolved_at')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(100);
    setLoading(false);
    if (error) {
      setFeedback({ type: 'error', message: '오류 기록을 불러오지 못했습니다.' });
      return;
    }
    setLogs((data ?? []) as ErrorLog[]);
  }, [client, householdId]);

  useEffect(() => void load(), [load]);

  const toggleResolved = async (log: ErrorLog) => {
    const resolved = Boolean(log.resolved_at);
    const { error } = await client
      .from('app_error_logs')
      .update({ resolved_at: resolved ? null : new Date().toISOString(), resolved_by: resolved ? null : user?.id })
      .eq('id', log.id);
    if (error) {
      setFeedback({ type: 'error', message: '오류 상태를 변경하지 못했습니다.' });
      return;
    }
    await load();
  };

  return (
    <section className="operations-page">
      <header>
        <div><p>관리자 도구</p><h2>오류 기록</h2></div>
        <button onClick={() => void load()}>새로고침</button>
      </header>
      <p className="operations-guide">가족이 화면에서 확인한 오류만 최근 100건까지 표시합니다. 개인정보와 입력 내용은 기록하지 않습니다.</p>
      {loading ? <p className="operations-state">불러오는 중...</p> : logs.length === 0 ? (
        <p className="operations-state">기록된 오류가 없습니다.</p>
      ) : (
        <ul className="operations-list">
          {logs.map((log) => <li className={log.resolved_at ? 'resolved' : ''} key={log.id}>
            <div><strong>{featureLabel(log.feature)}</strong><span>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(log.created_at))}</span></div>
            <p>{log.user_message}</p><small>{log.route}</small>
            <button onClick={() => void toggleResolved(log)}>{log.resolved_at ? '미해결로 변경' : '해결 완료'}</button>
          </li>)}
        </ul>
      )}
      <FeedbackDialog feedback={feedback} onClose={() => setFeedback(null)} />
    </section>
  );
}
