# calendar-google-sync - Plan Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Approved | Level: Dynamic

## 1. Purpose

가족 구성원이 자신의 Google 계정을 안전하게 연결하고, 자신이 만든 우리집 일정을 Google Calendar에 복사·갱신·삭제할 수 있게 한다.

## 2. Goals

- [ ] Google OAuth 연결/해제와 연결 상태 UI
- [ ] refresh token을 클라이언트에 노출하지 않고 서버에서 암호화 보관
- [ ] 우리집 일정 단건을 Google 기본 캘린더로 내보내기
- [ ] 재전송 시 중복 생성 대신 기존 Google event 갱신
- [ ] 우리집 일정 삭제 시 연결된 Google event 삭제 선택 지원
- [ ] 실패 상태와 재시도 가능 상태 기록

## 3. Scope

### In Scope

- 사용자별 Google 연결
- `calendar.events.owned` 최소 권한 우선 검토
- Supabase Edge Functions 기반 OAuth callback 및 API 호출
- 로컬 event와 Google event의 매핑
- 일반·종일·반복 일정 변환
- 수동 `Google과 동기화` 버튼

### Out of Scope

- Google에서 우리집으로 가져오는 양방향 동기화
- Google Push notification channel
- 여러 Google 캘린더 선택
- Google Workspace 관리자 위임

## 4. Success Criteria

- [ ] 비밀키·client secret·refresh token이 프런트 번들과 공개 API 응답에 없다.
- [ ] OAuth state가 1회성·만료형이며 사용자와 묶인다.
- [ ] 같은 일정을 반복 동기화해도 Google event가 중복 생성되지 않는다.
- [ ] 연결되지 않은 상태에서도 기존 캘린더 기능이 정상 동작한다.
- [ ] 자격 증명이 없는 개발 환경은 안전한 설정 필요 상태로 표시된다.
- [ ] DB RLS/권한 테스트와 `pnpm check`가 통과한다.

## 5. Risks

| Risk | Mitigation |
|---|---|
| refresh token 유출 | Edge Function에서 AES-GCM 암호화, 공개 column grant 차단 |
| OAuth CSRF | random state의 SHA-256만 DB 보관, 10분 만료, 1회 소비 |
| 중복 일정 | `(event_id, user_id)` unique mapping과 Google event ID 재사용 |
| 무료 플랜 제한 | 동기화는 사용자 요청 시 실행, 상시 서버 없음 |
| OAuth 심사 | 최소 scope와 테스트 사용자 운영부터 시작 |

## 6. Deferred

Google→우리집 가져오기와 자동 양방향 동기화는 단방향 내보내기의 안정성을 확인한 뒤 별도 확장한다.
