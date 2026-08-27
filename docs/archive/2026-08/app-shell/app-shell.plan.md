# app-shell - Plan Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Plan Complete  
> Level: Dynamic

---

## 1. Overview

### 1.1 Purpose

인증을 마친 가족 구성원이 일정, 가계부, 디데이, 목표와 가구 설정 기능을 일관된 방식으로 탐색할 수 있도록 PC·태블릿·모바일 공통 애플리케이션 프레임을 구축한다.

### 1.2 Background

인증과 가구 관리 MVP는 구현되었지만 현재 `/app` 화면은 개별 페이지를 담는 최소 컨테이너 수준이다. 이후 기능을 독립적으로 추가해도 메뉴, 헤더, 반응형 레이아웃, 권한 표시가 중복되지 않도록 공통 App Shell이 필요하다.

### 1.3 Dependencies

- 완료·보관된 `auth` PDCA: 로그인, 세션, 접근 상태, 로그아웃
- 완료·보관된 `household` PDCA: 가구 설정, 구성원 관리, 관리자 역할
- React Router, 공통 디자인 시스템 패키지
- Supabase Auth 및 RLS 기반 권한 경계

## 2. Goals

### 2.1 Primary Goals

- [ ] 인증된 활성 구성원용 공통 레이아웃을 제공한다.
- [ ] PC에서는 사이드바, 모바일에서는 하단 내비게이션과 더보기 메뉴를 제공한다.
- [ ] 홈 대시보드에 주요 기능 진입점과 요약 영역의 골격을 제공한다.
- [ ] 현재 경로와 사용자 역할에 맞는 메뉴 상태를 일관되게 표시한다.
- [ ] 후속 기능이 공통 라우트·레이아웃·디자인 토큰을 재사용하도록 확장 지점을 만든다.
- [ ] 기존 인증 및 가구 관리 흐름을 회귀 없이 App Shell에 연결한다.

### 2.2 Non-Goals

- 일정, 가계부, 디데이, 목표의 실제 CRUD 및 업무 규칙
- 실데이터 기반 통계 차트와 개인화 추천
- 은행 명세 업로드·자동 분류
- Google Calendar 동기화와 웹 푸시 알림
- 네이티브 iOS·Android 앱 및 오프라인 동기화
- 다크 모드와 완성형 브랜드 이미지 제작

## 3. Scope

### 3.1 In Scope

- 인증 사용자 영역 `/app`의 중첩 레이아웃
- 데스크톱 사이드바, 모바일 하단 탭, 모바일 더보기 패널
- 공통 헤더: 현재 화면명, 가구 문맥, 사용자 메뉴, 로그아웃
- 홈 대시보드: 환영 정보, 기능 바로가기, 후속 요약 위젯 자리
- 메뉴: 홈, 일정, 가계부, 디데이, 목표, 설정
- 관리자 전용 구성원 관리 메뉴
- 미구현 업무 기능의 안전한 `준비 중` 화면
- 활성 메뉴, 키보드 포커스, 로딩·오류·빈 상태의 공통 표현
- 색상, 타이포그래피, 간격, 모서리, 그림자, 레이아웃 기준의 디자인 토큰
- iPhone Safe Area와 Android 브라우저를 고려한 반응형 처리
- 라우트 및 메뉴 메타데이터의 타입 안전한 단일 구성

### 3.2 Out of Scope

- 공개 랜딩 페이지와 검색 엔진 최적화
- 데이터베이스 스키마 또는 RLS 정책 변경
- 기능별 API 및 상태 관리 구현
- 관리자 이외 역할 체계의 확장
- 알림 권한 요청과 서비스 워커 구현

## 4. Information Architecture

| 메뉴 | 경로 | 대상 | 이번 단계 동작 |
|---|---|---|---|
| 홈 | `/app` | 활성 구성원 | 대시보드 골격 |
| 일정 | `/app/calendar` | 활성 구성원 | 준비 중 화면 |
| 가계부 | `/app/ledger` | 활성 구성원 | 준비 중 화면 |
| 디데이 | `/app/ddays` | 활성 구성원 | 준비 중 화면 |
| 목표 | `/app/goals` | 활성 구성원 | 준비 중 화면 |
| 가구 설정 | `/app/settings` | 활성 구성원 | 기존 기능 연결 |
| 구성원 관리 | `/app/members` | 관리자 | 기존 기능 연결 |

모바일 기본 탭은 `홈 · 일정 · 가계부 · 목표 · 더보기`로 구성하고, 더보기에서 디데이·설정·구성원 관리·로그아웃에 접근한다. 상세 위치는 Design 단계에서 화면 흐름과 함께 확정한다.

## 5. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| SHELL-FR-001 | 활성 가구 구성원은 로그인 후 App Shell 내부의 홈 화면을 본다. | Must |
| SHELL-FR-002 | 비로그인 또는 활성 상태가 아닌 사용자는 기존 접근 제어 흐름을 유지하며 Shell에 진입하지 못한다. | Must |
| SHELL-FR-003 | 데스크톱 너비에서는 주요 메뉴와 현재 선택 상태가 보이는 사이드바를 제공한다. | Must |
| SHELL-FR-004 | 모바일 너비에서는 한 손 조작이 가능한 하단 내비게이션과 더보기 메뉴를 제공한다. | Must |
| SHELL-FR-005 | 직접 URL 접근과 새로고침 후에도 올바른 화면과 활성 메뉴를 복원한다. | Must |
| SHELL-FR-006 | 헤더는 현재 화면명과 가구 문맥을 표시하고 사용자 메뉴를 제공한다. | Must |
| SHELL-FR-007 | 관리자는 구성원 관리 메뉴를 볼 수 있고 일반 구성원은 볼 수 없다. | Must |
| SHELL-FR-008 | 메뉴 숨김은 편의 기능일 뿐이며 기존 Route Guard와 RLS가 최종 권한을 통제한다. | Must |
| SHELL-FR-009 | 홈은 핵심 기능 바로가기와 향후 요약 위젯을 배치할 수 있는 반응형 카드 영역을 제공한다. | Must |
| SHELL-FR-010 | 아직 구현되지 않은 메뉴는 오류나 빈 화면 대신 명확한 준비 중 상태를 제공한다. | Should |
| SHELL-FR-011 | 로그아웃은 데스크톱과 모바일 모두에서 접근 가능하고 기존 세션 종료 동작을 재사용한다. | Must |
| SHELL-FR-012 | 페이지 콘텐츠가 바뀌어도 공통 내비게이션과 레이아웃은 불필요하게 재생성되지 않는다. | Should |

## 6. Non-Functional Requirements

### 6.1 Responsive & Accessibility

- 최소 320px부터 주요 기능을 가로 스크롤 없이 사용할 수 있어야 한다.
- 주요 터치 영역과 버튼은 최소 44×44px을 확보한다.
- 모바일 하단 영역은 `env(safe-area-inset-bottom)`을 고려한다.
- `nav`, `header`, `main` 랜드마크와 의미 있는 접근성 이름을 제공한다.
- 키보드만으로 모든 메뉴를 이동하고 현재 포커스를 시각적으로 확인할 수 있어야 한다.
- 색상만으로 선택·권한·상태를 구분하지 않는다.

### 6.2 Maintainability

- 메뉴명, 경로, 아이콘, 역할 조건은 타입이 지정된 단일 설정에서 관리한다.
- 공통 요소는 `packages/design-system` 또는 재사용 가능한 Shell 컴포넌트로 분리한다.
- 기능 페이지는 App Shell을 알지 않아도 React Router의 Outlet 영역에 렌더링될 수 있어야 한다.
- 기존 컴포넌트, 인증 컨텍스트, 접근 제어 유틸리티를 우선 재사용한다.

### 6.3 Performance & Reliability

- 공통 Shell은 페이지 전환 때 눈에 띄는 레이아웃 이동을 만들지 않는다.
- 아이콘과 스타일을 위해 불필요하게 큰 런타임 의존성을 추가하지 않는다.
- 메뉴 렌더링 실패가 인증 및 로그아웃 기능을 막지 않아야 한다.

### 6.4 Security & Privacy

- 클라이언트 메뉴 가시성을 권한 검증 수단으로 사용하지 않는다.
- `service_role`, OAuth refresh token, 개인정보를 UI 코드나 테스트 fixture에 포함하지 않는다.
- 가구 데이터는 계속 `household_id`와 RLS로 격리한다.

## 7. Architecture Considerations

예상 구성 요소는 `AppShell`, `DesktopSidebar`, `MobileBottomNav`, `AppHeader`, `UserMenu`, `DashboardPage`, `ComingSoonPage`이다. Shell은 `HouseholdRoute` 아래에서 기존 설정 페이지와 후속 기능 페이지를 `Outlet`으로 감싼다.

세부 폴더 구조, 브레이크포인트, 아이콘 방식, 디자인 토큰 값, 컴포넌트 API는 Design 단계에서 확정한다. 데이터베이스 변경은 예정하지 않으며 기존 인증·가구 API 계약을 변경하지 않는다.

## 8. Success Criteria (Definition of Done)

- [ ] 1024px 이상에서 사이드바와 콘텐츠가 안정적으로 표시된다.
- [ ] 320px·390px 모바일 화면에서 하단 탭과 더보기 메뉴를 사용할 수 있다.
- [ ] 768px 전후와 1440px 화면에서도 콘텐츠가 잘리거나 과도하게 늘어나지 않는다.
- [ ] 현재 경로가 데스크톱·모바일 메뉴에서 모두 명확히 표시된다.
- [ ] 관리자만 구성원 관리 메뉴를 볼 수 있고 URL 권한 검사도 유지된다.
- [ ] 기존 로그인, 초대, 접근 상태, 가구 설정, 구성원 관리, 로그아웃 흐름이 회귀하지 않는다.
- [ ] 미구현 기능 경로가 준비 중 화면으로 정상 진입한다.
- [ ] 주요 조작 영역 44px, 키보드 포커스, 랜드마크 요구사항을 충족한다.
- [ ] 라우팅·역할별 메뉴·반응형 핵심 동작에 대한 관련 테스트가 추가된다.
- [ ] `pnpm check`와 프로덕션 빌드가 통과한다.
- [ ] PC와 모바일 너비에서 UI를 직접 확인하고 결과를 기록한다.

## 9. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| 기존 `AppHome` 변경으로 인증·가구 화면 회귀 | High | Medium | 기존 Guard와 컨테이너를 재사용하고 라우팅 회귀 테스트를 추가한다. |
| 모바일 메뉴가 항목 증가로 복잡해짐 | Medium | High | 핵심 탭을 5개로 제한하고 나머지는 더보기에 둔다. |
| 미구현 메뉴가 완성 기능으로 오해됨 | Medium | Medium | 준비 중 라벨과 후속 개발 범위를 명확히 표시한다. |
| 클라이언트 역할 상태가 늦게 갱신됨 | High | Low | 로딩 상태를 처리하고 Route Guard·RLS를 최종 권한 경계로 유지한다. |
| 기존 전역 CSS와 Shell 스타일 충돌 | Medium | Medium | 토큰과 범위가 지정된 클래스 구조를 설계하고 PC·모바일 시각 검증을 한다. |
| iPhone 하단 홈 인디케이터와 탭 겹침 | Medium | Medium | Safe Area inset을 포함하고 실제 모바일 크기로 검증한다. |

## 10. Convention Prerequisites

- 컴포넌트는 PascalCase, 함수는 camelCase, 일반 파일은 kebab-case를 사용한다.
- 공통 메뉴·토큰 상수를 중복 정의하지 않는다.
- 날짜가 필요한 대시보드 문구는 UTC 데이터를 기준으로 `Asia/Seoul`에 표시한다.
- UI 변경에는 PC·모바일 테스트를 추가하고 완료 전에 `pnpm check`를 실행한다.
- 이번 기능에서는 기존 migration을 수정하거나 새 migration을 추가하지 않는다.

## 11. Schedule

| Phase | Target | Status |
|---|---|---|
| Plan | 2026-08-26 | Complete |
| Design | 다음 작업 | Pending |
| Do | Design 승인 후 | Pending |
| Analyze / Iterate | 구현 후 | Pending |
| Report / Archive | 일치율 90% 이상 후 | Pending |

## 12. Design Phase Decisions

다음 Design 단계에서 아래 항목을 확정한다.

1. 브레이크포인트와 데스크톱 사이드바 접기 정책
2. 정확한 화면 와이어프레임과 모바일 더보기 동작
3. 색상·타이포그래피·간격 등 디자인 토큰 값
4. 아이콘 제공 방식과 접근성 레이블
5. 대시보드 카드의 초기 콘텐츠와 준비 중 표시 방식
6. 컴포넌트 경계, 라우트 구성, 테스트 항목

## 13. References

- `docs/features/README.md`
- `docs/architecture/overview.md`
- `docs/archive/2026-08/auth/`
- `docs/archive/2026-08/household/`
- 프로젝트 루트 `AGENTS.md`
