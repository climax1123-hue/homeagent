# Gap Analysis: household

> Date: 2026-08-26 | Design: `docs/02-design/features/household.design.md` | Iteration: 2

---

## Match Rate: 93%

1차 83%에서 Iterate 후 93%로 개선됐다. 설계 검증 항목 30개 중 28개가 일치한다. household 보안 경계와 도메인 규칙뿐 아니라 일반 구성원 설정 화면, 안전한 요청 추적, 강화된 회귀 테스트와 실제 클라우드 함수 검증까지 갖췄다.

## 산정 기준

| 영역               | 일치/전체 | 비율 |
| ------------------ | --------: | ---: |
| DB·제약·RPC        |       9/9 | 100% |
| RLS·보안·감사      |       8/8 | 100% |
| Edge Function·메일 |       5/6 |  83% |
| UI·통합·테스트     |       6/7 |  86% |
| 합계               |     28/30 |  93% |

`Match Rate = 28 / 30 × 100 = 93%`

## Iterate에서 해결된 항목

- active 일반 구성원과 관리자 모두 사용하는 `/app/settings` 가족 설정 route를 추가했다.
- 본인의 표시 이름을 조회·수정하고 trim·50자 제한·중복 제출 차단·안전 오류를 적용했다.
- 표시 이름 변경 component test를 추가해 웹 테스트가 11개로 증가했다.
- Edge Function에 UUID request correlation ID, method/status/latency 구조 로그와 `X-Request-Id` 응답 헤더를 추가했다.
- 초대 API의 실제 `sent` 응답, 전송 실패 자동 취소와 관측성 결정을 Design에 반영했다.
- pgTAP을 22개에서 28개로 확장해 초대 재사용, 관리자 자기 상태 변경, 재활성화, soft removal, removed access context와 anon execute 차단을 추가했다.
- `pnpm check`의 lint, TypeScript, 11개 웹 테스트와 production build가 통과했다.
- `create-household-invitation` version 4가 JWT 검증 ACTIVE로 재배포됐다.
- 원격 OPTIONS는 `204`와 correlation ID를 반환하고 무토큰 POST는 gateway에서 `401`로 차단됐다.

## Verified Implementation

- 원자적 bootstrap과 한 사용자당 하나의 현재 household
- admin/member, active/suspended/removed 상태와 허용 전이
- 1회용 hash 초대 token, 이메일 확인·일치·만료·상태 검증
- 관리자 전용 생성·취소·상태 mutation과 일반/외부/정지 사용자 차단
- 모든 household 공개 테이블 RLS와 최소 table/function grant
- soft removal, 기존 JWT 다음 요청 차단과 감사 로그
- 이메일 성공/실패 delivery status와 attempt 기록, token 비노출
- PC/mobile 관리자 화면, 초대 수락 화면과 일반 구성원 설정 화면
- auth access resolver와 household route 통합

## Remaining Gaps

- 요청 idempotency key를 이용한 동일 HTTP 재시도·메일 중복 억제는 아직 없다. DB의 pending 초대 unique 제약이 중복 관계는 막지만 동일 응답 재현까지 제공하지 않는다.
- `RESEND_API_KEY`와 `INVITATION_FROM_EMAIL`이 정해지지 않아 실제 가족 이메일 E2E와 iPhone/Android/PC 자동 viewport 전체 흐름은 운영 배포 단계에 남아 있다.

## Security Verification

| Check                      | Result                            |
| -------------------------- | --------------------------------- |
| Household tables RLS       | enabled                           |
| Cross-household access     | denied in pgTAP                   |
| Member admin mutation      | denied                            |
| Suspended/removed access   | denied / status returned          |
| Raw invitation token in DB | SHA-256 hash only                 |
| Invitation reuse           | denied                            |
| Admin self status change   | denied                            |
| anon status RPC execute    | denied                            |
| Edge JWT                   | enabled                           |
| Edge preflight             | 204                               |
| Edge request correlation   | response ID + safe structured log |

## Recommendation

일치율이 90%를 넘었으므로 household Report를 작성한다. idempotency와 실메일·실기기 E2E는 production 이메일 공급자와 배포 URL 확정 시 release gate로 처리한다.

## Next Step

`$pdca report household`
