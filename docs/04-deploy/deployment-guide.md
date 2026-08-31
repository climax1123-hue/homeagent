# 1차 운영 배포 가이드

## 배포 구성

- 웹: Vercel Hobby, 저장소 루트 기준 `vercel.json`
- 인증·DB·RLS·Edge Functions: Supabase 프로젝트 `tbvwtghrpcuhygwqlmyo`
- 자동 배포: GitHub `main` push → Vercel Production
- 품질 검사: GitHub Actions에서 `pnpm check`

## 1차 공개 범위

- 로그인과 가족 공간·구성원 관리
- 일정, 반복 일정, 알림 설정
- Google Calendar 연결과 일정 내보내기
- 가족/개인 가계부, 명세 가져오기, 자동분류, 분석 대시보드
- 공통코드와 관리자 화면

목표·디데이는 준비 중 화면으로 유지한다.

## Vercel 설정

1. GitHub `climax1123-hue/homeagent` 저장소를 새 Vercel 프로젝트로 가져온다.
2. Root Directory는 저장소 루트 `.`로 둔다.
3. Framework Preset은 Vite로 설정한다.
4. 환경변수는 `environment-vars.md`의 브라우저 공개 3개 값만 등록한다.
5. Production 배포 후 발급된 HTTPS URL을 Supabase와 Google OAuth 허용 목록에 반영한다.

## 배포 후 점검

1. `/login`, `/app`, `/app/calendar`, `/app/ledger` 직접 접속 및 새로고침
2. 관리자 로그인과 가족 구성원 초대
3. 일정 생성·수정·삭제와 구성원 색상 구분
4. Google Calendar 연결, 내보내기, 연결 해제
5. 가족 장부와 개인 장부 권한 분리
6. iPhone Safari와 Android Chrome에서 44px 터치 영역 확인

## 롤백

- 웹: Vercel Deployments에서 직전 정상 배포를 Promote한다.
- DB: 기존 migration을 되돌리지 않고 새 forward migration으로 수정한다.
- Edge Function: 직전 Git revision의 함수를 다시 배포한다.
