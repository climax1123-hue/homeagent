import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createNotificationApi, type RecurringReminder } from './api/notification-api';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const base64Key = (value: string) => {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

export function NotificationPanel({
  client,
  householdId,
  userId,
}: {
  client: SupabaseClient;
  householdId: string;
  userId: string;
}) {
  const api = useMemo(() => createNotificationApi(client), [client]);
  const [reminders, setReminders] = useState<RecurringReminder[]>([]);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [title, setTitle] = useState('아침 약 먹기');
  const [time, setTime] = useState('08:00');
  const [weekdays, setWeekdays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

  const load = useCallback(async () => {
    try {
      setReminders(await api.listRecurring());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '알림을 불러오지 못했습니다.');
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!supported) return;
    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => registration.pushManager.getSubscription())
      .then(setSubscription);
  }, [supported]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '알림 요청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };
  const enablePush = () =>
    run(async () => {
      const key = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim();
      if (!key) throw new Error('웹 푸시 공개키 설정이 아직 완료되지 않았습니다.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('브라우저 알림 권한이 허용되지 않았습니다.');
      const registration = await navigator.serviceWorker.ready;
      const next = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64Key(key),
      });
      await api.saveSubscription(userId, next);
      setSubscription(next);
    });
  const disablePush = () =>
    run(async () => {
      if (!subscription) return;
      await api.removeSubscription(subscription.endpoint);
      await subscription.unsubscribe();
      setSubscription(null);
    });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (!title.trim() || weekdays.length === 0)
        throw new Error('제목과 알림 요일을 선택해 주세요.');
      await api.createRecurring({
        householdId,
        userId,
        title,
        body: '',
        localTime: time,
        weekdays,
      });
    });
  };

  return (
    <section className="notification-panel">
      <div className="notification-heading">
        <div>
          <p className="app-eyebrow">REMINDERS</p>
          <h2>알림 관리</h2>
        </div>
        {subscription ? (
          <button disabled={busy} onClick={() => void disablePush()}>
            이 기기 알림 끄기
          </button>
        ) : (
          <button disabled={busy || !supported} onClick={() => void enablePush()}>
            이 기기 알림 켜기
          </button>
        )}
      </div>
      {!supported && (
        <p className="notification-guide">이 브라우저는 Web Push를 지원하지 않습니다.</p>
      )}
      {/iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone && (
        <p className="notification-guide">
          iPhone에서는 공유 메뉴의 ‘홈 화면에 추가’ 후 설치된 우리집 앱에서 알림을 켜 주세요.
        </p>
      )}
      {error && (
        <p className="calendar-form-error" role="alert">
          {error}
        </p>
      )}
      <form className="notification-form" onSubmit={submit}>
        <label>
          반복 알림 이름
          <input
            maxLength={120}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          알림 시간
          <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <fieldset>
          <legend>요일</legend>
          <div className="notification-days">
            {DAYS.map((day, index) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={weekdays.includes(index)}
                  onChange={(e) =>
                    setWeekdays(
                      e.target.checked
                        ? [...weekdays, index].sort()
                        : weekdays.filter((value) => value !== index),
                    )
                  }
                />
                <span>{day}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button disabled={busy}>반복 알림 추가</button>
      </form>
      <div className="notification-list">
        {reminders.map((reminder) => (
          <article key={reminder.id}>
            <div>
              <strong>{reminder.title}</strong>
              <span>
                {reminder.localTime} · {reminder.weekdays.map((day) => DAYS[day]).join('·')}
              </span>
            </div>
            <button
              onClick={() => void run(() => api.toggleReminder(reminder.id, !reminder.enabled))}
            >
              {reminder.enabled ? '켜짐' : '꺼짐'}
            </button>
            <button
              className="calendar-delete"
              onClick={() => void run(() => api.deleteReminder(reminder.id))}
            >
              삭제
            </button>
          </article>
        ))}
        {reminders.length === 0 && <p>등록된 반복 알림이 없습니다.</p>}
      </div>
    </section>
  );
}
