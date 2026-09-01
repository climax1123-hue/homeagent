import type { AccessContext } from '@home/shared';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { createHouseholdApi } from '../household/api/household-api';

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const safeReturnTo = (value: string | null) =>
  value?.startsWith('/') && !value.startsWith('//') ? value : '/app';

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  client: SupabaseClient;
};
const AuthContext = createContext<AuthState | null>(null);
const AccessContextState = createContext<{
  loading: boolean;
  access: AccessContext | null;
  error: boolean;
  reload: () => void;
} | null>(null);

export function AuthProviders({
  client,
  children,
}: {
  client: SupabaseClient;
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, [client]);
  return (
    <AuthContext.Provider value={{ client, loading, session, user: session?.user ?? null }}>
      <AccessProvider>{children}</AccessProvider>
    </AuthContext.Provider>
  );
}

function AccessProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [access, setAccess] = useState<AccessContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (auth.loading) {
      setLoading(true);
      return;
    }
    if (!auth.user) {
      setAccess(null);
      setError(false);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    void createHouseholdApi(auth.client)
      .getAccessContext()
      .then((value) => {
        if (active) setAccess(value);
      })
      .catch(() => {
        if (active) {
          setAccess(null);
          setError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [auth.client, auth.loading, auth.user, revision]);
  return (
    <AccessContextState.Provider
      value={{ loading, access, error, reload: () => setRevision((v) => v + 1) }}
    >
      {children}
    </AccessContextState.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProviders required');
  return value;
}
export function useAccess() {
  const value = useContext(AccessContextState);
  if (!value) throw new Error('AuthProviders required');
  return value;
}

export function routeFor(access: AccessContext | null) {
  if (access?.kind === 'active') return '/app';
  if (access?.kind === 'invited') return '/access/invited';
  if (access?.kind === 'pending') return '/access/pending';
  return '/access/blocked';
}

export const accessStatusRedirect = (access: AccessContext | null) =>
  access?.kind === 'active' ? routeFor(access) : null;

export function PublicOnlyRoute() {
  const auth = useAuth();
  const { loading, access } = useAccess();
  if (auth.loading || (auth.user && loading)) return <Loading />;
  return auth.user ? <Navigate replace to={routeFor(access)} /> : <Outlet />;
}

export function AuthenticatedRoute() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <Loading />;
  return auth.user ? (
    <Outlet />
  ) : (
    <Navigate replace state={{ returnTo: location.pathname }} to="/login" />
  );
}
export function HouseholdRoute() {
  const { loading, access } = useAccess();
  if (loading) return <Loading />;
  return access?.kind === 'active' ? <Outlet /> : <Navigate replace to={routeFor(access)} />;
}

function Loading() {
  return (
    <main className="auth-shell" aria-busy="true">
      <section className="auth-card">불러오는 중입니다…</section>
    </main>
  );
}
export function messageForError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('rate limit')) return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
  if (normalized.includes('email not confirmed')) return '이메일 확인 후 로그인해 주세요.';
  return '이메일 또는 비밀번호를 확인해 주세요.';
}

export function LoginPage() {
  const { client, user } = useAuth();
  const { loading, access } = useAccess();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user && !loading) navigate(routeFor(access), { replace: true });
  }, [user, loading, access, navigate]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { error: authError } = await client.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    setBusy(false);
    if (authError) setError(messageForError(authError.message));
    else
      navigate(safeReturnTo((location.state as { returnTo?: string } | null)?.returnTo ?? null), {
        replace: true,
      });
  }
  return (
    <AuthCard title="로그인">
      <form onSubmit={(e) => void submit(e)}>
        <Field disabled={busy} label="이메일" type="email" value={email} onChange={setEmail} />
        <Field
          disabled={busy}
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
        />
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button disabled={busy} type="submit">
          {busy ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </AuthCard>
  );
}

export function InviteSignUpPage() {
  const { client } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: authError } = await client.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (authError) setError('가입을 처리하지 못했습니다. 입력을 확인해 주세요.');
    else navigate('/auth/check-email', { replace: true });
  }
  return (
    <AuthCard title="초대받은 가족 가입">
      <form onSubmit={(e) => void submit(e)}>
        <Field disabled={busy} label="이메일" type="email" value={email} onChange={setEmail} />
        <Field
          label="비밀번호 (6자 이상)"
          disabled={busy}
          type="password"
          value={password}
          onChange={setPassword}
        />
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button disabled={busy || password.length < 6} type="submit">
          {busy ? '가입 중…' : '가입'}
        </button>
      </form>
      <Link to="/login">로그인으로</Link>
    </AuthCard>
  );
}

export function AdminSignUpDisabledPage() {
  return (
    <AuthCard title="관리자 가입이 종료되었습니다">
      <p>최초 관리자 설정이 완료되어 새로운 관리자 계정은 만들 수 없습니다.</p>
      <p>가족 구성원은 관리자가 보낸 초대 링크로만 가입할 수 있습니다.</p>
      <Link to="/login">로그인으로</Link>
    </AuthCard>
  );
}

export function AuthCallbackPage() {
  const { loading: authLoading, user } = useAuth();
  const { loading, access } = useAccess();
  useEffect(() => {
    window.history.replaceState(null, '', '/auth/callback');
  }, []);
  if (authLoading || (user && loading)) return <Loading />;
  if (!user)
    return (
      <AuthCard title="인증을 완료하지 못했습니다">
        <p role="alert">확인 링크가 만료되었거나 올바르지 않습니다.</p>
        <Link to="/login">로그인으로</Link>
      </AuthCard>
    );
  return <Navigate replace to={routeFor(access)} />;
}
export function CheckEmailPage() {
  return (
    <AuthCard title="이메일을 확인해 주세요">
      <p>받은 편지함의 확인 링크를 누른 뒤 로그인하세요.</p>
      <Link to="/login">로그인으로</Link>
    </AuthCard>
  );
}

export function AccessStatusPage() {
  const { client, user } = useAuth();
  const { access, error: accessError, reload } = useAccess();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function logout() {
    sessionStorage.removeItem('householdInvitationToken');
    await client.auth.signOut({ scope: 'local' });
    navigate('/login', { replace: true });
  }
  async function accept() {
    const token = sessionStorage.getItem('householdInvitationToken');
    if (!token) return setError('초대 링크를 다시 열어 주세요.');
    setBusy(true);
    try {
      await createHouseholdApi(client).acceptInvitation(token, name);
      sessionStorage.removeItem('householdInvitationToken');
      reload();
      navigate('/app', { replace: true });
    } catch {
      setError('초대를 수락하지 못했습니다. 이메일과 초대 상태를 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  }
  if (accessError)
    return (
      <AuthCard title="접근 상태를 확인하지 못했습니다">
        <p role="alert">연결을 확인한 뒤 다시 시도해 주세요.</p>
        <button onClick={reload} type="button">
          다시 시도
        </button>
        <button onClick={() => void logout()} type="button">
          로그아웃
        </button>
      </AuthCard>
    );
  const redirectTo = accessStatusRedirect(access);
  if (redirectTo) return <Navigate replace to={redirectTo} />;
  const text =
    access?.kind === 'pending'
      ? '관리자 승인을 기다리고 있습니다.'
      : access?.kind === 'invited'
        ? '가족 초대를 수락해 주세요.'
        : '현재 접근 가능한 가족 공간이 없습니다.';
  return (
    <AuthCard title="접근 상태">
      <p>{text}</p>
      {user?.email && <p className="auth-session-email">현재 로그인: {user.email}</p>}
      {access?.kind === 'invited' && (
        <>
          <Field label="표시 이름" type="text" value={name} onChange={setName} />
          <button
            disabled={busy || !name.trim()}
            onClick={() => void accept()}
            type="button"
          >
            초대 수락
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="secondary-action" onClick={() => void logout()} type="button">
        로그아웃
      </button>
    </AuthCard>
  );
}

export function InvitationEntryPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    window.history.replaceState(null, '', window.location.pathname);
    if (token) sessionStorage.setItem('householdInvitationToken', token);
    navigate('/signup/invite', { replace: true });
  }, [navigate]);
  return <Loading />;
}

function Field({
  label,
  type,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        required
        disabled={disabled}
        autoComplete={type === 'password' ? 'current-password' : 'email'}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">HOME OS</p>
        <h1>{title}</h1>
        <div aria-live="polite">{children}</div>
      </section>
    </main>
  );
}
