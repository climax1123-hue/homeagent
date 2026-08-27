# calendar-core - Plan Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Plan Complete  
> Level: Dynamic

## 1. Overview

### 1.1 Purpose

활성 가족 구성원이 PC와 모바일 웹에서 가족 공유 일정과 개인 일정을 안전하게 생성·조회·수정·삭제하고, 월간·주간·목록 화면에서 반복 일정을 확인할 수 있는 로컬 캘린더 핵심 기능을 제공한다.

### 1.2 Background

App Shell의 `/app/calendar`는 현재 준비 중 화면이다. Google Calendar 연동이나 Push 알림에 앞서 외부 서비스 장애와 무관하게 동작하는 로컬 일정 원장과 UI가 필요하다.

## 2. Goals

- [ ] 월간·주간·목록 보기를 제공한다.
- [ ] 일반·종일 일정 CRUD를 제공한다.
- [ ] 가족 공유와 개인 일정의 조회·변경 권한을 RLS로 격리한다.
- [ ] 매일·매주·매월·매년 반복과 종료일/횟수를 지원한다.
- [ ] 모든 시각은 UTC로 저장하고 `Asia/Seoul`로 표시한다.
- [ ] App Shell과 자연스럽게 연결되는 PC·모바일 반응형 UI를 제공한다.

## 3. Scope

### 3.1 In Scope

- 일정 제목, 설명, 장소, 시작·종료, 종일 여부, 색상
- 가족 공유(`family`)와 개인(`private`) 공개 범위
- 월간, 주간, 일정 목록 보기 및 이전·다음·오늘 이동
- 일정 생성, 상세 확인, 수정, 삭제
- 반복 없음, 매일, 매주, 매월, 매년
- 반복 간격, 종료일 또는 최대 횟수
- 작성자 표시와 작성자/관리자 변경 권한
- 빈 상태, 로딩, 오류, 저장 중 상태
- `calendar_events` 테이블, 인덱스, RLS 및 권한 테스트
- 모바일 320px 이상과 1024px 이상 PC 레이아웃

### 3.2 Out of Scope

- Google OAuth 및 Calendar 동기화
- Web Push, 일정 사전 알림, 약 복용 알림
- 참석자 초대와 참석 응답
- 반복 일정의 특정 회차만 수정
- 검색, 고급 필터, 충돌 해결 UI
- 외부 캘린더와 첨부파일

후속 기능은 `calendar-google-sync`와 `calendar-notifications` PDCA로 분리한다.

## 4. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| CAL-FR-001 | 활성 구성원은 자신의 가구 가족 일정을 조회한다. | Must |
| CAL-FR-002 | 개인 일정은 작성자만 조회한다. | Must |
| CAL-FR-003 | 활성 구성원은 가족 또는 개인 일정을 생성한다. | Must |
| CAL-FR-004 | 작성자는 자신의 모든 일정을 수정·삭제한다. | Must |
| CAL-FR-005 | 관리자는 가족 일정만 수정·삭제할 수 있으며 다른 사람의 개인 일정에는 접근하지 못한다. | Must |
| CAL-FR-006 | 종료 시각은 시작 시각보다 늦어야 한다. | Must |
| CAL-FR-007 | 사용자는 월간·주간·목록 보기를 전환한다. | Must |
| CAL-FR-008 | 사용자는 이전·다음·오늘로 표시 기간을 이동한다. | Must |
| CAL-FR-009 | 종일 일정을 생성하고 날짜 단위로 표시한다. | Must |
| CAL-FR-010 | 매일·매주·매월·매년 반복을 설정한다. | Must |
| CAL-FR-011 | 반복 종료일 또는 횟수를 설정한다. | Should |
| CAL-FR-012 | 일정 상세에서 공개 범위와 작성자 여부를 확인한다. | Should |

## 5. Non-Functional Requirements

- 모든 업무 row는 `household_id`로 격리하고 RLS를 적용한다.
- DB 시각은 `timestamptz` UTC로 저장하고 UI는 `Asia/Seoul` 기본 표시한다.
- 제목은 1~120자, 설명은 2000자, 장소는 200자 이내로 검증한다.
- 색상은 허용된 palette 값만 저장한다.
- 주요 터치 영역은 44px 이상이고 키보드로 form/dialog를 사용할 수 있어야 한다.
- 다른 가구·비활성 구성원·다른 사용자의 개인 일정은 API 응답에 포함되지 않아야 한다.
- 외부 일정 라이브러리 없이 날짜 유틸과 컴포넌트를 테스트 가능하게 분리한다.

## 6. Success Criteria

- [ ] 가족/개인 일반 일정과 종일 일정 CRUD가 동작한다.
- [ ] 월간·주간·목록 화면에서 같은 데이터가 일관되게 보인다.
- [ ] 반복 일정이 선택 기간에 올바르게 확장된다.
- [ ] 작성자·관리자·일반 구성원·다른 가구 권한 테스트가 통과한다.
- [ ] 320px, 390px, 768px, 1024px 이상에서 주요 화면을 사용할 수 있다.
- [ ] 기존 auth, household, app-shell 동작이 회귀하지 않는다.
- [ ] TypeScript, lint, 관련 테스트, 프로덕션 빌드가 통과한다.
- [ ] 새 migration을 추가하고 기존 migration은 수정하지 않는다.

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 반복 일정 확장 오류 | High | 순수 날짜 함수와 경계 테스트를 추가하고 이번 일정만 수정은 제외한다. |
| 개인 일정 노출 | Critical | SELECT RLS에서 owner 조건을 DB 수준으로 강제한다. |
| 관리자 권한 과다 | High | 관리자는 `family` 일정에만 변경 권한을 부여한다. |
| 시간대/종일 날짜 밀림 | High | UTC 저장과 Seoul 변환 유틸을 단일화하고 테스트한다. |
| 모바일 달력 과밀 | Medium | 월간 cell에는 제한된 일정만 표시하고 목록/주간 보기로 상세를 제공한다. |
| 외부 동기화 설계 충돌 | Medium | 로컬 UUID와 확장 가능한 source 필드를 유지하되 OAuth 필드는 후속 migration으로 추가한다. |

## 8. Architecture Considerations

- Data: Supabase `calendar_events` + RLS
- Client API: `features/calendar/api/calendar-api.ts`
- Domain: shared calendar types, 날짜 범위/반복 확장 유틸
- UI: `CalendarPage`, toolbar, month/week/list view, event form/detail dialog
- Route: 기존 `/app/calendar` 준비 중 화면 교체
- DB 변경: 신규 migration과 pgTAP RLS 테스트

## 9. Schedule

| Phase | Target | Status |
|---|---|---|
| Plan | 2026-08-26 | Complete |
| Design | 연속 진행 | Pending |
| Do | Design 직후 | Pending |
| Analyze / Iterate | 구현·검증 직후 | Pending |
| Report | Match Rate 90% 이상 | Pending |

## 10. References

- `docs/features/calendar.md`
- `docs/architecture/calendar-sync.md`
- `docs/archive/2026-08/app-shell/`
- 프로젝트 `AGENTS.md`
