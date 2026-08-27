# household - Design Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Completed  
> Level: Dynamic | Plan: `docs/01-plan/features/household.plan.md`

---

## 1. Overview

### 1.1 Purpose

`household`를 모든 가족 공유 데이터의 최상위 보안 경계로 정의하고, 최초 가정 생성, 이메일 초대, 구성원 상태 관리와 감사 기록을 Supabase PostgreSQL, RLS, 제한된 RPC와 Edge Function으로 구현한다.

### 1.2 Design Goals

- 모든 업무 데이터 접근을 현재 `household_members`의 역할과 상태로 판정한다.
- 초대와 상태 변경을 원자적이고 재사용 불가능한 DB 작업으로 만든다.
- 관리자 UI뿐 아니라 DB 계층에서도 일반 구성원과 다른 가정 사용자를 차단한다.
- 정지·탈퇴 상태를 기존 JWT 갱신 없이 다음 DB 요청부터 반영한다.
- 인증 공급자와 이메일 발송 공급자를 household 도메인에서 분리한다.
- 향후 Google 가입 요청과 복수 관리자 정책을 추가할 수 있게 한다.

### 1.3 MVP Policy Decisions

| Topic               | Decision                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| 관리자              | 최초 관리자 1명으로 시작하고 역할 변경 API는 제공하지 않음               |
| 복수 관리자 확장    | DB role은 `admin/member`를 지원하되 승격·위임은 후속 기능                |
| 초대 유효기간       | 생성 시점부터 7일, 사용자 임의 변경 불가                                 |
| 재초대              | 기존 초대가 만료·취소된 뒤 새 초대 생성                                  |
| 탈퇴 사용자 재가입  | MVP에서는 차단; 기존 membership 행과 이력 유지                           |
| 자발적 탈퇴         | 제공하지 않음; 관리자 처리만 가능                                        |
| 자기 자신 상태 변경 | 차단                                                                     |
| 감사 로그 보존      | MVP에서는 삭제하지 않으며 클라이언트 직접 수정·삭제 불가                 |
| 이메일 전송         | Edge Function 뒤에 공급자 adapter를 두고 공급자 최종 선택은 배포 전 결정 |

## 2. Architecture

### 2.1 System Architecture

```text
React Web
  ├─ Household settings UI
  ├─ Supabase client queries
  └─ Edge Function invocation
       │
       ├─ create-household-invitation
       │    ├─ caller JWT verification
       │    ├─ create_household_invitation() RPC
       │    └─ email provider adapter
       │
       └─ bootstrap-admin (auth Design)
            └─ bootstrap_initial_household() privileged RPC

Supabase PostgreSQL
  ├─ households
  ├─ household_members
  ├─ household_invitations
  ├─ audit_logs
  ├─ private authorization helpers
  ├─ public restricted RPCs
  └─ RLS on every public table
```

조회는 필요한 범위에서 RLS가 적용된 테이블 또는 read RPC를 사용한다. 초대 수락, 구성원 상태 변경, 최초 가정 생성처럼 여러 검증과 쓰기가 결합된 작업은 DB RPC의 한 트랜잭션으로 처리한다.

### 2.2 Responsibility Boundaries

| Layer              | Responsibility                                                |
| ------------------ | ------------------------------------------------------------- |
| React UI           | 입력, 확인 대화상자, loading/error, cache 무효화, 반응형 표시 |
| Edge Function      | JWT 검증, 서버 비밀, 초대 이메일 전송과 전송 상태 갱신        |
| Public RPC         | 호출자·입력·상태 전이 검증과 원자적 mutation                  |
| Private DB helpers | 현재 active member/admin 여부의 단일 판정 로직                |
| RLS                | 테이블 직접 접근과 다른 가정 우회 차단                        |
| Audit function     | mutation과 같은 트랜잭션 안에서 변경 이력 append              |

### 2.3 Primary Flows

#### 최초 가정 생성

1. auth Design의 `bootstrap-admin`이 확인된 사용자와 허용 이메일을 검증한다.
2. service role에만 허용된 `bootstrap_initial_household(user_id, name)`을 호출한다.
3. RPC가 transaction advisory lock을 획득하고 기존 household가 없는지 다시 검사한다.
4. `households`와 최초 `active admin` membership을 함께 생성한다.
5. `household.created`와 `member.joined` 감사 로그를 남긴다.
6. 일부 작업이 실패하면 전체 transaction을 rollback한다.

#### 초대 생성과 발송

1. 관리자가 이메일을 입력하고 Edge Function을 호출한다.
2. 함수는 access token으로 사용자를 확인하고 브라우저가 보낸 actor ID를 사용하지 않는다.
3. 사용자 JWT를 전달한 Supabase client로 `create_household_invitation` RPC를 호출한다.
4. RPC가 현재 active admin, 이메일 정규화, 구성원·유효 초대 중복을 검사한다.
5. DB가 256-bit 무작위 원문 토큰을 만들고 SHA-256 해시만 저장한 뒤 원문을 호출자에게 한 번 반환한다.
6. Edge Function이 `${APP_URL}/invite#token=...` 형식의 링크를 이메일로 전송한다.
7. 전송 성공·실패 상태를 제한된 RPC로 갱신한다. 실패한 초대는 자동 취소하며 관리자는 새 token으로 다시 초대할 수 있다.

원문 토큰은 Edge Function 응답, DB 로그와 브라우저 관리자 화면에 반환하지 않는다.

#### 초대 수락

1. 초대받은 사용자가 링크를 열면 앱이 fragment의 토큰을 session memory에 옮기고 URL에서 제거한다.
2. 사용자가 가입·이메일 확인·로그인을 완료한다.
3. `accept_household_invitation(raw_token)`을 호출한다.
4. RPC가 token hash, `pending`, 만료 시각, 현재 인증 사용자와 auth 이메일을 검증한다.
5. 기존 membership 및 다른 비종료 membership 충돌을 검사한다.
6. `active member` 생성과 invitation `accepted` 전이를 한 transaction으로 처리한다.
7. 감사 로그를 기록하고 access context를 다시 조회한다.

#### 구성원 상태 변경

1. 관리자가 대상과 새 상태를 선택하고 영향을 확인한다.
2. `change_household_member_status(member_id, target_status)`를 호출한다.
3. RPC가 같은 가정의 active admin, 대상 일반 구성원, 허용 상태 전이를 검증한다.
4. 상태, 처리자와 처리 시각을 갱신하고 감사 로그를 남긴다.
5. 대상 사용자의 다음 업무 요청은 RLS에서 즉시 차단된다.

## 3. Data Model

### 3.1 PostgreSQL Types

```sql
household_role              = 'admin' | 'member'
household_member_status     = 'active' | 'suspended' | 'removed'
household_invitation_status = 'pending' | 'accepted' | 'expired' | 'cancelled'
invitation_delivery_status  = 'queued' | 'sent' | 'failed'
```

PostgreSQL enum 또는 동일한 check constraint 중 한 방식을 migration에서 일관되게 사용한다. 외부 TypeScript 타입은 생성된 Supabase DB 타입에서 파생한다.

### 3.2 `public.households`

| Column       | Type          | Constraints / Meaning         |
| ------------ | ------------- | ----------------------------- |
| `id`         | `uuid`        | PK, `gen_random_uuid()`       |
| `name`       | `text`        | not null, trim 길이 1..80     |
| `created_by` | `uuid`        | not null, FK `auth.users(id)` |
| `created_at` | `timestamptz` | not null, default `now()`     |
| `updated_at` | `timestamptz` | not null, default `now()`     |

MVP에서는 삭제 API를 제공하지 않는다. 모든 하위 업무 테이블이 `household_id`를 FK로 가진다.

### 3.3 `public.household_members`

| Column              | Type          | Constraints / Meaning                    |
| ------------------- | ------------- | ---------------------------------------- |
| `id`                | `uuid`        | PK                                       |
| `household_id`      | `uuid`        | not null, FK households, delete restrict |
| `user_id`           | `uuid`        | not null, FK auth.users, delete restrict |
| `display_name`      | `text`        | not null, trim 길이 1..50                |
| `role`              | role          | not null                                 |
| `status`            | member status | not null                                 |
| `joined_at`         | `timestamptz` | not null                                 |
| `status_changed_at` | `timestamptz` | not null                                 |
| `status_changed_by` | `uuid`        | nullable FK auth.users                   |
| `removed_at`        | `timestamptz` | nullable; removed일 때만 값 존재         |
| `created_at`        | `timestamptz` | not null                                 |
| `updated_at`        | `timestamptz` | not null                                 |

제약과 인덱스:

- unique `(household_id, user_id)`로 동일 가정 관계 중복 방지
- MVP에서 사용자당 `active` 또는 `suspended` membership 최대 1개를 보장하는 partial unique index
- `(household_id, status)`, `(user_id, status)` 조회 인덱스
- `removed`는 terminal 상태이며 행을 삭제하지 않음
- `role` 변경 RPC는 제공하지 않음

### 3.4 `public.household_invitations`

| Column              | Type              | Constraints / Meaning            |
| ------------------- | ----------------- | -------------------------------- |
| `id`                | `uuid`            | PK                               |
| `household_id`      | `uuid`            | not null, FK households          |
| `invitee_email`     | `citext`          | not null, trim된 정규화 이메일   |
| `token_hash`        | `bytea`           | not null, unique, SHA-256        |
| `status`            | invitation status | not null, default pending        |
| `delivery_status`   | delivery status   | not null, default queued         |
| `delivery_attempts` | `smallint`        | not null, default 0, nonnegative |
| `last_delivery_at`  | `timestamptz`     | nullable                         |
| `created_by`        | `uuid`            | not null, FK auth.users          |
| `expires_at`        | `timestamptz`     | not null, 생성 시각 + 7일        |
| `accepted_by`       | `uuid`            | nullable FK auth.users           |
| `accepted_at`       | `timestamptz`     | nullable                         |
| `cancelled_by`      | `uuid`            | nullable FK auth.users           |
| `cancelled_at`      | `timestamptz`     | nullable                         |
| `created_at`        | `timestamptz`     | not null                         |
| `updated_at`        | `timestamptz`     | not null                         |

제약과 인덱스:

- pending 이메일 중복은 RPC가 먼저 만료 전이를 수행한 뒤 unique partial index `(household_id, invitee_email) where status = 'pending'`으로 최종 방어
- terminal status의 처리자·처리시각 정합성 check
- `expires_at > created_at`
- 초대 목록 인덱스 `(household_id, created_at desc)`
- access resolver 인덱스 `(invitee_email, status, expires_at)`

만료는 초대 조회, 생성, 수락 시 `pending`이면서 `expires_at <= now()`인 행을 `expired`로 바꾸는 지연 전이 방식이다. 추후 scheduled job을 추가해도 동일 전이 함수를 사용한다.

### 3.5 `public.audit_logs`

| Column           | Type          | Constraints / Meaning                 |
| ---------------- | ------------- | ------------------------------------- |
| `id`             | `uuid`        | PK                                    |
| `household_id`   | `uuid`        | not null, FK households               |
| `action`         | `text`        | not null, 허용 action check           |
| `actor_user_id`  | `uuid`        | nullable FK auth.users                |
| `target_type`    | `text`        | not null: household/member/invitation |
| `target_id`      | `uuid`        | not null                              |
| `target_user_id` | `uuid`        | nullable FK auth.users                |
| `metadata`       | `jsonb`       | not null, default `{}`                |
| `created_at`     | `timestamptz` | not null                              |

`metadata` 허용 목록에는 이전·새 상태, 실패하지 않은 delivery 결과 코드 등 비민감 정보만 포함한다. 이메일, 원문·해시 토큰, 인증 정보와 오류 stack은 저장하지 않는다. 클라이언트의 INSERT/UPDATE/DELETE 권한은 모두 폐기한다.

### 3.6 Relationships

```text
auth.users 1 ── 0..* household_members * ── 1 households
auth.users 1 ── 0..* household_invitations.created_by
households 1 ── 0..* household_invitations
households 1 ── 0..* audit_logs
```

향후 `household_join_requests`는 household와 requester user를 참조하는 독립 테이블로 추가하며 invitation을 재사용하지 않는다.

## 4. Authorization and RLS

### 4.1 Private Helpers

`private` schema에 다음 stable helper를 둔다.

- `private.is_active_household_member(household_id uuid) returns boolean`
- `private.is_active_household_admin(household_id uuid) returns boolean`
- `private.current_auth_email() returns citext`

모든 helper는 `security definer`, `set search_path = ''`, 완전한 schema 이름을 사용한다. `private` schema는 Data API 노출 목록에 포함하지 않고 `anon`과 `public`의 권한을 폐기한다. RLS policy가 평가될 수 있도록 `authenticated`에는 필요한 schema usage와 정확한 helper signature의 execute만 부여한다. 따라서 브라우저 RPC로 직접 호출할 수 없지만 policy 내부에서는 사용할 수 있다. `auth.jwt()`의 role metadata 대신 `auth.uid()`와 현재 DB 행을 사용한다.

### 4.2 Table Policy Matrix

| Table                 | SELECT                                   | INSERT/UPDATE/DELETE direct access |
| --------------------- | ---------------------------------------- | ---------------------------------- |
| households            | 해당 household active member             | 모두 차단; 제한 RPC만 사용         |
| household_members     | 본인 행 또는 같은 household active admin | 모두 차단; 제한 RPC만 사용         |
| household_invitations | 같은 household active admin              | 모두 차단; 제한 RPC만 사용         |
| audit_logs            | MVP 클라이언트 조회 없음                 | 모두 차단                          |

모든 테이블은 RLS를 활성화하고 `anon`의 table grant를 폐기한다. 필요한 `authenticated SELECT`만 명시적으로 grant한다. public schema의 새 업무 테이블에는 RLS 누락을 검출하는 CI/DB test를 둔다.

### 4.3 Reusable Business-table Policy

향후 일정·가계부·디데이·목표 테이블은 최소 다음 형태를 사용한다.

```sql
to authenticated
using ((select private.is_active_household_member(household_id)))
with check ((select private.is_active_household_member(household_id)))
```

테이블별 작성자·관리자 규칙이 필요하면 이 기본 household 경계 위에 추가한다. 클라이언트가 전달한 household ID만으로 허용하지 않는다.

## 5. RPC and Edge API Specification

### 5.1 RPC Summary

| Function                         | Caller                | Purpose                              |
| -------------------------------- | --------------------- | ------------------------------------ |
| `bootstrap_initial_household`    | service role only     | 최초 가정과 admin 원자적 생성        |
| `get_my_access_context`          | authenticated         | 현재 membership/invitation 상태 조회 |
| `create_household_invitation`    | active admin via Edge | 초대 생성과 원문 토큰 1회 반환       |
| `mark_invitation_delivery`       | service role only     | 이메일 전송 결과 기록                |
| `cancel_household_invitation`    | active admin          | pending 초대 취소                    |
| `accept_household_invitation`    | authenticated         | token·email 검증 후 member 생성      |
| `change_household_member_status` | active admin          | member 상태 전이                     |
| `update_my_household_profile`    | active member         | 본인 display name 수정               |

모든 exposed RPC는 고정 search path, 명시적 argument 타입, 최소 execute grant를 적용한다. mutation은 domain error code를 반환하고 SQL 세부 정보를 숨긴다.

### 5.2 `get_my_access_context()`

입력 없이 `auth.uid()`를 사용한다. 우선순위는 현재 non-removed membership, 본인 이메일의 유효 pending invitation, 향후 pending join request, 과거 removed membership, unassigned 순서다.

```ts
type AccessContextRow = {
  access_kind: 'active' | 'invited' | 'pending' | 'suspended' | 'removed' | 'unassigned';
  household_id: string | null;
  role: 'admin' | 'member' | null;
  invitation_id: string | null;
  request_id: string | null;
};
```

동일 이메일에 여러 가정의 초대가 있으면 만료가 가장 임박한 유효 초대 하나만 안내한다. 실제 수락에는 원문 토큰이 필요하다.

### 5.3 Invitation Commands

#### Create Edge Function

`POST /functions/v1/create-household-invitation`

```json
{
  "householdId": "uuid",
  "email": "person@example.com"
}
```

MVP는 메일 전송 결과를 기다린 뒤 성공 시 `202 { "invitationId": "uuid", "deliveryStatus": "sent", "expiresAt": "timestamp" }`를 반환한다. 원문 token과 정규화된 이메일은 응답하지 않는다. 전송 실패는 상태를 기록하고 초대를 취소해 새 초대를 생성할 수 있게 한다.

#### Cancel RPC

`cancel_household_invitation(p_invitation_id uuid)`는 같은 가정 active admin과 pending·미처리 상태를 확인하고 cancelled로 전이한다.

#### Accept RPC

`accept_household_invitation(p_raw_token text, p_display_name text)`는 현재 인증 사용자의 확인된 이메일을 `auth.users`에서 읽어 비교한다. 성공 시 household ID를 반환하며 원문 token을 어디에도 기록하지 않는다.

### 5.4 Member Status Command

`change_household_member_status(p_member_id uuid, p_target_status household_member_status)`

허용 전이:

```text
active    -> suspended | removed
suspended -> active | removed
removed   -> (none in MVP)
```

대상은 `member` role이어야 하며 actor 자신, 다른 household와 admin role 대상은 거절한다.

### 5.5 Domain Error Codes

| Code                            | Meaning                                 |
| ------------------------------- | --------------------------------------- |
| `AUTH_REQUIRED`                 | 인증 사용자 없음                        |
| `ADMIN_REQUIRED`                | active admin 아님                       |
| `HOUSEHOLD_NOT_FOUND`           | 접근 가능한 가정 없음                   |
| `MEMBER_ALREADY_EXISTS`         | 동일 가정 membership 존재               |
| `OTHER_HOUSEHOLD_MEMBERSHIP`    | MVP에서 다른 non-removed 가정 관계 존재 |
| `INVITATION_ALREADY_PENDING`    | 동일 가정·이메일 유효 초대 존재         |
| `INVITATION_INVALID`            | 존재하지 않거나 token 불일치            |
| `INVITATION_EXPIRED`            | 만료됨                                  |
| `INVITATION_NOT_PENDING`        | 이미 수락·취소됨                        |
| `INVITATION_EMAIL_MISMATCH`     | 현재 인증 이메일과 초대 이메일 불일치   |
| `INVALID_STATUS_TRANSITION`     | 허용되지 않은 상태 전이                 |
| `SELF_MANAGEMENT_FORBIDDEN`     | 자기 자신 상태 변경                     |
| `REMOVED_MEMBER_REJOIN_BLOCKED` | 탈퇴 사용자 재가입 정책 미정            |

존재 여부 노출 위험이 있는 비관리자 흐름에서는 UI가 상세 코드를 일반적인 초대 오류로 매핑한다.

## 6. Frontend Design

### 6.1 Routes

| Route                         | Guard                | Screen                              |
| ----------------------------- | -------------------- | ----------------------------------- |
| `/settings/household`         | active member        | 가정 기본 정보와 본인 정보          |
| `/settings/household/members` | active admin         | 구성원·초대 관리                    |
| `/invite`                     | public/authenticated | token 보관 후 가입·로그인·수락 분기 |
| `/access/invited`             | authenticated        | 초대 수락 및 표시 이름 입력         |
| `/access/blocked`             | authenticated        | suspended/removed/unassigned 안내   |

일반 구성원이 관리자 URL을 직접 열면 접근 거절 안내 후 household 기본 화면으로 이동한다.

### 6.2 Member Management UI

- PC: 구성원 표와 우측 초대 panel 또는 modal
- 모바일: 구성원 card 목록과 전체 폭 초대 form
- 상태 badge: 활성, 정지, 탈퇴
- 초대 목록: 이메일 일부 마스킹, 만료 시각, 전송 상태와 취소 action. 전송 실패 시 자동 취소 후 새 초대를 생성한다.
- 정지·탈퇴는 결과를 설명하는 확인 dialog를 거친다.
- 탈퇴 확인은 파괴적 action으로 명확히 구분하되 membership을 실제 삭제하지 않는다.
- mutation 중 동일 action을 비활성화하고 완료 후 members, invitations, access context cache를 무효화한다.
- 주요 버튼과 card action은 최소 44px 터치 영역을 가진다.

### 6.3 Client Types

```ts
type HouseholdRole = 'admin' | 'member';
type HouseholdMemberStatus = 'active' | 'suspended' | 'removed';
type HouseholdInvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';
```

DB enum과 RPC 결과 타입을 수동으로 중복 정의하기보다 Supabase 생성 타입과 `packages/shared`의 domain 타입을 연결한다.

## 7. Planned File Structure

```text
apps/web/src/features/household/
  api/household-api.ts
  components/InvitationForm.tsx
  components/InvitationList.tsx
  components/MemberCard.tsx
  components/MemberTable.tsx
  components/MemberStatusDialog.tsx
  hooks/use-household.ts
  hooks/use-household-members.ts
  hooks/use-household-invitations.ts
  model/household-types.ts
  pages/HouseholdSettingsPage.tsx
  pages/MemberManagementPage.tsx
  pages/AcceptInvitationPage.tsx

packages/shared/src/household/
  errors.ts
  types.ts

supabase/
  migrations/<timestamp>_create_household_types_and_tables.sql
  migrations/<timestamp>_create_household_authorization_helpers.sql
  migrations/<timestamp>_create_household_rpcs.sql
  migrations/<timestamp>_create_household_rls.sql
  functions/create-household-invitation/index.ts
  functions/_shared/email-provider.ts
  tests/household_rls.test.sql
  tests/household_rpcs.test.sql
```

실제 구현에서는 기존 migration을 수정하지 않고 새 migration만 추가한다. migration 간 의존 순서는 timestamp와 명시적 파일 목적에 맞춘다.

## 8. Implementation Order

1. enum/check, households, members, invitations와 audit log migration을 추가한다.
2. private authorization·email helper와 감사 append 함수를 추가한다.
3. bootstrap, access context, invitation과 member 상태 RPC를 추가한다.
4. grants와 모든 public household 테이블 RLS를 추가한다.
5. SQL 기반 제약·RPC·RLS 테스트를 먼저 실행한다.
6. shared TypeScript domain types와 안전한 error mapping을 추가한다.
7. household query/mutation API와 cache hooks를 구현한다.
8. 설정, 구성원, 초대와 수락 UI를 PC·모바일에 구현한다.
9. 초대 Edge Function과 email adapter, 전송 상태 처리를 구현한다.
10. auth의 access resolver와 route guard를 household RPC에 연결한다.
11. component·integration·E2E 테스트와 운영 설정 문서를 추가한다.
12. `pnpm check`, production build와 RLS 회귀 테스트를 수행한다.

## 9. Test Plan

### 9.1 Database Constraints

- 가정과 최초 관리자 원자적 생성 및 동시 bootstrap 1회만 성공
- 동일 household/user membership 중복 차단
- 사용자당 복수 non-removed membership 차단
- 상태와 처리 시각 check constraint
- 동일 가정·이메일 pending 초대 중복 차단
- 원문이 아닌 hash만 invitation에 저장됨
- removed membership hard delete 권한 없음

### 9.2 RPC and RLS Tests

- 익명 사용자의 모든 household 테이블 접근 차단
- active member의 본인 household 조회 허용
- member의 다른 구성원 목록·초대 조회와 모든 관리자 mutation 차단
- active admin의 같은 가정 구성원·초대 조회 허용
- 다른 가정 admin의 조회·수정 차단
- pending, suspended, removed 사용자의 업무 데이터 접근 차단
- 상태 변경 후 동일 access token의 다음 요청 차단
- 초대 정상 생성·취소·수락
- 중복, 만료, 취소, 재사용, email mismatch token 차단
- self status change, admin target과 removed 전이 차단
- 모든 mutation의 감사 로그 생성과 민감 metadata 부재
- helper와 RPC execute grant 및 고정 search path 검사

### 9.3 Edge Function Tests

- JWT 없음·위조 JWT 차단
- member와 다른 household admin 초대 생성 차단
- 이메일 정규화와 입력 길이 검증
- RPC 원문 token이 브라우저 응답·로그에 노출되지 않음
- 이메일 성공 시 sent, 실패 시 failed와 attempts 갱신
- 동일 idempotency key 재시도 시 중복 초대·메일 억제
- 공급자 timeout에서 안전한 재시도 가능

### 9.4 UI and Integration Tests

- admin에게만 구성원 관리 메뉴와 초대 action 표시
- 일반 구성원의 관리자 URL 직접 접근 차단
- PC table과 모바일 card의 동일 정보·action 제공
- 초대 중복·실패·취소·만료 메시지 매핑
- 상태 변경 확인 dialog와 optimistic update 미사용
- mutation 중 중복 제출 차단과 성공 후 cache 갱신
- 이메일 마스킹과 접근 가능한 label/error/focus 처리

### 9.5 E2E Scenarios

- 최초 관리자 생성 → 배우자 초대 → 이메일 링크 → 가입·확인 → 수락 → 공유 화면 진입
- 초대 취소 후 기존 링크 수락 차단
- 만료 초대 재발송 후 새 링크만 성공
- 구성원 정지·재활성화·탈퇴와 즉시 접근 변화
- 악의적 household/member/invitation ID 교체 시 데이터 미노출
- iPhone, Android와 PC viewport에서 핵심 흐름 완료

실제 금융자료, 실제 가족 이메일, 운영 token과 개인정보는 fixture나 snapshot에 포함하지 않는다.

## 10. Security and Privacy

- 초대 token은 최소 256-bit CSPRNG로 생성하고 SHA-256 hash만 DB에 저장한다.
- 초대 링크 token은 fragment 또는 즉시 제거되는 callback 값으로 전달하며 referrer, analytics와 server access log 노출을 막는다.
- 브라우저는 `service_role`, email provider key와 최초 관리자 허용 이메일을 알 수 없다.
- Edge Function은 bearer token을 검증하고 user ID/email/role을 요청 본문에서 신뢰하지 않는다.
- 사용자 호출 Edge Function은 `verify_jwt`를 활성화하고 `auth: 'user'` 컨텍스트의 RLS-scoped client로 사용자 권한 RPC를 호출한다. 관리자 client는 delivery 상태처럼 명시된 좁은 작업에만 사용한다.
- DB mutation은 최신 membership을 조회하고 admin + active를 함께 검증한다.
- security definer 함수는 빈 search path와 최소 execute 권한을 사용한다.
- RLS policy는 `auth.uid()`가 null이 아님을 명확히 검사하고 현재 DB 상태를 사용한다.
- 이메일은 필요한 admin 화면에서만 최소 표시하며 일반 구성원에게 전체 주소를 노출하지 않는다.
- 감사 metadata는 고정된 key allowlist만 허용한다.
- ID 추측으로 존재 여부를 확인하지 못하도록 권한 오류를 일관되게 매핑한다.
- service role은 bootstrap과 delivery 상태 같은 좁은 서버 작업에만 사용하고 일반 CRUD 우회에 사용하지 않는다.

## 11. Observability and Operations

- Edge Function log에는 request correlation ID, HTTP status, method와 latency만 기록하고 이메일·token은 제외한다. 동일 request ID를 `X-Request-Id` 응답 헤더에도 제공한다.
- 초대 전송 실패는 `delivery_status`, attempts와 비민감 provider code로 확인한다.
- 감사 로그는 MVP 동안 무기한 보존하고 운영자가 SQL로만 점검한다.
- invitation cleanup은 지연 만료로 시작하고 규모가 늘면 Supabase Cron을 추가한다.
- 이메일 발송 제한과 재전송 cooldown을 적용하고 UI에 다음 가능 시각을 표시한다.
- Cloud와 향후 로컬 Docker 환경은 동일 migration과 seed-free 테스트를 사용한다.

## 12. Requirement Traceability

| Plan ID   | Design Coverage                                    |
| --------- | -------------------------------------------------- |
| HH-FR-001 | bootstrap Edge Function 및 원자적 bootstrap RPC    |
| HH-FR-002 | members/invitations SELECT RLS와 admin route       |
| HH-FR-003 | invitation Edge Function, create RPC와 unique 제약 |
| HH-FR-004 | cancel RPC와 pending 상태 전이                     |
| HH-FR-005 | accept RPC의 token·상태·만료·auth email 검증       |
| HH-FR-006 | accept transaction의 active member 생성            |
| HH-FR-007 | member status RPC와 허용 상태 전이                 |
| HH-FR-008 | private active-member helper와 업무 테이블 RLS     |
| HH-FR-009 | admin helper, RLS와 교차 household 테스트          |
| HH-FR-010 | append-only audit_logs와 mutation 내 기록          |

## 13. Deferred Items

- Google 사용자의 `household_join_requests`
- 가족 검색 코드와 가입 요청 승인·거절 UI
- 관리자 승격, 위임, 복수 관리자와 관리자 복구
- removed 사용자의 재가입·관계 복원
- 구성원의 자발적 탈퇴 요청
- admin 감사 로그 조회 화면과 장기 보존·archive 정책
- 다중 household 선택 UI

## 14. References

- `docs/01-plan/features/household.plan.md`
- `docs/02-design/features/auth.design.md`
- `docs/features/household.md`
- `docs/features/auth.md`
- `docs/architecture/authorization.md`
- `docs/architecture/overview.md`
- `AGENTS.md`
- Supabase Row Level Security: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase Database Functions: <https://supabase.com/docs/guides/database/functions>
- Supabase Edge Functions Authorization: <https://supabase.com/docs/guides/functions/auth>
