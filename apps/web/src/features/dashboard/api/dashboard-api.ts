import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DASHBOARD_WIDGETS,
  DEFAULT_WIDGET_ORDER,
  type DashboardWidgetId,
} from '../dashboard-types';

const validOrder = (value: unknown): value is DashboardWidgetId[] =>
  Array.isArray(value) &&
  value.length === DASHBOARD_WIDGETS.length &&
  new Set(value).size === DASHBOARD_WIDGETS.length &&
  value.every((item) => (DASHBOARD_WIDGETS as readonly unknown[]).includes(item));
export const createDashboardApi = (client: SupabaseClient) => ({
  async getOrder(householdId: string, userId: string) {
    const { data, error } = await client
      .from('dashboard_preferences')
      .select('widget_order')
      .eq('household_id', householdId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error('대시보드 배치를 불러오지 못했습니다.');
    return validOrder(data?.widget_order) ? [...data.widget_order] : [...DEFAULT_WIDGET_ORDER];
  },
  async saveOrder(householdId: string, userId: string, widgetOrder: DashboardWidgetId[]) {
    if (!validOrder(widgetOrder)) throw new Error('대시보드 카드 구성이 올바르지 않습니다.');
    const { error } = await client
      .from('dashboard_preferences')
      .upsert(
        { household_id: householdId, user_id: userId, widget_order: widgetOrder },
        { onConflict: 'household_id,user_id' },
      );
    if (error) throw new Error('대시보드 배치를 저장하지 못했습니다.');
  },
});
