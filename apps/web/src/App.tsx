import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { readPublicEnv } from './config/public-env';
import {
  AccessStatusPage,
  AdminSignUpDisabledPage,
  AuthCallbackPage,
  AuthenticatedRoute,
  AuthProviders,
  CheckEmailPage,
  HouseholdRoute,
  InvitationEntryPage,
  InviteSignUpPage,
  LoginPage,
  PublicOnlyRoute,
  useAccess,
  useAuth,
} from './features/auth/auth';
import {
  AppNotFoundPage,
  AppShell,
  ComingSoonPage,
  DashboardPage,
} from './features/app-shell/AppShell';
import { HouseholdManagementContainer } from './features/household/HouseholdManagementContainer';
import { HouseholdSettingsContainer } from './features/household/HouseholdSettingsContainer';
import { CalendarContainer } from './features/calendar/CalendarContainer';
import { LedgerContainer } from './features/ledger/LedgerContainer';
import { LedgerDashboardContainer } from './features/ledger/dashboard/LedgerDashboardContainer';
import { CommonCodesPage } from './features/common-codes/CommonCodesPage';
import { PrivacyPage, PublicHomePage } from './features/public/PublicPages';
import './features/household/household.css';
import { getSupabaseClient } from './lib/supabase/client';

function MembersRoute() {
  const { client, user } = useAuth();
  const { access } = useAccess();
  if (!user || access?.kind !== 'active' || access.role !== 'admin')
    return <Navigate replace to="/app" />;
  return (
    <HouseholdManagementContainer
      client={client}
      currentUserId={user.id}
      householdId={access.householdId}
    />
  );
}

function HouseholdSettingsRoute() {
  const { client, user } = useAuth();
  const { access } = useAccess();
  if (!user || access?.kind !== 'active') return <Navigate replace to="/app" />;
  return (
    <HouseholdSettingsContainer
      client={client}
      currentUserId={user.id}
      householdId={access.householdId}
    />
  );
}

export function App() {
  const env = readPublicEnv();
  if (!env)
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>환경 설정 필요</h1>
          <p>Supabase URL과 publishable key를 .env.local에 설정해 주세요.</p>
        </section>
      </main>
    );
  return (
    <BrowserRouter>
      <AuthProviders client={getSupabaseClient(env)}>
        <Routes>
          <Route path="/" element={<PublicHomePage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/invite" element={<InvitationEntryPage />} />
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup/admin" element={<AdminSignUpDisabledPage />} />
            <Route path="/signup/invite" element={<InviteSignUpPage />} />
          </Route>
          <Route path="/auth/check-email" element={<CheckEmailPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route element={<AuthenticatedRoute />}>
            <Route path="/access/invited" element={<AccessStatusPage />} />
            <Route path="/access/pending" element={<AccessStatusPage />} />
            <Route path="/access/blocked" element={<AccessStatusPage />} />
            <Route element={<HouseholdRoute />}>
              <Route path="/app" element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="calendar" element={<CalendarContainer />} />
                <Route path="ledger" element={<LedgerContainer />} />
                <Route path="ledger/dashboard" element={<LedgerDashboardContainer />} />
                <Route
                  path="ddays"
                  element={
                    <ComingSoonPage
                      feature="디데이"
                      description="가족의 중요한 날을 함께 기억하는 기능을 준비하고 있습니다."
                    />
                  }
                />
                <Route
                  path="goals"
                  element={
                    <ComingSoonPage
                      feature="목표"
                      description="가족과 개인 목표를 기록하고 점검하는 기능을 준비하고 있습니다."
                    />
                  }
                />
                <Route path="settings" element={<HouseholdSettingsRoute />} />
                <Route path="members" element={<MembersRoute />} />
                <Route path="common-codes" element={<CommonCodesPage />} />
                <Route path="*" element={<AppNotFoundPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate replace to="/app" />} />
        </Routes>
      </AuthProviders>
    </BrowserRouter>
  );
}
