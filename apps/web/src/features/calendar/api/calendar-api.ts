import type {
  CalendarEvent,
  CalendarEventException,
  CalendarEventInput,
  CalendarRecurrence,
} from '@home/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type CalendarRow = {
  id: string;
  household_id: string;
  owner_user_id: string;
  visibility: CalendarEvent['visibility'];
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  timezone: 'Asia/Seoul';
  color: CalendarEvent['color'];
  recurrence_frequency: CalendarRecurrence['frequency'] | null;
  recurrence_interval: number;
  recurrence_until: string | null;
  recurrence_count: number | null;
  created_at: string;
  updated_at: string;
};

type ExceptionRow = {
  id: string;
  event_id: string;
  household_id: string;
  owner_user_id: string;
  original_starts_at: string;
  action: CalendarEventException['action'];
  title: string | null;
  description: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean | null;
  color: CalendarEventException['color'];
};

const SELECT_COLUMNS =
  'id, household_id, owner_user_id, visibility, title, description, location, starts_at, ends_at, all_day, timezone, color, recurrence_frequency, recurrence_interval, recurrence_until, recurrence_count, created_at, updated_at';

function mapRow(row: CalendarRow): CalendarEvent {
  return {
    id: row.id,
    householdId: row.household_id,
    ownerUserId: row.owner_user_id,
    visibility: row.visibility,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    timezone: row.timezone,
    color: row.color,
    recurrence: row.recurrence_frequency
      ? {
          frequency: row.recurrence_frequency,
          interval: row.recurrence_interval,
          until: row.recurrence_until,
          count: row.recurrence_count,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(input: CalendarEventInput) {
  return {
    household_id: input.householdId,
    owner_user_id: input.ownerUserId,
    visibility: input.visibility,
    title: input.title.trim(),
    description: input.description.trim(),
    location: input.location.trim(),
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    all_day: input.allDay,
    timezone: input.timezone,
    color: input.color,
    recurrence_frequency: input.recurrence?.frequency ?? null,
    recurrence_interval: input.recurrence?.interval ?? 1,
    recurrence_until: input.recurrence?.until ?? null,
    recurrence_count: input.recurrence?.count ?? null,
  };
}

const mapException = (row: ExceptionRow): CalendarEventException => ({
  id: row.id,
  eventId: row.event_id,
  householdId: row.household_id,
  ownerUserId: row.owner_user_id,
  originalStartsAt: row.original_starts_at,
  action: row.action,
  title: row.title,
  description: row.description,
  location: row.location,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  allDay: row.all_day,
  color: row.color,
});

function ensure(error: { message?: string } | null) {
  if (error) throw new Error('일정 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
}

export function createCalendarApi(client: SupabaseClient) {
  return {
    async listExceptions(eventIds: string[], rangeStart: Date, rangeEnd: Date) {
      if (!eventIds.length) return [];
      const start = new Date(rangeStart.getTime() - 7 * 86_400_000).toISOString();
      const end = new Date(rangeEnd.getTime() + 7 * 86_400_000).toISOString();
      const { data, error } = await client
        .from('calendar_event_exceptions')
        .select(
          'id, event_id, household_id, owner_user_id, original_starts_at, action, title, description, location, starts_at, ends_at, all_day, color',
        )
        .in('event_id', eventIds)
        .gte('original_starts_at', start)
        .lt('original_starts_at', end);
      ensure(error);
      return ((data ?? []) as ExceptionRow[]).map(mapException);
    },
    async listEvents(householdId: string, rangeStart: Date, rangeEnd: Date) {
      const { data, error } = await client
        .from('calendar_events')
        .select(SELECT_COLUMNS)
        .eq('household_id', householdId)
        .lt('starts_at', rangeEnd.toISOString())
        .or(`ends_at.gt.${rangeStart.toISOString()},recurrence_frequency.not.is.null`)
        .order('starts_at');
      ensure(error);
      return ((data ?? []) as CalendarRow[]).map(mapRow);
    },
    async createEvent(input: CalendarEventInput) {
      const { data, error } = await client
        .from('calendar_events')
        .insert(toRow(input))
        .select(SELECT_COLUMNS)
        .single();
      ensure(error);
      return mapRow(data as CalendarRow);
    },
    async updateEvent(id: string, input: CalendarEventInput) {
      const { data, error } = await client
        .from('calendar_events')
        .update(toRow(input))
        .eq('id', id)
        .select(SELECT_COLUMNS)
        .single();
      ensure(error);
      return mapRow(data as CalendarRow);
    },
    async deleteEvent(id: string) {
      const { error } = await client.from('calendar_events').delete().eq('id', id);
      ensure(error);
    },
    async cancelOccurrence(event: CalendarEvent, originalStart: string) {
      const { error } = await client.from('calendar_event_exceptions').upsert(
        {
          event_id: event.id,
          household_id: event.householdId,
          owner_user_id: event.ownerUserId,
          original_starts_at: originalStart,
          action: 'cancelled',
          title: null,
          description: null,
          location: null,
          starts_at: null,
          ends_at: null,
          all_day: null,
          color: null,
        },
        { onConflict: 'event_id,original_starts_at' },
      );
      ensure(error);
    },
    async overrideOccurrence(
      event: CalendarEvent,
      originalStart: string,
      input: CalendarEventInput,
    ) {
      const { error } = await client.from('calendar_event_exceptions').upsert(
        {
          event_id: event.id,
          household_id: event.householdId,
          owner_user_id: event.ownerUserId,
          original_starts_at: originalStart,
          action: 'override',
          title: input.title.trim(),
          description: input.description.trim(),
          location: input.location.trim(),
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          all_day: input.allDay,
          color: input.color,
        },
        { onConflict: 'event_id,original_starts_at' },
      );
      ensure(error);
    },
    async restoreOccurrence(exceptionId: string) {
      const { error } = await client
        .from('calendar_event_exceptions')
        .delete()
        .eq('id', exceptionId);
      ensure(error);
    },
  };
}
