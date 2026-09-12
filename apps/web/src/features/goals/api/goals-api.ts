import type { Goal, GoalInput } from '@home/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;
const mapGoal = (row: Row): Goal => ({
  id: String(row.id),
  householdId: String(row.household_id),
  ownerUserId: String(row.owner_user_id),
  visibility: row.visibility as Goal['visibility'],
  title: String(row.title),
  description: String(row.description ?? ''),
  targetDate: row.target_date ? String(row.target_date) : null,
  status: row.status as Goal['status'],
  progress: Number(row.progress),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});
const ensure = (error: { message?: string } | null) => {
  if (error) throw new Error('목표 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
};
const values = (input: GoalInput) => ({
  household_id: input.householdId,
  owner_user_id: input.ownerUserId,
  visibility: input.visibility,
  title: input.title.trim(),
  description: input.description,
  target_date: input.targetDate || null,
  status: input.status,
  progress: input.status === 'completed' ? 100 : input.progress,
});
const editableValues = (input: GoalInput) => ({
  visibility: input.visibility,
  title: input.title.trim(),
  description: input.description,
  target_date: input.targetDate || null,
  status: input.status,
  progress: input.status === 'completed' ? 100 : input.progress,
});

export const createGoalsApi = (client: SupabaseClient) => ({
  async list(householdId: string) {
    const { data, error } = await client
      .from('goals')
      .select('*')
      .eq('household_id', householdId)
      .order('status')
      .order('target_date', { ascending: true, nullsFirst: false });
    ensure(error);
    return ((data ?? []) as Row[]).map(mapGoal);
  },
  async create(input: GoalInput) {
    const { data, error } = await client.from('goals').insert(values(input)).select('*').single();
    ensure(error);
    return mapGoal(data as Row);
  },
  async update(id: string, input: GoalInput) {
    const { data, error } = await client
      .from('goals')
      .update(editableValues(input))
      .eq('id', id)
      .select('*')
      .single();
    ensure(error);
    return mapGoal(data as Row);
  },
  async remove(id: string) {
    const { error } = await client.from('goals').delete().eq('id', id);
    ensure(error);
  },
});
