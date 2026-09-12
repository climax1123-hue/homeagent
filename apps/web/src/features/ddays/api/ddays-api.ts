import type { Dday, DdayInput } from '@home/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;
const mapDday = (row: Row): Dday => ({
  id: String(row.id),
  householdId: String(row.household_id),
  ownerUserId: String(row.owner_user_id),
  visibility: row.visibility as Dday['visibility'],
  title: String(row.title),
  targetDate: String(row.target_date),
  memo: String(row.memo ?? ''),
  repeatYearly: Boolean(row.repeat_yearly),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});
const ensure = (error: { message?: string } | null) => {
  if (error) throw new Error('디데이 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
};
const values = (input: DdayInput) => ({
  household_id: input.householdId,
  owner_user_id: input.ownerUserId,
  visibility: input.visibility,
  title: input.title.trim(),
  target_date: input.targetDate,
  memo: input.memo,
  repeat_yearly: input.repeatYearly,
});
const editableValues = (input: DdayInput) => ({
  visibility: input.visibility,
  title: input.title.trim(),
  target_date: input.targetDate,
  memo: input.memo,
  repeat_yearly: input.repeatYearly,
});

export const createDdaysApi = (client: SupabaseClient) => ({
  async list(householdId: string) {
    const { data, error } = await client.from('ddays').select('*').eq('household_id', householdId);
    ensure(error);
    return ((data ?? []) as Row[]).map(mapDday);
  },
  async create(input: DdayInput) {
    const { data, error } = await client.from('ddays').insert(values(input)).select('*').single();
    ensure(error);
    return mapDday(data as Row);
  },
  async update(id: string, input: DdayInput) {
    const { data, error } = await client
      .from('ddays')
      .update(editableValues(input))
      .eq('id', id)
      .select('*')
      .single();
    ensure(error);
    return mapDday(data as Row);
  },
  async remove(id: string) {
    const { error } = await client.from('ddays').delete().eq('id', id);
    ensure(error);
  },
});
