import {
  validateCalendarEvent,
  type CalendarColor,
  type CalendarEvent,
  type CalendarEventInput,
  type CalendarOccurrence,
  type CalendarView,
  type HouseholdMember,
  type HouseholdRole,
  type LedgerCommonCode,
  type RecurrenceFrequency,
} from '@home/shared';
import { useMemo, useState, type FormEvent } from 'react';
import type { GoogleCalendarConnection } from './api/google-calendar-api';
import {
  formatEventTime,
  formatPeriod,
  fromDateKey,
  fromDateTimeLocal,
  monthGrid,
  startOfWeek,
  toDateKey,
  toDateTimeLocal,
} from './calendar-dates';
import {
  createGoogleCalendarUrl,
  filterOccurrences,
  memberColorIndex,
  memberName,
  type CalendarFilter,
} from './calendar-filters';
import './calendar.css';

type Props = {
  anchor: Date;
  currentUserId: string;
  commonCodes?: LedgerCommonCode[];
  eventReminderMinutes: Record<string, number>;
  householdId: string;
  googleBusy: boolean;
  googleConnection: GoogleCalendarConnection | null;
  loading: boolean;
  members: HouseholdMember[];
  occurrences: CalendarOccurrence[];
  role: HouseholdRole;
  view: CalendarView;
  onAnchorChange: (date: Date) => void;
  onDelete: (id: string) => Promise<void>;
  onCancelOccurrence: (occurrence: CalendarOccurrence) => Promise<void>;
  onGoogleConnect: () => Promise<void>;
  onGoogleDisconnect: () => Promise<void>;
  onGoogleSync: (eventId: string) => Promise<void>;
  onReload: () => Promise<void>;
  onRestoreOccurrence: (exceptionId: string) => Promise<void>;
  onSave: (input: CalendarEventInput, id?: string) => Promise<string>;
  onSaveOccurrence: (occurrence: CalendarOccurrence, input: CalendarEventInput) => Promise<void>;
  onSaveReminder: (eventId: string, title: string, minutes: number | null) => Promise<void>;
  onViewChange: (view: CalendarView) => void;
  onFeedback: (type: 'success' | 'error', message: string) => void;
};
type Draft = {
  title: string;
  visibility: 'family' | 'private';
  allDay: boolean;
  start: string;
  end: string;
  description: string;
  location: string;
  color: CalendarColor;
  frequency: '' | RecurrenceFrequency;
  interval: string;
  endMode: 'never' | 'until' | 'count';
  until: string;
  count: string;
  reminderMinutes: string;
};

function defaultDraft(date = new Date()): Draft {
  const startAt = new Date(date.getTime() + 60 * 60 * 1000);
  startAt.setMinutes(0, 0, 0);
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
  const start = toDateTimeLocal(startAt.toISOString());
  const end = toDateTimeLocal(endAt.toISOString());
  return {
    title: '',
    visibility: 'family',
    allDay: false,
    start,
    end,
    description: '',
    location: '',
    color: 'blue',
    frequency: '',
    interval: '1',
    endMode: 'never',
    until: '',
    count: '10',
    reminderMinutes: '',
  };
}
function draftFor(event: CalendarEvent, reminderMinutes = ''): Draft {
  return {
    title: event.title,
    visibility: event.visibility,
    allDay: event.allDay,
    start: event.allDay ? toDateKey(new Date(event.startsAt)) : toDateTimeLocal(event.startsAt),
    end: event.allDay
      ? toDateKey(new Date(Date.parse(event.endsAt) - 86_400_000))
      : toDateTimeLocal(event.endsAt),
    description: event.description,
    location: event.location,
    color: event.color,
    frequency: event.recurrence?.frequency ?? '',
    interval: String(event.recurrence?.interval ?? 1),
    endMode: event.recurrence?.until ? 'until' : event.recurrence?.count ? 'count' : 'never',
    until: event.recurrence?.until ?? '',
    count: String(event.recurrence?.count ?? 10),
    reminderMinutes,
  };
}

function occurrenceKey(value: CalendarOccurrence) {
  return `${value.event.id}-${value.occurrenceStart}`;
}
function EventButton({
  value,
  members,
  currentUserId,
  onClick,
}: {
  value: CalendarOccurrence;
  members: HouseholdMember[];
  currentUserId: string;
  onClick: () => void;
}) {
  const ownerName = memberName(members, value.event.ownerUserId, currentUserId);
  const ownerColor = memberColorIndex(members, value.event.ownerUserId);
  return (
    <button
      className={`calendar-event calendar-event--${value.event.color} calendar-owner-${ownerColor}`}
      onClick={onClick}
      title={`${ownerName} · ${value.event.visibility === 'private' ? '개인 일정' : '가족 공유'}`}
    >
      <span>{formatEventTime(value)}</span>
      <strong>{value.event.title}</strong>
      <small>
        {ownerName} · {value.event.visibility === 'private' ? '개인' : '가족'}
      </small>
    </button>
  );
}

export function CalendarPage(props: Props) {
  const [selected, setSelected] = useState<CalendarOccurrence | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null | 'new'>(null);
  const [editingOccurrence, setEditingOccurrence] = useState<CalendarOccurrence | null>(null);
  const [draft, setDraft] = useState<Draft>(() => defaultDraft());
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<CalendarFilter>('all');
  const choices = (key: string) =>
    (props.commonCodes ?? []).filter((item) => item.groupKey === key && item.isActive);
  const currentMonth = Number(toDateKey(props.anchor).slice(5, 7));
  const visibleOccurrences = useMemo(
    () => filterOccurrences(props.occurrences, filter, props.currentUserId),
    [filter, props.currentUserId, props.occurrences],
  );
  const grouped = useMemo(() => {
    const result = new Map<string, CalendarOccurrence[]>();
    visibleOccurrences.forEach((value) => {
      const key = toDateKey(new Date(value.occurrenceStart));
      result.set(key, [...(result.get(key) ?? []), value]);
    });
    return result;
  }, [visibleOccurrences]);
  const openNew = (date = props.anchor) => {
    setDraft(defaultDraft(date));
    setEditing('new');
    setEditingOccurrence(null);
    setSelected(null);
  };
  const openEdit = (event: CalendarEvent) => {
    setDraft(draftFor(event, String(props.eventReminderMinutes[event.id] ?? '')));
    setEditing(event);
    setEditingOccurrence(null);
    setSelected(null);
  };
  const openOccurrenceEdit = (occurrence: CalendarOccurrence) => {
    const occurrenceEvent = {
      ...occurrence.event,
      startsAt: occurrence.occurrenceStart,
      endsAt: occurrence.occurrenceEnd,
      recurrence: null,
    };
    setDraft(draftFor(occurrenceEvent));
    setEditing(occurrence.sourceEvent ?? occurrence.event);
    setEditingOccurrence(occurrence);
    setSelected(null);
  };
  const move = (direction: number) => {
    const next = new Date(props.anchor);
    if (props.view === 'month') next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * (props.view === 'week' ? 7 : 31));
    props.onAnchorChange(next);
  };
  const canEdit =
    selected &&
    (selected.event.ownerUserId === props.currentUserId ||
      (selected.event.visibility === 'family' && props.role === 'admin'));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const allDayEnd = draft.allDay
        ? new Date(fromDateKey(draft.end).getTime() + 86_400_000).toISOString()
        : fromDateTimeLocal(draft.end);
      const input: CalendarEventInput = {
        householdId: props.householdId,
        ownerUserId: editing !== 'new' && editing ? editing.ownerUserId : props.currentUserId,
        visibility: draft.visibility,
        title: draft.title.trim(),
        description: draft.description,
        location: draft.location,
        startsAt: draft.allDay
          ? fromDateKey(draft.start).toISOString()
          : fromDateTimeLocal(draft.start),
        endsAt: allDayEnd,
        allDay: draft.allDay,
        timezone: 'Asia/Seoul',
        color: draft.color,
        recurrence:
          !editingOccurrence && draft.frequency
            ? {
                frequency: draft.frequency,
                interval: Number(draft.interval),
                until: draft.endMode === 'until' ? draft.until : null,
                count: draft.endMode === 'count' ? Number(draft.count) : null,
              }
            : null,
      };
      const invalid = validateCalendarEvent(input);
      if (invalid) {
        props.onFeedback('error', invalid);
        return;
      }
      if (editingOccurrence) {
        await props.onSaveOccurrence(editingOccurrence, input);
      } else {
        const eventId = await props.onSave(
          input,
          editing !== 'new' && editing ? editing.id : undefined,
        );
        try {
          await props.onSaveReminder(
            eventId,
            input.title,
            draft.reminderMinutes === '' ? null : Number(draft.reminderMinutes),
          );
        } catch (reason) {
          if (editing === 'new') {
            setEditing({
              ...input,
              id: eventId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          throw reason;
        }
      }
      setEditing(null);
      setEditingOccurrence(null);
      props.onFeedback(
        'success',
        editing === 'new' ? '일정을 정상적으로 추가했습니다.' : '일정을 정상적으로 수정했습니다.',
      );
    } catch (reason) {
      props.onFeedback(
        'error',
        reason instanceof Error ? reason.message : '일정을 저장하지 못했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }

  const days =
    props.view === 'month'
      ? monthGrid(props.anchor)
      : Array.from(
          { length: props.view === 'week' ? 7 : 31 },
          (_, index) =>
            new Date(
              (props.view === 'week'
                ? startOfWeek(props.anchor)
                : fromDateKey(toDateKey(props.anchor))
              ).getTime() +
                index * 86_400_000,
            ),
        );
  return (
    <section className="calendar-page">
      <div className="calendar-toolbar">
        <div>
          <p className="app-eyebrow">FAMILY CALENDAR</p>
          <h2>{formatPeriod(props.anchor, props.view)}</h2>
        </div>
        <div className="calendar-toolbar-actions">
          <div className="calendar-move">
            <button onClick={() => move(-1)} aria-label="이전 기간">
              ‹
            </button>
            <button onClick={() => props.onAnchorChange(new Date())}>오늘</button>
            <button onClick={() => move(1)} aria-label="다음 기간">
              ›
            </button>
          </div>
          <div className="calendar-view-switch" aria-label="일정 보기" role="group">
            {(['month', 'week', 'agenda'] as const).map((view) => (
              <button
                aria-pressed={props.view === view}
                key={view}
                onClick={() => props.onViewChange(view)}
              >
                {view === 'month' ? '월' : view === 'week' ? '주' : '목록'}
              </button>
            ))}
          </div>
          <button className="calendar-add" onClick={() => openNew()}>
            + 일정 추가
          </button>
        </div>
      </div>
      <div className="calendar-filters" aria-label="캘린더 선택">
        {(
          [
            ['all', '전체'],
            ['family', '가족 공유'],
            ['mine', '내 일정'],
            ['private', '개인 일정'],
          ] as const
        ).map(([value, label]) => (
          <button aria-pressed={filter === value} key={value} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
        {props.members.map((member) => {
          const value = `member:${member.userId}` as const;
          const color = memberColorIndex(props.members, member.userId);
          return (
            <button
              aria-pressed={filter === value}
              key={member.id}
              onClick={() => setFilter(value)}
            >
              <span className={`calendar-owner-dot calendar-owner-dot-${color}`} />
              {memberName(props.members, member.userId, props.currentUserId)}
            </button>
          );
        })}
      </div>
      <div className="calendar-google-status">
        <div>
          <strong>Google Calendar</strong>
          <span>
            {props.googleConnection
              ? props.googleConnection.status === 'active'
                ? `${props.googleConnection.email} 연결됨`
                : '다시 연결이 필요합니다'
              : '연결하면 내가 만든 일정을 Google에 동기화할 수 있습니다.'}
          </span>
        </div>
        {props.googleConnection?.status === 'active' ? (
          <button disabled={props.googleBusy} onClick={() => void props.onGoogleDisconnect()}>
            연결 해제
          </button>
        ) : (
          <button disabled={props.googleBusy} onClick={() => void props.onGoogleConnect()}>
            {props.googleBusy ? '연결 중…' : 'Google 연결'}
          </button>
        )}
      </div>
      {props.loading ? (
        <div className="calendar-loading" aria-busy="true">
          일정을 불러오는 중입니다…
        </div>
      ) : props.view === 'month' ? (
        <div className="calendar-month">
          <div className="calendar-weekdays">
            {'일월화수목금토'.split('').map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-month-grid">
            {days.map((day) => {
              const key = toDateKey(day);
              const values = grouped.get(key) ?? [];
              return (
                <div
                  className={`calendar-day${Number(key.slice(5, 7)) !== currentMonth ? ' calendar-day--outside' : ''}${key === toDateKey(new Date()) ? ' calendar-day--today' : ''}`}
                  key={key}
                >
                  <button
                    className="calendar-day-number"
                    onClick={() => openNew(day)}
                    aria-label={`${key} 일정 추가`}
                  >
                    {Number(key.slice(8, 10))}
                  </button>
                  <div>
                    {values.slice(0, 3).map((value) => (
                      <EventButton
                        currentUserId={props.currentUserId}
                        key={occurrenceKey(value)}
                        members={props.members}
                        onClick={() => setSelected(value)}
                        value={value}
                      />
                    ))}
                    {values.length > 3 && (
                      <small className="calendar-more">+{values.length - 3}개</small>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={`calendar-${props.view}`}>
          {days.map((day) => {
            const key = toDateKey(day);
            const values = grouped.get(key) ?? [];
            if (props.view === 'agenda' && !values.length) return null;
            return (
              <section className="calendar-date-group" key={key}>
                <header>
                  <strong>
                    {new Intl.DateTimeFormat('ko-KR', {
                      timeZone: 'Asia/Seoul',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short',
                    }).format(day)}
                  </strong>
                  <button onClick={() => openNew(day)}>+</button>
                </header>
                {values.length ? (
                  values.map((value) => (
                    <EventButton
                      currentUserId={props.currentUserId}
                      key={occurrenceKey(value)}
                      members={props.members}
                      onClick={() => setSelected(value)}
                      value={value}
                    />
                  ))
                ) : (
                  <p>일정이 없습니다.</p>
                )}
              </section>
            );
          })}
          {props.view === 'agenda' && visibleOccurrences.length === 0 && (
            <div className="calendar-empty">다가오는 일정이 없습니다.</div>
          )}
        </div>
      )}
      {selected && (
        <div
          className="calendar-dialog-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}
        >
          <section aria-labelledby="event-detail-title" className="calendar-dialog" role="dialog">
            <button
              className="calendar-dialog-close"
              onClick={() => setSelected(null)}
              aria-label="닫기"
            >
              ×
            </button>
            <span className={`calendar-color-dot calendar-color-dot--${selected.event.color}`} />
            <h3 id="event-detail-title">{selected.event.title}</h3>
            <p>
              {selected.event.allDay
                ? '종일 일정'
                : `${new Date(selected.occurrenceStart).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} ~ ${new Date(selected.occurrenceEnd).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`}
            </p>
            <p>
              등록자: {memberName(props.members, selected.event.ownerUserId, props.currentUserId)} ·{' '}
              {selected.event.visibility === 'private' ? '개인 일정' : '가족 공유 일정'}
              {selected.recurring ? ' · 반복' : ''}
              {selected.overridden ? ' · 이번 회차 변경됨' : ''}
            </p>
            {selected.event.location && <p>장소: {selected.event.location}</p>}
            {selected.event.description && <p>{selected.event.description}</p>}
            <a
              className="calendar-google-link"
              href={createGoogleCalendarUrl(selected)}
              rel="noreferrer"
              target="_blank"
            >
              Google Calendar에 이 일정 추가
            </a>
            {selected.event.ownerUserId === props.currentUserId &&
              props.googleConnection?.status === 'active' && (
                <button
                  className="calendar-google-sync"
                  disabled={props.googleBusy}
                  onClick={() => void props.onGoogleSync(selected.event.id)}
                >
                  {props.googleBusy ? '동기화 중…' : '내 Google Calendar와 동기화'}
                </button>
              )}
            {canEdit && (
              <div className="calendar-dialog-actions">
                {selected.recurring ? (
                  <>
                    {selected.exceptionId && (
                      <button
                        onClick={() =>
                          void props
                            .onRestoreOccurrence(selected.exceptionId!)
                            .then(() => setSelected(null))
                        }
                      >
                        이번 회차 원래대로
                      </button>
                    )}
                    <button onClick={() => openOccurrenceEdit(selected)}>이번만 수정</button>
                    <button onClick={() => openEdit(selected.sourceEvent ?? selected.event)}>
                      전체 수정
                    </button>
                    <button
                      className="calendar-delete"
                      onClick={() => {
                        if (window.confirm('선택한 이번 일정만 삭제할까요?'))
                          void props
                            .onCancelOccurrence(selected)
                            .then(() => setSelected(null))
                            .catch(() => undefined);
                      }}
                    >
                      이번만 삭제
                    </button>
                    <button
                      className="calendar-delete"
                      onClick={() => {
                        if (window.confirm('전체 반복 일정을 삭제할까요?'))
                          void props
                            .onDelete(selected.event.id)
                            .then(() => setSelected(null))
                            .catch(() => undefined);
                      }}
                    >
                      전체 삭제
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => openEdit(selected.event)}>수정</button>
                    <button
                      className="calendar-delete"
                      onClick={() => {
                        if (window.confirm('이 일정을 삭제할까요?'))
                          void props
                            .onDelete(selected.event.id)
                            .then(() => setSelected(null))
                            .catch(() => undefined);
                      }}
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
      {editing && (
        <div className="calendar-dialog-backdrop">
          <form
            aria-labelledby="event-form-title"
            className="calendar-dialog calendar-form"
            onSubmit={(event) => void submit(event)}
            role="dialog"
          >
            <button
              type="button"
              className="calendar-dialog-close"
              onClick={() => {
                setEditing(null);
                setEditingOccurrence(null);
              }}
              aria-label="닫기"
            >
              ×
            </button>
            <h3 id="event-form-title">
              {editingOccurrence ? '이번 일정만 수정' : editing === 'new' ? '새 일정' : '일정 수정'}
            </h3>
            <label>
              제목
              <input
                autoFocus
                maxLength={120}
                required
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <div className="calendar-form-row">
              <label>
                공개 범위
                <select
                  value={draft.visibility}
                  onChange={(e) =>
                    setDraft({ ...draft, visibility: e.target.value as Draft['visibility'] })
                  }
                >
                  {choices('calendar_visibility').map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="calendar-check">
                <input
                  type="checkbox"
                  checked={draft.allDay}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      allDay: e.target.checked,
                      start: e.target.checked
                        ? draft.start.slice(0, 10)
                        : `${draft.start.slice(0, 10)}T09:00`,
                      end: e.target.checked
                        ? draft.end.slice(0, 10)
                        : `${draft.end.slice(0, 10)}T10:00`,
                    })
                  }
                />
                종일
              </label>
            </div>
            <div className="calendar-form-row">
              <label>
                시작
                <input
                  type={draft.allDay ? 'date' : 'datetime-local'}
                  required
                  value={draft.start}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                />
              </label>
              <label>
                종료
                <input
                  type={draft.allDay ? 'date' : 'datetime-local'}
                  required
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                />
              </label>
            </div>
            {!editingOccurrence && (
              <>
                <div className="calendar-form-row">
                  <label>
                    반복
                    <select
                      value={draft.frequency}
                      onChange={(e) =>
                        setDraft({ ...draft, frequency: e.target.value as Draft['frequency'] })
                      }
                    >
                      <option value="">반복 안 함</option>
                      {choices('recurrence_frequency').map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {draft.frequency && (
                    <label>
                      간격
                      <input
                        min="1"
                        max="30"
                        type="number"
                        value={draft.interval}
                        onChange={(e) => setDraft({ ...draft, interval: e.target.value })}
                      />
                    </label>
                  )}
                </div>
                {draft.frequency && (
                  <div className="calendar-form-row">
                    <label>
                      반복 종료
                      <select
                        value={draft.endMode}
                        onChange={(e) =>
                          setDraft({ ...draft, endMode: e.target.value as Draft['endMode'] })
                        }
                      >
                        {choices('recurrence_end_mode').map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {draft.endMode === 'until' && (
                      <label>
                        종료일
                        <input
                          type="date"
                          value={draft.until}
                          onChange={(e) => setDraft({ ...draft, until: e.target.value })}
                        />
                      </label>
                    )}
                    {draft.endMode === 'count' && (
                      <label>
                        횟수
                        <input
                          min="1"
                          max="999"
                          type="number"
                          value={draft.count}
                          onChange={(e) => setDraft({ ...draft, count: e.target.value })}
                        />
                      </label>
                    )}
                  </div>
                )}
                <label>
                  시작 전 알림
                  <select
                    value={draft.reminderMinutes}
                    onChange={(e) => setDraft({ ...draft, reminderMinutes: e.target.value })}
                  >
                    <option value="">알림 없음</option>
                    {choices('calendar_reminder_minutes').map((item) => (
                      <option key={item.code} value={item.valueText}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label>
              장소
              <input
                maxLength={200}
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              />
            </label>
            <label>
              설명
              <textarea
                maxLength={2000}
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <fieldset>
              <legend>색상</legend>
              <div className="calendar-colors">
                {choices('calendar_color')
                  .map((item) => item.code as CalendarColor)
                  .map((color) => (
                    <label
                      key={color}
                      className={`calendar-color-choice calendar-color-choice--${color}`}
                    >
                      <input
                        checked={draft.color === color}
                        name="color"
                        type="radio"
                        onChange={() => setDraft({ ...draft, color })}
                      />
                      <span>{color}</span>
                    </label>
                  ))}
              </div>
            </fieldset>
            <div className="calendar-dialog-actions">
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setEditingOccurrence(null);
                }}
              >
                취소
              </button>
              <button className="calendar-save" disabled={busy}>
                {busy ? '저장 중…' : '저장'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
