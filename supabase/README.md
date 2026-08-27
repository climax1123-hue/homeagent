# Supabase

현재는 Docker 없이 Supabase Cloud를 개발 DB로 사용한다. 나중에 Docker가
정상화되면 같은 `config.toml`과 migration을 사용해 로컬 Supabase를 추가한다.

## 디렉터리

- `migrations/`: PostgreSQL 스키마 변경 이력
- `functions/`: Calendar OAuth, 동기화, 명세 처리 등 서버 함수
- tests/: transaction rollback을 사용하는 pgTAP 권한·도메인 테스트

## 클라우드 개발 절차

```powershell
pnpm supabase login
pnpm supabase link --project-ref <project-ref>
pnpm supabase migration new <migration-name>
pnpm supabase db push --dry-run
pnpm supabase db push
pnpm supabase test db --linked supabase/tests
```

- 프로젝트 참조와 CLI 로그인 토큰은 로컬 Supabase 설정에만 저장한다.
- 브라우저에서 사용하는 URL과 공개 키는 `.env.local`에 저장한다.
- `service_role` 키와 DB 비밀번호는 Git에 커밋하지 않는다.
- 원격 Dashboard에서 스키마를 직접 변경하지 않고 migration으로만 배포한다.
- `db reset --linked`는 원격 데이터를 삭제하므로 사용하지 않는다.

## Household 초대 함수

create-household-invitation Edge Function은 다음 server secret이 필요하다.

- APP_URL: 초대 링크가 돌아올 운영 웹 주소
- ALLOWED_ORIGINS: 쉼표로 구분한 허용 웹 origin
- RESEND_API_KEY: 초대 메일 공급자 API key
- INVITATION_FROM_EMAIL: 검증된 발신 주소

secret 값은 문서, .env.example, Git과 클라이언트 코드에 기록하지 않는다.
메일 발송이 실패하면 해당 초대를 자동 취소하므로 관리자가 안전하게 새 초대를
만들 수 있다.

## 향후 Docker 연결

Docker 사용이 가능해지면 `pnpm supabase start`로 로컬 스택을 실행하고
`pnpm supabase db reset`으로 Git의 migration을 재현한다. 실제 클라우드 데이터는
자동 복사하지 않으며 필요할 때 별도 백업·복원 절차를 사용한다.
