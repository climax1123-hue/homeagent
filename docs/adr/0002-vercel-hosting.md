# ADR 0002: Vercel을 웹 호스팅으로 사용

- 상태: Accepted
- 결정일: 2026-08-28

## 배경

가족이 PC, iPhone, Android에서 접속하려면 로컬 Vite 서버가 아닌 공개 HTTPS 주소가 필요하다. 개인 PC에 서버를 운영하지 않고 초기 비용 없이 GitHub 기반 자동 배포를 구성해야 한다.

## 결정

Cloudflare Pages 대신 Vercel Hobby에 `apps/web` Vite 앱을 배포한다. Supabase는 기존대로 인증, DB, RLS와 Edge Functions를 담당한다.

## 이유

- GitHub 저장소 연결과 Vite 자동 감지가 단순하다.
- push/PR마다 production/preview 배포를 자동 제공한다.
- 개인·비상업 가족 프로젝트는 Hobby 플랜 목적에 부합한다.
- Supabase와 독립되어 향후 호스팅 변경 시 데이터 이관이 필요 없다.

## 결과

- 배포 시 workspace root, build command와 output directory 설정이 필요하다.
- SPA route 새로고침을 위한 rewrite 설정이 필요하다.
- Supabase Auth redirect URL과 Google OAuth redirect 허용 목록에 production/preview URL을 반영해야 한다.
- Hobby 사용량과 비상업 용도 조건을 운영 중 확인한다.
