# Gap Analysis: auth

> Date: 2026-08-26 | Design: `docs/02-design/features/auth.design.md` | Iteration: 2

---

## Match Rate: 90%

1차 분석의 70%에서 Iterate 후 90%로 개선됐다. 설계 검증 항목 30개 중 27개가 일치한다. 인증·세션·접근 분리, 브라우저 CORS, profiles RLS, route guard, callback 보안 정리와 핵심 단위/원격 보안 검증이 구현됐다.

## 산정 기준

| 영역                | 일치/전체 | 비율 |
| ------------------- | --------: | ---: |
| 인증·세션·접근 로직 |      9/10 |  90% |
| DB·RLS·서버 권한    |       7/7 | 100% |
| UI·라우팅·접근성    |       7/7 | 100% |
| 테스트·운영 검증    |       4/6 |  67% |
| 합계                |     27/30 |  90% |

`Match Rate = 27 / 30 × 100 = 90%`

## Iterate에서 해결된 항목

- `bootstrap-admin`에 OPTIONS preflight, origin allowlist, CORS/Vary 헤더를 추가했다.
- 원격 preflight `204`, 허용 origin 반환과 무토큰 POST `401`을 실제 확인했다.
- Access RPC 장애와 실제 `unassigned` 상태를 분리하고 오류 화면·재시도를 추가했다.
- callback query/hash를 history replace하고 세션 미생성 안내를 추가했다.
- 로그인 사용자를 보호하는 `PublicOnlyRoute`를 가입·로그인 경로에 적용했다.
- rate limit 안전 문구, 제출 중 입력 비활성화와 `aria-live`를 추가했다.
- 접근상태별 route 및 안전 오류 매핑 단위 테스트를 추가해 웹 테스트가 10개로 증가했다.
- profiles pgTAP을 14개로 확장해 trigger provisioning, 본인/타인 가시성, 자체 update, client insert/delete 차단을 검증했다.
- trigger 함수의 기본 PUBLIC EXECUTE를 발견해 새 migration으로 public/anon/authenticated 권한을 모두 회수했다.
- 클라우드에서 trigger 함수 세 역할의 EXECUTE가 모두 false임을 확인했다.
- `/invite`, `displayName`, 수동 bootstrap, CORS와 publishable-key fallback 결정을 Design에 반영했다.
- `pnpm check`의 lint, TypeScript, 테스트와 production build가 모두 통과했다.

## Remaining Gaps

### Missing in Code / Verification

- 로그아웃 API 실패 시 세션을 다시 확인하고 사용자에게 재시도 상태를 유지하는 통합 흐름은 아직 단순하다.
- 관리자·초대 가입의 실제 이메일 전체 E2E 및 iPhone/Android/PC viewport 자동 검증은 아직 없다.
- bootstrap Edge Function의 허용 이메일 성공, 불일치, 동시 호출과 재호출 409를 자동화한 격리 테스트가 없다.
- production 배포 URL이 정해지기 전이어서 `APP_URL`, `ALLOWED_ORIGINS`, Supabase Site/Redirect URL은 현재 localhost 기준이다.

### Structural Deviation

- `auth.tsx`에 provider, route와 page가 집중되어 Fast Refresh 경고 6개가 남는다. 기능 오류는 아니지만 다음 UI 확장 전에 설계의 폴더 구조로 분리하는 편이 좋다.

## Security Verification

| Check                          | Result                                        |
| ------------------------------ | --------------------------------------------- |
| profiles RLS                   | enabled                                       |
| anon table privilege           | none                                          |
| authenticated table privilege  | SELECT, UPDATE only                           |
| own/other row isolation        | tested with authenticated JWT claims          |
| client INSERT/DELETE           | denied                                        |
| trigger function execute       | public=false, anon=false, authenticated=false |
| bootstrap JWT                  | enabled                                       |
| bootstrap CORS preflight       | 204, exact localhost origin                   |
| bootstrap unauthenticated POST | 401                                           |

## Recommendation

일치율이 90%에 도달했으므로 PDCA Report로 진행할 수 있다. 남은 실메일 E2E와 production URL 설정은 배포 도메인이 결정되는 시점에 운영 검증 항목으로 처리한다.

## Next Step

`$pdca report auth`
