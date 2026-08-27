import type { Household, HouseholdMember } from '@home/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createHouseholdApi } from './api/household-api';
import { HouseholdSettingsPage } from './pages/HouseholdSettingsPage';

export function HouseholdSettingsContainer({
  client,
  householdId,
  currentUserId,
}: {
  client: SupabaseClient;
  householdId: string;
  currentUserId: string;
}) {
  const api = useMemo(() => createHouseholdApi(client), [client]);
  const [data, setData] = useState<{ household: Household; member: HouseholdMember } | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setError(false);
    try {
      const [household, members] = await Promise.all([
        api.getHousehold(householdId),
        api.listMembers(householdId),
      ]);
      const member = members.find((value) => value.userId === currentUserId);
      if (!member) throw new Error('MEMBER_NOT_FOUND');
      setData({ household, member });
    } catch {
      setError(true);
    }
  }, [api, householdId, currentUserId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (error)
    return (
      <section className="household-page">
        <div className="household-alert household-alert--error" role="alert">
          가족 설정을 불러오지 못했습니다.
        </div>
        <button className="primary-action" onClick={() => void load()}>
          다시 시도
        </button>
      </section>
    );
  if (!data)
    return (
      <section className="household-page" aria-busy="true">
        가족 설정을 불러오는 중입니다…
      </section>
    );
  return (
    <HouseholdSettingsPage
      household={data.household}
      member={data.member}
      onUpdateDisplayName={async (name) => {
        await api.updateMyDisplayName(householdId, name);
        await load();
      }}
    />
  );
}
