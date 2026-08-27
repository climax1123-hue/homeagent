# auth - Design Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Completed  
> Level: Dynamic | Plan: `docs/01-plan/features/auth.plan.md`

---

## 1. Overview

### 1.1 Purpose

Supabase Auth를 이용해 이메일·비밀번호 가입, 이메일 확인, 로그인, 로그아웃과 세션 복원을 제공한다. 인증된 사용자도 DB의 최신 household 소속 상태를 통과해야 공유 데이터와 보호 화면에 접근할 수 있도록 인증과 권한 판정을 분리한다.

### 1.2 Design Goals

- 이메일 주소는 사용자에게 보이는 계정 ID로, `auth.users.id` UUID는 내부 식별자로 사용한다.
- 세션 존재 여부와 household 접근 가능 여부를 독립적인 상태로 관리한다.
- 브라우저에는 Supabase publishable key만 두고 `service_role`과 운영 비밀은 노출하지 않는다.
- 정지·탈퇴와 같은 권한 변경을 다음 DB 요청부터 RLS에 반영한다.
- PC, iPhone과 Android 브라우저에서 동일한 웹 인증 흐름을 제공한다.

### 1.3 Design Decisions

| Topic           | MVP Decision                                          | Rationale                                                        |
| --------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| 인증 방식       | 이메일 + 비밀번호 + 이메일 확인                       | 가족이 익숙하게 사용할 수 있고 이후 Google 계정 연결과 분리 가능 |
| 세션            | Supabase 기본 브라우저 세션 지속 및 자동 갱신         | 별도 세션 서버 없이 무료 클라우드 구성을 유지                    |
| 비밀번호 재설정 | MVP 이후                                              | Plan의 제외 범위를 유지하되 라우트 확장 지점은 확보              |
| 최초 관리자     | 서버 환경변수의 허용 이메일 + 1회성 Edge Function     | 공개 가입 사용자의 선점과 클라이언트 비밀 노출 방지              |
| 프로필 생성     | `auth.users` insert trigger로 최소 `profiles` 행 생성 | 가입과 프로필 생성의 누락 방지                                   |
| 접근 판정       | DB 함수가 현재 membership·invitation 상태를 반환      | JWT에 저장된 오래된 역할을 신뢰하지 않음                         |
| 라우팅          | React Router 기반 route guard                         | URL 직접 접근, 새로고침과 모바일 브라우저 이력을 일관되게 처리   |

## 2. Architecture

### 2.1 System Architecture

```text
React Web (Cloudflare Pages)
  ├─ Supabase Auth client
  │    ├─ signUp / signInWithPassword / signOut
  │    └─ INITIAL_SESSION / auth state events
  ├─ AuthProvider
  │    ├─ auth session state
  │    └─ current user
  ├─ AccessResolver
  │    └─ get_my_access_context() RPC
  └─ Route guards
       ├─ PublicOnlyRoute
       ├─ AuthenticatedRoute
       └─ HouseholdRoute
             │
             v
Supabase
  ├─ Auth: auth.users / email confirmation
  ├─ PostgreSQL: profiles + household access tables
  ├─ RLS: auth.uid() + current active membership
  └─ Edge Function: bootstrap-admin (one-time only)
```

브라우저 route guard는 사용자 경험을 위한 1차 분기다. 실제 보안 경계는 PostgreSQL RLS와 제한된 DB 함수이며 UI 상태를 조작해도 데이터 권한을 우회할 수 없다.

### 2.2 Responsibility Boundaries

| Layer / Feature | Responsibility                                               |
| --------------- | ------------------------------------------------------------ |
| Supabase Auth   | 자격 증명, 이메일 소유 확인, JWT와 refresh session 발급·폐기 |
| `auth` frontend | 인증 입력, 세션 상태, 인증 화면, 접근 상태에 따른 라우팅     |
| `auth` database | 최소 사용자 프로필과 본인 프로필 RLS                         |
| `household`     | 가정, 초대, 구성원 역할·상태, 접근 상태 판정과 관련 RLS      |
| Edge Function   | 서버 비밀이 필요한 최초 관리자 1회 부트스트랩                |

`auth` 구현은 household의 데이터 모델과 `get_my_access_context()` 계약에 의존한다. 따라서 실제 Do 단계에서는 household Design을 먼저 확정하고 공통 DB 기반을 선행 구현한다.

### 2.3 Frontend State Model

```ts
type AuthStatus = 'initializing' | 'anonymous' | 'authenticated' | 'error';

type AccessContext =
  | { kind: 'active'; householdId: string; role: 'admin' | 'member' }
  | { kind: 'invited'; invitationId: string }
  | { kind: 'pending'; requestId: string }
  | { kind: 'suspended'; householdId: string }
  | { kind: 'removed'; householdId: string }
  | { kind: 'unassigned' };
```

- `AuthProvider`는 세션과 사용자만 관리한다.
- `AccessProvider` 또는 query hook은 인증 사용자에 대해서만 접근 상태를 조회한다.
- access query cache key는 반드시 `user.id`를 포함하고 로그아웃 시 제거한다.
- auth event callback 안에서 장시간 비동기 DB 작업을 직접 기다리지 않고 상태 갱신 후 별도 effect/query가 접근 정보를 조회한다.

### 2.4 Data Flows

#### 앱 시작 및 세션 복원

1. Supabase client가 로컬 세션을 읽고 필요하면 token을 갱신한다.
2. `onAuthStateChange`의 초기 세션 이벤트로 `AuthProvider` 상태를 확정한다.
3. 세션이 없으면 `/login`, 있으면 `get_my_access_context()`를 호출한다.
4. 반환된 최신 DB 상태에 따라 active, invited, pending, blocked 또는 unassigned 화면으로 이동한다.
5. RPC 또는 업무 데이터 요청이 `401`이면 로그인으로, 권한 거절이면 접근 상태를 다시 조회한다.

#### 최초 관리자 가입

1. 사용자가 `/signup/admin`에서 이메일과 비밀번호를 입력한다.
2. 클라이언트가 `signUp`을 호출하고 확인 메일 redirect를 `/auth/callback`으로 지정한다.
3. 사용자가 메일 링크로 이메일 소유를 확인한다.
4. 인증 세션이 생성되면 unassigned 상태 화면에서 표시 이름과 가족 공간 이름을 입력하고 클라이언트가 `bootstrap-admin` Edge Function을 호출한다.
5. 함수는 JWT를 검증하고 `email_confirmed_at` 및 서버 비밀 `INITIAL_ADMIN_EMAIL`과의 정규화 이메일 일치를 확인한다.
6. 함수는 service role에만 허용된 원자적 부트스트랩 RPC를 호출한다.
7. 이미 초기화되었거나 이메일이 다르면 일반 오류만 반환하고 내부 설정값은 노출하지 않는다.

#### 초대받은 구성원 가입

1. 사용자가 household 초대 URL에서 원문 초대 토큰을 브라우저 메모리 또는 session storage에 임시 보관한다.
2. `/signup/invite`에서 초대 이메일과 동일한 이메일로 Auth 계정을 생성하고 확인한다.
3. 인증 완료 후 household의 초대 수락 RPC가 원문 토큰, 현재 `auth.uid()`와 현재 인증 이메일을 검증한다.
4. 수락 성공 후 access context를 무효화하고 다시 조회한다.

초대 토큰은 URL에서 가능한 빨리 제거하며 local storage, 분석 이벤트와 오류 로그에 저장하지 않는다.

#### 로그아웃

1. 중복 제출을 막고 `signOut({ scope: "local" })`을 호출한다.
2. auth/access query cache와 메모리의 초대 토큰을 삭제한다.
3. `/login`으로 replace 이동한다.
4. 로그아웃 API가 실패하면 세션 상태를 재확인하고 사용자에게 재시도 안내를 표시한다.

## 3. Data Model

### 3.1 `public.profiles`

`profiles`는 가정 업무 데이터가 아닌 사용자 본인 소유의 최소 인증 보조 정보이므로 `household_id`를 갖지 않는 예외 엔티티다. 공유 표시 이름 등 household별 정보는 `household_members`가 소유한다.

| Column       | Type          | Constraints / Meaning                     |
| ------------ | ------------- | ----------------------------------------- |
| `user_id`    | `uuid`        | PK, FK `auth.users(id)` on delete cascade |
| `timezone`   | `text`        | not null, default `Asia/Seoul`            |
| `created_at` | `timestamptz` | not null, default `now()`                 |
| `updated_at` | `timestamptz` | not null, default `now()`                 |

이메일은 `profiles`에 중복 저장하지 않는다. 로그인 식별과 이메일 변경의 기준은 Supabase Auth다.

### 3.2 Profile Provisioning

- `auth.users` insert trigger가 `public.profiles(user_id)`를 생성한다.
- 함수는 `security definer set search_path = ''`와 스키마 정규화를 사용한다.
- trigger 실패 시 가입 자체가 막힐 수 있으므로 로직은 최소 insert만 수행한다.
- 기존 사용자 누락 행을 보정하는 idempotent backfill migration을 포함한다.

### 3.3 RLS and Grants

```sql
alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select, update on table public.profiles to authenticated;
```

- SELECT/UPDATE `using`: `(select auth.uid()) is not null and (select auth.uid()) = user_id`
- UPDATE `with check`: `(select auth.uid()) = user_id`
- 클라이언트 INSERT/DELETE 정책은 만들지 않는다.
- `timezone`은 허용된 IANA timezone인지 DB 또는 RPC에서 검증한다. MVP UI는 `Asia/Seoul`만 제공한다.

### 3.4 Household Dependency Contract

Auth는 household 테이블을 직접 수정하지 않는다. 단, 접근 판정을 위해 household 설계가 다음 계약을 제공해야 한다.

- 현재 사용자의 active membership은 최대 1개라는 MVP 제약
- `get_my_access_context()` RPC
- 정지·탈퇴 사용자의 업무 테이블 SELECT/INSERT/UPDATE/DELETE 차단 RLS
- 유효한 초대 수락 RPC
- 마지막 관리자 보호 및 상태 변경 감사 로그

복수 household 지원 시 `active` 결과를 배열 또는 household 선택 상태로 변경하며 API version을 올린다.

## 4. API Specification

### 4.1 Supabase Auth Client Operations

| Operation | SDK call                  | Input                                         | Success behavior                            |
| --------- | ------------------------- | --------------------------------------------- | ------------------------------------------- |
| 가입      | `auth.signUp`             | normalized email, password, `emailRedirectTo` | 확인 메일 안내 또는 기존 세션 처리          |
| 로그인    | `auth.signInWithPassword` | normalized email, password                    | access context 조회 시작                    |
| 로그아웃  | `auth.signOut`            | local scope                                   | 로컬 인증·접근 상태 제거                    |
| 세션 관찰 | `auth.onAuthStateChange`  | callback                                      | initial/sign-in/sign-out/token refresh 반영 |

이메일은 trim 후 소문자로 정규화한다. 비밀번호 상세 정책은 Supabase 프로젝트 설정을 단일 기준으로 삼고 클라이언트에는 최소 길이 안내만 중복 제공한다.

### 4.2 `get_my_access_context()` RPC

household Design에서 최종 SQL을 확정한다.

**Authorization:** authenticated only  
**Input:** none; 호출자 식별은 `auth.uid()` 사용  
**Output:** 한 행

```ts
interface AccessContextRow {
  access_kind: 'active' | 'invited' | 'pending' | 'suspended' | 'removed' | 'unassigned';
  household_id: string | null;
  role: 'admin' | 'member' | null;
  invitation_id: string | null;
  request_id: string | null;
}
```

응답은 호출자에게 필요한 최소 식별자만 제공한다. 다른 사용자의 이메일이나 가정 상세 정보는 반환하지 않는다.

### 4.3 `bootstrap-admin` Edge Function

**Method:** `POST`  
**Authorization:** Supabase bearer access token required  
**Request:** `{ "householdName": string, "displayName": string }`  
**Success:** `201 { "householdId": "uuid" }`

| HTTP | Code                    | Meaning                                  |
| ---- | ----------------------- | ---------------------------------------- |
| 400  | `INVALID_INPUT`         | 이름 형식 오류                           |
| 401  | `AUTH_REQUIRED`         | 토큰 없음·유효하지 않음                  |
| 403  | `BOOTSTRAP_NOT_ALLOWED` | 이메일 미확인 또는 허용 대상 아님        |
| 409  | `ALREADY_INITIALIZED`   | 최초 가정이 이미 생성됨                  |
| 500  | `BOOTSTRAP_FAILED`      | 사용자에게 세부 DB 오류를 숨긴 서버 오류 |

서버는 access token으로 실제 사용자를 조회하고 요청 본문의 user ID나 email을 신뢰하지 않는다. `INITIAL_ADMIN_EMAIL`과 service role은 Edge Function secret으로만 저장한다. service role RPC는 임의 CRUD가 아니라 최초 가정과 관리자 관계를 한 번 생성하는 단일 트랜잭션으로 제한하고 `anon`, `authenticated`, `public`의 execute 권한을 폐기한다.

### 4.4 Error Mapping

| Domain error       | User message behavior                                   |
| ------------------ | ------------------------------------------------------- |
| 잘못된 로그인 정보 | 이메일 또는 비밀번호를 확인하도록 동일한 일반 문구 표시 |
| 이메일 미확인      | 확인 메일 확인·재전송 안내                              |
| rate limit         | 잠시 후 재시도 안내; 정확한 계정 존재 여부 숨김         |
| network            | 입력을 유지하고 연결 확인·재시도 제공                   |
| expired session    | 인증 상태 제거 후 로그인 화면 이동                      |
| access denied      | 최신 access context 재조회 후 해당 상태 화면 표시       |

내부 Supabase 오류 메시지, SQL, 토큰과 계정 존재 여부를 화면이나 분석 로그에 그대로 출력하지 않는다.

## 5. UI and Routing

### 5.1 Routes

| Route               | Guard                      | Purpose                                       |
| ------------------- | -------------------------- | --------------------------------------------- |
| `/login`            | public only                | 이메일·비밀번호 로그인                        |
| `/invite#token=…`   | public                     | 초대 토큰을 session storage로 옮기고 URL 정리 |
| `/signup/admin`     | public/bootstrap available | 최초 관리자 가입                              |
| `/signup/invite`    | public/invite token        | 초대 사용자 가입                              |
| `/auth/check-email` | public                     | 이메일 확인 안내와 제한된 재전송              |
| `/auth/callback`    | public                     | 이메일 확인 결과 처리 후 민감 query/hash 제거 |
| `/access/invited`   | authenticated              | 초대 수락 계속하기                            |
| `/access/pending`   | authenticated              | 승인 대기 안내                                |
| `/access/blocked`   | authenticated              | 정지·탈퇴·미소속 안내                         |
| `/app/*`            | active household           | 가정 공유 기능                                |

### 5.2 Guard Rules

1. `initializing` 동안 전체 화면 skeleton을 표시하고 잘못된 로그인 redirect를 하지 않는다.
2. 비로그인 사용자가 보호 route에 접근하면 원래 내부 경로만 검증된 `returnTo`로 보존하고 `/login`으로 보낸다.
3. 로그인 사용자가 `/login`에 접근하면 access context에 맞는 경로로 보낸다.
4. active가 아닌 사용자는 `/app/*`에 머물 수 없다.
5. RLS가 최종 권한을 결정하며 guard 결과를 데이터 요청의 증거로 사용하지 않는다.

### 5.3 Responsive and Accessibility

- 입력과 버튼의 주요 터치 영역은 최소 44px이다.
- 모바일은 한 열, PC는 최대 폭이 제한된 인증 카드 레이아웃을 사용한다.
- label, 오류 설명 연결, 키보드 focus, `aria-live` 상태 안내를 제공한다.
- 제출 중 버튼과 입력을 비활성화하고 spinner와 텍스트를 함께 표시한다.
- 오류는 색상만으로 구분하지 않는다.

## 6. Planned File Structure

```text
apps/web/src/
  app/
    router.tsx
    providers.tsx
  features/auth/
    api/auth-api.ts
    components/AuthForm.tsx
    hooks/use-auth.ts
    model/auth-types.ts
    pages/LoginPage.tsx
    pages/AdminSignUpPage.tsx
    pages/InviteSignUpPage.tsx
    pages/AuthCallbackPage.tsx
    pages/CheckEmailPage.tsx
    routes/AuthenticatedRoute.tsx
    routes/HouseholdRoute.tsx
    utils/normalize-email.ts
  features/access/
    api/access-api.ts
    hooks/use-access-context.ts
    pages/AccessStatusPage.tsx
  lib/supabase/client.ts
  config/public-env.ts

supabase/
  migrations/<timestamp>_create_auth_profiles.sql
  migrations/<timestamp>_create_auth_profile_rls.sql
  functions/bootstrap-admin/index.ts
  tests/auth_profiles_rls.test.sql
```

실제 migration은 기존 파일을 수정하지 않고 새 파일로만 추가한다. household 관련 함수와 테스트 파일은 household Design의 파일 구조를 따른다.

## 7. Implementation Order

1. household Design을 완료해 membership 상태, invitation과 접근 RPC 계약을 확정한다.
2. `@supabase/supabase-js`, router와 필요한 query/state 의존성을 결정·설치한다.
3. 새 migration으로 profiles, provisioning trigger, grants와 RLS를 추가한다.
4. Supabase client, 공개 환경변수 검증과 auth/access TypeScript 모델을 만든다.
5. AuthProvider와 access query를 구현한다.
6. 로그인·가입·callback·상태 화면과 route guards를 구현한다.
7. 최초 관리자 Edge Function과 제한된 DB RPC를 구현한다.
8. 단위, 통합, RLS와 E2E 테스트를 추가한다.
9. Supabase Redirect URL, Site URL, 이메일 확인과 함수 secret 운영 설정을 문서화한다.
10. `pnpm check`, production build와 PC·모바일 브라우저 검증을 수행한다.

## 8. Test Plan

### 8.1 Unit Tests

- 이메일 trim·소문자 정규화
- Supabase 오류의 안전한 사용자 메시지 변환
- auth/access 상태별 redirect 결정
- 허용되지 않은 외부 `returnTo` 차단
- 중복 제출 방지와 loading/error 렌더링

### 8.2 Component and Integration Tests

- 초기 세션 확인 전 로그인 화면이 순간 노출되지 않음
- 로그인 성공 후 access context 조회 및 active route 이동
- 로그인 실패 시 비밀번호와 Supabase 원문 오류를 노출하지 않음
- invited, pending, suspended, removed, unassigned 각각의 화면 이동
- 로그아웃 후 cache 제거와 보호 route 차단
- access RPC 권한 오류 후 최신 상태 재조회

### 8.3 Database and RLS Tests

- 익명 사용자의 profiles 접근 차단
- 인증 사용자의 본인 profile SELECT/UPDATE 허용
- 다른 사용자의 profile SELECT/UPDATE 차단
- profiles 클라이언트 INSERT/DELETE 차단
- 사용자 생성 시 profile 생성 및 중복 실행 안전성
- active membership만 household 업무 데이터 접근 허용
- pending, suspended, removed 및 다른 household 접근 차단
- 상태 변경 후 같은 기존 JWT의 다음 요청 차단
- security definer 함수의 `search_path` 고정과 execute grant 제한

### 8.4 Edge Function Tests

- 토큰 없음·위조 토큰 차단
- 이메일 미확인 사용자 차단
- 환경변수 허용 이메일 불일치 차단
- 최초 허용 관리자 성공
- 동시 2회 호출 중 정확히 1회만 성공
- 초기화 이후 재호출 409
- 응답과 로그에 허용 이메일, service role, SQL 오류 미노출

### 8.5 E2E and Responsive Tests

- 관리자 가입 → 이메일 확인 → 최초 가정 생성 → `/app` 진입
- 초대 사용자 가입 → 이메일 확인 → 초대 수락 → `/app` 진입
- 비로그인 보호 URL 접근 → 로그인 → 안전한 원래 경로 복귀
- 로그아웃 및 새로고침 후 보호 route 차단
- 관리자 정지·탈퇴 처리 후 해당 사용자의 다음 요청 차단
- 데스크톱, iPhone, Android 대표 viewport에서 form overflow 없음과 44px 터치 영역 확인

실제 이메일, 가족 개인정보와 운영 토큰은 fixture로 사용하지 않는다. 테스트 계정은 예약 도메인과 매 실행 고유값을 사용한다.

## 9. Security Considerations

- production에서는 이메일 확인을 활성화하고 Site URL과 Redirect URL을 명시적 허용 목록으로 제한한다.
- wildcard redirect는 로컬 또는 preview 환경에 필요한 최소 범위에서만 사용한다.
- 클라이언트 환경변수에는 Supabase URL과 publishable key만 둔다.
- `service_role`, `INITIAL_ADMIN_EMAIL`, OAuth refresh token은 Edge Function secret으로 관리한다.
- RLS는 `(select auth.uid())`와 DB의 현재 membership 상태를 사용하며 user metadata의 role을 권한 근거로 사용하지 않는다.
- 모든 `security definer` 함수는 `set search_path = ''`, 완전한 스키마 이름, 최소 execute grant를 적용한다.
- access token, refresh token, 비밀번호, 초대 토큰을 console·analytics·error payload에 기록하지 않는다.
- 로그인 오류 문구는 계정 존재 여부를 추측할 수 없도록 통일하고 재시도 제한을 존중한다.
- 인증 callback 처리 뒤 민감 query 또는 fragment를 browser history에서 replace한다.
- CSP, HTTPS, 보안 헤더와 의존성 검토는 보안 단계에서 추가하되 인증 구현 시 위험한 inline script를 도입하지 않는다.

## 10. Operations and Configuration

### 10.1 Browser Environment

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_APP_URL`

빌드 시작 시 누락·형식 오류를 검증한다. `.env.example`에는 이름과 설명만 두고 실제 값은 커밋하지 않는다.

### 10.2 Edge Function Secrets

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` 또는 publishable server usage key
- `SUPABASE_SERVICE_ROLE_KEY`
- `INITIAL_ADMIN_EMAIL`

### 10.3 Supabase Dashboard

- Confirm Email: production enabled
- Site URL: production Cloudflare Pages canonical URL
- Redirect URLs: local, production, 필요한 preview URL만 등록
- Email provider: 개발 초기 기본 발송을 사용할 수 있으나 production 전에 custom SMTP와 발송 한도를 검토
- public signup: 최초 관리자와 초대 가입 흐름을 지원하되 앱 및 household 수락 정책으로 데이터 접근은 차단

## 11. Requirement Traceability

| Plan ID     | Design Coverage                                   |
| ----------- | ------------------------------------------------- |
| AUTH-FR-001 | 이메일 정규화, Auth operation, UI form            |
| AUTH-FR-002 | `auth.users.id`, profiles PK/FK, `auth.uid()` RLS |
| AUTH-FR-003 | 관리자 가입 및 `bootstrap-admin` 흐름             |
| AUTH-FR-004 | 초대 가입 및 household 초대 수락 계약             |
| AUTH-FR-005 | sign-in/sign-out API와 화면                       |
| AUTH-FR-006 | AuthProvider 초기 세션 상태와 auth event 처리     |
| AUTH-FR-007 | `get_my_access_context()` 및 AccessProvider       |
| AUTH-FR-008 | HouseholdRoute와 active membership RLS            |
| AUTH-FR-009 | access 상태 모델, 차단 route와 RLS 테스트         |
| AUTH-FR-010 | 오류 매핑과 상태별 안내 화면                      |

## 12. Deferred Items

- Google OAuth 및 기존 이메일 계정과의 명시적 연결
- Google Calendar OAuth 권한 요청
- 비밀번호 재설정, MFA와 재인증 UX
- 복수 household 선택
- 관리자 계정 분실 복구와 복수 관리자 정책
- Google 사용자의 household 가입 요청

## 12.1 Implementation Decisions

- 최초 관리자 bootstrap은 이메일 callback에서 자동 실행하지 않는다. household member의 필수 `display_name`을 안전하게 입력받기 위해 인증 후 `unassigned` 화면에서 명시적으로 실행한다.
- 초대 메일의 `/invite#token=…` route는 hash를 즉시 제거하고 원문 token을 session storage에만 보관한다.
- publishable key 전환 기간에는 `VITE_SUPABASE_ANON_KEY`를 호환 fallback으로 허용하되 신규 환경은 `VITE_SUPABASE_PUBLISHABLE_KEY`를 우선한다.
- Edge Function은 `APP_URL`과 `ALLOWED_ORIGINS` 기반 CORS allowlist를 사용한다.

## 13. References

- `docs/01-plan/features/auth.plan.md`
- `docs/01-plan/features/household.plan.md`
- `docs/features/auth.md`
- `docs/features/household.md`
- `docs/architecture/authorization.md`
- `docs/architecture/overview.md`
- Supabase Password-based Auth: <https://supabase.com/docs/guides/auth/passwords>
- Supabase Redirect URLs: <https://supabase.com/docs/guides/auth/redirect-urls>
- Supabase Row Level Security: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase JavaScript auth state changes: <https://supabase.com/docs/reference/javascript/auth-onauthstatechange>
