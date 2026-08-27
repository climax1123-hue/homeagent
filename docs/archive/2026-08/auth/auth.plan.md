# auth - Plan Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Completed
> Level: Dynamic

---

## 1. Overview

### 1.1 Purpose

가족 구성원이 이메일 주소를 계정 ID로 사용해 안전하게 가입·로그인하고,
현재 가정 구성원 상태에 따라 허용된 화면과 데이터에만 접근하도록 한다.

### 1.2 Background

이 서비스는 가족의 일정, 가계부, 디데이와 목표를 공유한다. 로그인 성공은 사용자
신원만 증명하며 가족 데이터 접근 권한을 의미하지 않는다. Supabase Auth의 UUID를
내부 사용자 식별자로 사용하고, 실제 접근은 DB의 최신 가정 구성원 상태와 RLS로
판정해야 한다.

## 2. Goals

### 2.1 Primary Goals

- [x] 이메일 주소를 사용자 관점의 계정 ID로 정의한다.
- [x] 최초 관리자와 초대받은 구성원의 가입·로그인 흐름 범위를 정한다.
- [x] 로그인 세션과 가정 접근 권한을 분리한다.
- [x] 비로그인·미승인·정지·탈퇴 사용자의 접근 차단 조건을 정한다.
- [x] Supabase Auth와 RLS를 사용하는 보안 및 테스트 기준을 정한다.

### 2.2 Non-Goals

- 가족 초대 생성·취소와 구성원 상태 변경 UI는 `household` 기능에서 다룬다.
- Google OAuth 로그인과 기존 이메일 계정 연결은 후속 단계에서 다룬다.
- Google Calendar OAuth 권한은 `calendar` 기능에서 별도로 다룬다.
- MFA, 소셜 로그인 추가, 관리자 계정 복구 정책은 MVP에 포함하지 않는다.
- 서비스 운영자가 사용자의 비밀번호를 생성하거나 전달하지 않는다.

## 3. Scope

### 3.1 In Scope

- 이메일 주소를 사용하는 최초 관리자 가입
- 이메일 초대 경로로 진입한 가족 구성원의 계정 활성화
- 이메일과 비밀번호를 사용하는 로그인
- 로그아웃과 세션 만료 처리
- 인증 상태 복원 중 로딩 및 오류 처리
- 로그인 후 현재 가정 구성원 상태 조회
- 상태에 따른 화면 이동
  - `active`: 승인된 가정 화면
  - 유효한 초대: 초대 수락 화면
  - `pending`: 승인 대기 화면
  - `suspended` 또는 `removed`: 접근 차단 안내
  - 어느 조건에도 해당하지 않음: 가정 접근 불가 안내
- 보호된 라우트의 비로그인 접근 차단
- RLS를 통한 승인되지 않은 가정 데이터 접근 차단

### 3.2 Out of Scope

- Google OAuth 로그인 및 계정 연결
- Google 계정 사용자의 가정 가입 요청
- 이메일 초대 생성·발송·취소·만료 처리의 상세 구현
- 구성원 역할 및 상태를 변경하는 관리자 기능
- 비밀번호 찾기·재설정과 MFA의 제품 흐름
- 일정, 알림, 가계부, 디데이와 목표 업무 기능

## 4. Functional Requirements

| ID          | Requirement                                                                               |
| ----------- | ----------------------------------------------------------------------------------------- |
| AUTH-FR-001 | 사용자는 정규화된 이메일 주소를 계정 ID로 사용한다.                                       |
| AUTH-FR-002 | 내부 관계와 RLS 판정에는 Supabase Auth의 UUID `user_id`를 사용한다.                       |
| AUTH-FR-003 | 최초 관리자는 본인 이메일로 계정을 생성하고 이메일 소유를 확인한다.                       |
| AUTH-FR-004 | 초대받은 사용자는 초대 대상 이메일과 동일한 이메일로 계정을 활성화한다.                   |
| AUTH-FR-005 | 유효한 인증 정보로 로그인하고 명시적으로 로그아웃할 수 있다.                              |
| AUTH-FR-006 | 앱을 다시 열었을 때 유효한 세션은 복원하고 만료된 세션은 로그인 화면으로 보낸다.          |
| AUTH-FR-007 | 로그인 후 DB의 최신 가정 구성원 관계와 상태를 조회해 접근 경로를 판정한다.                |
| AUTH-FR-008 | `active` 구성원만 승인된 가정의 공유 데이터에 접근할 수 있다.                             |
| AUTH-FR-009 | `pending`, `suspended`, `removed` 또는 무관계 사용자는 가정 업무 데이터에 접근할 수 없다. |
| AUTH-FR-010 | 인증 실패, 초대 대기, 승인 대기와 접근 차단 상태를 서로 구분해 안내한다.                  |

## 5. Non-Functional Requirements

### 5.1 Security

- 모든 공개 업무 테이블에 RLS를 적용한다.
- 클라이언트에는 공개용 Supabase 키만 사용하고 `service_role` 키를 노출하지 않는다.
- JWT의 오래된 역할 정보만 신뢰하지 않고 DB의 현재 구성원 상태를 확인한다.
- 다른 사용자의 이메일, 구성원 관계와 가정 데이터를 임의로 조회할 수 없어야 한다.
- 실제 이메일, 비밀번호, 토큰과 가족 개인정보를 테스트 fixture에 사용하지 않는다.

### 5.2 Usability and Compatibility

- PC, iPhone과 Android 브라우저에서 가입·로그인·로그아웃이 가능해야 한다.
- 주요 모바일 터치 영역은 최소 44px로 제공한다.
- 인증 처리 중 중복 제출을 막고 진행 상태를 표시한다.
- 사용자 메시지는 내부 오류나 자격 증명 정보를 노출하지 않는다.

### 5.3 Maintainability

- DB 변경은 새 Supabase migration으로만 추가한다.
- 인증·권한 동작에 자동화 테스트를 추가한다.
- 로컬 Docker 사용 가능 여부와 무관하게 Cloud와 로컬에 동일한 migration을 적용한다.

## 6. Success Criteria

- [ ] 비로그인 사용자가 보호된 화면과 업무 데이터에 접근할 수 없다.
- [ ] 유효한 이메일 계정으로 가입·로그인·로그아웃할 수 있다.
- [ ] `active` 구성원은 승인된 가정으로 이동할 수 있다.
- [ ] 초대·승인 대기·정지·탈퇴 상태가 각각 올바른 화면으로 연결된다.
- [ ] 다른 가정의 `household_id`를 임의로 요청해도 데이터가 반환되지 않는다.
- [ ] 관리자가 구성원을 정지 또는 탈퇴 처리하면 기존 세션의 다음 요청부터 차단된다.
- [ ] 인증 및 RLS 관련 테스트가 통과한다.
- [ ] lint, TypeScript, 관련 테스트와 프로덕션 빌드가 통과한다.
- [ ] 구현 결과와 `auth.design.md` 및 기존 기능 명세가 일치한다.

## 7. Schedule

| Phase           | Target Date | Status    |
| --------------- | ----------- | --------- |
| Plan            | 2026-08-26  | Completed |
| Design          | TBD         | Pending   |
| Implementation  | TBD         | Pending   |
| Check / Iterate | TBD         | Pending   |
| Report          | TBD         | Pending   |

## 8. Risks & Mitigations

| Risk                                                       | Impact | Probability | Mitigation                                                                   |
| ---------------------------------------------------------- | ------ | ----------- | ---------------------------------------------------------------------------- |
| 로그인 성공을 가정 접근 승인으로 잘못 취급                 | High   | Medium      | 세션 확인 뒤 DB의 최신 구성원 상태를 별도로 조회하고 RLS로 재검증한다.       |
| 클라이언트에 관리자 자격 증명 노출                         | High   | Low         | 공개 키만 사용하고 `service_role`과 서버 비밀은 클라우드 비밀 저장소에 둔다. |
| 초대 이메일과 가입 이메일 불일치                           | High   | Medium      | 이메일을 정규화하고 서버 함수에서 초대 대상과 인증 이메일을 비교한다.        |
| 구성원 상태 변경 후 기존 세션이 계속 접근                  | High   | Medium      | JWT 역할만 사용하지 않고 RLS가 DB의 현재 상태를 조회하게 한다.               |
| Cloud DB를 Dashboard에서 직접 변경해 migration 이력 불일치 | Medium | Medium      | 모든 스키마 변경을 Git의 migration으로 배포한다.                             |
| 최초 관리자 가입 경로가 일반 사용자에게 노출               | High   | Medium      | Design 단계에서 일회성 부트스트랩 또는 허용 이메일 정책을 확정한다.          |
| 이메일 발송 한도 또는 지연                                 | Medium | Medium      | Supabase 무료 한도를 확인하고 재전송 제한과 명확한 대기 안내를 설계한다.     |

## 9. Architecture Considerations

- 웹 클라이언트는 React, TypeScript와 Vite를 사용한다.
- 인증은 Supabase Auth, 데이터는 Supabase PostgreSQL을 사용한다.
- `auth.users.id`를 내부 `user_id`의 기준으로 사용한다.
- 가정 데이터 접근 경계는 `household_members(household_id, user_id, role, status)`로 판정한다.
- 권한 변경은 다음 API 요청부터 반영되도록 RLS 또는 DB 보안 함수에서 현재 상태를 확인한다.
- 가입 완료 후 사용자 프로필 생성 방식과 최초 관리자 부트스트랩 방식은 Design 단계에서 확정한다.
- 인증 이메일 Redirect URL은 개발·운영 환경별 허용 목록으로 관리한다.

## 10. Convention Prerequisites

- TypeScript strict 설정과 기존 lint·format 규칙을 따른다.
- 환경변수는 브라우저 공개값과 서버 비밀값을 분리한다.
- DB 식별자는 `snake_case`, TypeScript 식별자는 기존 프로젝트 규칙을 따른다.
- 날짜와 시간은 UTC로 저장하고 화면에서는 `Asia/Seoul`을 기본으로 표시한다.
- 기능 변경 시 관련 문서, migration과 테스트를 함께 갱신한다.

## 11. Open Decisions for Design

1. 최초 관리자 가입을 허용할 일회성 부트스트랩 방식
2. MVP의 이메일 인증 방식: 비밀번호 가입 후 확인 메일 또는 Magic Link
3. 비밀번호 찾기·재설정을 auth MVP에 추가할 시점
4. 유효한 초대가 없는 인증 사용자의 안내 및 계정 처리 방식
5. 세션 만료 시간과 유휴 시간 제한 정책

## 12. References

- `docs/features/auth.md`
- `docs/features/household.md`
- `docs/architecture/authorization.md`
- `docs/architecture/overview.md`
- `supabase/README.md`
- `AGENTS.md`
