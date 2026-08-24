# Supabase

2단계에서 로컬 Supabase 설정을 초기화하고 다음 항목을 추가합니다.

- `migrations/`: PostgreSQL 스키마 변경 이력
- `functions/`: Calendar OAuth, 동기화, 명세 처리 등 서버 함수
- `tests/rls/`: household 권한 격리 테스트

운영 대시보드에서 직접 스키마를 변경하지 않고 migration을 통해 관리합니다.
