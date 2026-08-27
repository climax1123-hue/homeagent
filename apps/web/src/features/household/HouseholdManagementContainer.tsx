import {
  householdErrorMessage,
  type Household,
  type HouseholdInvitation,
  type HouseholdMember,
  type HouseholdMemberStatus,
} from '@home/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createHouseholdApi, HouseholdApiError } from './api/household-api';
import { MemberManagementPage } from './pages/MemberManagementPage';

type HouseholdManagementContainerProps = {
  client: SupabaseClient;
  householdId: string;
  currentUserId: string;
};

type HouseholdData = {
  household: Household;
  members: HouseholdMember[];
  invitations: HouseholdInvitation[];
};

export function HouseholdManagementContainer({
  client,
  householdId,
  currentUserId,
}: HouseholdManagementContainerProps) {
  const api = useMemo(() => createHouseholdApi(client), [client]);
  const [data, setData] = useState<HouseholdData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);

    try {
      const [household, members, invitations] = await Promise.all([
        api.getHousehold(householdId),
        api.listMembers(householdId),
        api.listInvitations(householdId),
      ]);
      setData({ household, members, invitations });
    } catch (caughtError) {
      const code = caughtError instanceof HouseholdApiError ? caughtError.code : undefined;
      setError(householdErrorMessage(code));
    }
  }, [api, householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !data) {
    return (
      <section className="household-page">
        <div className="household-alert household-alert--error" role="alert">
          {error}
        </div>
        <button className="primary-action" onClick={() => void load()} type="button">
          다시 시도
        </button>
      </section>
    );
  }

  if (!data) {
    return (
      <section aria-busy="true" className="household-page">
        <div className="household-panel household-loading" role="status">
          가족 정보를 불러오는 중입니다…
        </div>
      </section>
    );
  }

  async function runAndRefresh(action: () => Promise<void>) {
    await action();
    await load();
  }

  return (
    <MemberManagementPage
      currentUserId={currentUserId}
      household={data.household}
      invitations={data.invitations}
      members={data.members}
      onCancelInvitation={(invitationId) => runAndRefresh(() => api.cancelInvitation(invitationId))}
      onChangeMemberStatus={(memberId: string, targetStatus: HouseholdMemberStatus) =>
        runAndRefresh(() => api.changeMemberStatus(memberId, targetStatus))
      }
      onInvite={(email) => runAndRefresh(() => api.invite(householdId, email))}
    />
  );
}
