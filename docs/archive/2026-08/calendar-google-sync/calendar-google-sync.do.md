# calendar-google-sync 구현 기록

## 완료

- OAuth 연결, callback, 단건 동기화, 연결 해제 Edge Function 구현·배포
- 1회성 10분 OAuth state와 SHA-256 hash 저장
- AES-GCM refresh token 암호화 및 비공개 컬럼 권한
- 사용자별 연결 및 로컬/Google event mapping 테이블과 RLS
- 연결 상태, 연결/해제, 소유 일정 동기화 UI
- Google event 일반·종일·반복 변환
- Supabase 원격 migration 및 Edge Function 배포
- 웹 테스트 26개와 production build 통과

## 외부 설정 대기

Google Cloud Console에서 Calendar API를 활성화하고 OAuth Web Client를 만든 뒤 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`을 Supabase secrets로 등록해야 실제 OAuth가 열린다. 서버 암호화 키와 callback URI는 이미 설정했다.
