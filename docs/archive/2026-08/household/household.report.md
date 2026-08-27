# household Completion Report

> **Status**: Complete (MVP, 운영 메일 연동 전 조건부)  
> **Project**: 우리집 웹사이트  
> **Author**: Codex + 프로젝트 관리자  
> **Completion Date**: 2026-08-26

---

## 1. Summary

| Item               | Content                                                     |
| ------------------ | ----------------------------------------------------------- |
| Feature            | 가족 공간·구성원·초대·접근 관리 (`household`)               |
| Start Date         | 2026-08-26                                                  |
| End Date           | 2026-08-26                                                  |
| PDCA Iterations    | 2                                                           |
| Initial Match Rate | 83%                                                         |
| Final Match Rate   | 93% (28/30)                                                 |
| Result             | MVP 구현·클라우드 배포 완료, 실메일 E2E는 운영 준비 후 수행 |

```text
Completion Rate: 93%

Complete:    28 / 30 design checks
Remaining:    2 / 30 design checks
Critical:     0
```

household를 일정·가계부·디데이·목표가 공유할 최상위 데이터·보안 경계로 구현했다. 인증 성공과 household 접근 승인을 분리하고, 현재 DB membership과 RLS로 매 요청의 권한을 판정한다.

## 2. Related Documents

| Phase  | Document                                       | Status                  |
| ------ | ---------------------------------------------- | ----------------------- |
| Plan   | [household.plan.md](household.plan.md)         | Finalized               |
| Design | [household.design.md](household.design.md)     | Finalized, Iterate 반영 |
| Do     | [household.do.md](household.do.md)             | Complete                |
| Check  | [household.analysis.md](household.analysis.md) | Complete, 93%           |

## 3. Completed Requirements

| ID        | Requirement                               | Status   | Result                           |
| --------- | ----------------------------------------- | -------- | -------------------------------- |
| HH-FR-001 | 최초 household와 active admin 원자적 생성 | Complete | advisory lock 기반 1회 bootstrap |
| HH-FR-002 | active admin의 구성원·초대 조회           | Complete | RLS와 admin UI                   |
| HH-FR-003 | 중복 없는 이메일 초대 생성                | Complete | 정규화·pending unique·Edge API   |
| HH-FR-004 | pending 초대 취소                         | Complete | admin RPC와 UI                   |
| HH-FR-005 | 확인·일치 이메일의 1회 수락               | Complete | token hash·만료·상태 검증        |
| HH-FR-006 | 수락 시 active member 생성                | Complete | 단일 transaction                 |
| HH-FR-007 | 구성원 정지·재활성화·soft removal         | Complete | 허용 상태 전이와 확인 dialog     |
| HH-FR-008 | 비활성·미승인 데이터 접근 차단            | Complete | 현재 membership 기반 RLS         |
| HH-FR-009 | 일반·다른 household 관리자 작업 차단      | Complete | RPC와 RLS 이중 검증              |
| HH-FR-010 | 주요 변경 감사 로그                       | Complete | append-only server mutation 기록 |

## 4. Delivered Components

### Database and Security

- `households`, `household_members`, `household_invitations`, `audit_logs`
- 역할·구성원 상태·초대 상태·전송 상태 enum
- 한 사용자당 하나의 현재 household와 중복 membership 방지
- 7일 만료, 256-bit 원문 token과 SHA-256 hash 저장
- active member/admin authorization helper
- bootstrap, access context, 초대 생성·취소·수락, 상태 변경과 표시 이름 RPC
- 모든 household 공개 테이블 RLS와 최소 table/function grant
- 정지·탈퇴 즉시 차단, soft removal과 감사 로그

### Edge and Email Boundary

- JWT 사용자 재확인과 요청 body의 user/role 불신
- allowlist CORS와 안전한 domain error mapping
- 원문 token을 브라우저 응답에 포함하지 않고 이메일 링크에만 전달
- 메일 성공/실패 상태와 attempts 기록, 실패 시 초대 자동 취소
- request correlation ID, method/status/latency 비민감 구조 로그
- `X-Request-Id` 응답 헤더

### Web

- 관리자 구성원·초대 관리 화면
- 이메일 마스킹, 초대 취소, 정지·재활성화·탈퇴 확인
- 초대 수락과 표시 이름 입력
- 모든 active 구성원의 가족 설정 및 본인 표시 이름 수정
- PC/mobile 반응형 UI와 44px 이상 주요 action
- auth access resolver·보호 route 통합

## 5. Quality Metrics

| Metric                    |   Target |                             Final | Status                    |
| ------------------------- | -------: | --------------------------------: | ------------------------- |
| Design Match Rate         |     ≥90% |                               93% | Pass                      |
| Functional requirements   |       10 |                                10 | Pass                      |
| Household pgTAP           |     pass | 28 checks 구성, 기존 원격 22 통과 | Pass/expanded pending CLI |
| Web tests                 |     pass |                         11 passed | Pass                      |
| Shared tests              |     pass |                          4 passed | Pass                      |
| TypeScript                | 0 errors |                          0 errors | Pass                      |
| Production build          |     pass |                              pass | Pass                      |
| Critical security issues  |        0 |                           0 known | Pass                      |
| Edge deployment           |   ACTIVE |               version 4, JWT=true | Pass                      |
| Edge preflight            |      2xx |                  204 + request ID | Pass                      |
| Unauthenticated Edge POST |   denied |                               401 | Pass                      |

`pnpm check`의 lint, TypeScript, 테스트와 production build가 모두 통과했다. Docker가 아직 불가능하므로 확장된 28개 SQL suite의 CLI 자동화는 보류하고, 기존 동일 DB 구조의 원격 22개 통과 이력과 추가 정적/HTTP 검증을 유지한다.

## 6. Remaining Release Conditions

- `RESEND_API_KEY`, `INVITATION_FROM_EMAIL` 설정
- production URL로 `APP_URL`, `ALLOWED_ORIGINS` 교체
- 실제 관리자 → 배우자 초대 → 실메일 → 가입 → 수락 전체 E2E
- iPhone, Android와 PC 대표 viewport smoke/E2E
- 동일 HTTP 재시도를 같은 응답으로 재현하는 idempotency key
- Docker 정상화 또는 CI DB를 이용한 28개 pgTAP 자동 실행

## 7. Lessons Learned

### Keep

- 인증과 household 접근 승인을 분리하고 DB 현재 상태를 최종 권한 근거로 사용한다.
- token 원문은 hash만 저장하고 브라우저·로그에 노출하지 않는다.
- 상태 변경을 RPC transaction과 감사 로그에 함께 묶는다.
- 구현 후 원격 DB와 Edge HTTP 경계를 별도로 검증한다.

### Problem

- 초기 구현은 관리자 화면 중심이라 일반 구성원의 본인 설정 화면이 빠졌다.
- 메일 공급자 secret이 없어 실제 초대 E2E를 완료할 수 없다.
- Docker 문제 때문에 DB test가 Dashboard 수동 실행에 의존한다.
- 설계의 queued 응답과 실제 sent 응답이 달랐다.

### Try

- 다음 도메인은 관리자·일반 구성원 화면을 route matrix 단계에서 함께 확인한다.
- Edge Function에 correlation ID와 CORS helper를 기본 골격으로 적용한다.
- 운영 도메인과 외부 공급자 자격 증명을 배포 전 release checklist로 관리한다.
- DB 변경 기능은 CI에서 migration + pgTAP을 자동 실행할 환경을 확보한다.

## 8. Next Steps

1. household PDCA 문서를 archive한다.
2. 공통 UI/내비게이션 또는 일정 관리 기능의 Plan을 시작한다.
3. 운영 배포 시 본 문서의 Remaining Release Conditions를 다시 확인한다.

```text
$pdca archive household
```

## Version History

| Version | Date       | Changes                         | Author                  |
| ------- | ---------- | ------------------------------- | ----------------------- |
| 1.0     | 2026-08-26 | Household MVP completion report | Codex + 프로젝트 관리자 |
