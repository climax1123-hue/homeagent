# 신규 가족 관리자 가입 설계

## 흐름

1. `/signup/admin`에서 Supabase Auth 이메일 가입을 수행한다.
2. 이메일 확인 후 로그인하면 `unassigned` 접근 상태로 이동한다.
3. 사용자가 가족 공간 이름과 표시 이름을 입력한다.
4. `create_my_household` RPC가 이메일 인증과 현재 가족 관계를 검증한다.
5. 하나의 트랜잭션에서 `households`, `household_members`, 감사 로그를 생성한다.
6. 접근 상태를 다시 조회해 `/app`으로 이동한다.

## 보안

- 함수는 `authenticated`만 실행 가능하다.
- `auth.uid()`를 서버에서 사용하며 클라이언트가 user ID나 역할을 지정하지 않는다.
- 이메일 확인 완료를 `auth.users.email_confirmed_at`으로 검사한다.
- 기존 `active/suspended` 구성원 관계가 있으면 차단한다.
- 직접 테이블 insert 권한은 계속 부여하지 않는다.

## 테스트

- 익명 실행 차단
- 인증된 미배정 사용자의 정상 생성
- 미인증 사용자 차단
- 중복 가족 생성 차단
- 접근 상태가 `active/admin`으로 전환되는지 확인
