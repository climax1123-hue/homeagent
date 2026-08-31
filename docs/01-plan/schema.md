# 우리집 웹사이트 스키마 요약

전체 ERD와 필드 정의는 [erd.md](./erd.md), 코드에서 DB까지의 흐름은 [codebase-guide.md](../architecture/codebase-guide.md)를 참고한다.

## 스키마 원칙

- `auth.users`: Supabase가 관리하는 로그인 계정 원본
- `public`: 브라우저 Data API/RPC가 접근하는 업무 테이블과 함수
- `private`: RLS 판정, trigger 검증, 감사 기록용 내부 함수
- 업무 데이터는 `household_id`로 격리하고 개인 데이터는 `owner_user_id`를 추가 검사
- 금액은 `bigint`, 시각은 `timestamptz` UTC, 기본 표시 시간대는 `Asia/Seoul`
- 테이블 권한을 먼저 회수한 뒤 필요한 컬럼/작업만 authenticated 역할에 허용

## 엔티티 목록

| 영역        | 엔티티                                                                              |
| ----------- | ----------------------------------------------------------------------------------- |
| 인증        | `auth.users`, `profiles`                                                            |
| 가족        | `households`, `household_members`, `household_invitations`, `audit_logs`            |
| 시스템 설정 | `common_codes`                                                                      |
| 일정        | `calendar_events`, `calendar_event_exceptions`                                      |
| 알림        | `calendar_reminders`, `push_subscriptions`, `notification_deliveries`               |
| Google      | `google_calendar_connections`, `google_oauth_states`, `calendar_google_event_links` |
| 가계부      | `ledger_books`, `ledger_accounts`, `ledger_categories`, `ledger_transactions`       |

## 중요 제약

- 사용자는 동시에 하나의 활성/정지 가족 공간에만 속한다.
- 개인 일정은 소유자만 읽으며, 가족 일정은 활성 구성원이 읽는다.
- 가족 공간에는 활성 가족 장부가 하나만 존재한다.
- 사용자마다 활성 개인 장부가 하나만 존재한다.
- 거래 금액은 양의 정수이며 같은 결제수단으로 이체할 수 없다.
- `(created_by, client_request_id)`가 중복 거래 제출을 방지한다.
- 할부 회차 금액 합계는 원금과 정확히 일치하도록 RPC가 원자 생성한다.
- 공통코드의 보안/계산 그룹은 관리자가 변경할 수 없다.

## 스키마 변경 이력 위치

실제 스키마의 최종 근거는 [`supabase/migrations`](../../supabase/migrations)이다. 문서와 migration이 다르면 migration과 클라우드 DB 상태를 우선 확인하고 문서를 갱신한다.
