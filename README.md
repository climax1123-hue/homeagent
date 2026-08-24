# 우리집 웹사이트

일정, 가계부, 디데이, 목표를 가족 단위로 관리하는 반응형 웹 애플리케이션입니다.

## 요구 환경

- Node.js 22 이상
- pnpm 11

## 시작하기

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

개발 서버는 기본적으로 `http://localhost:5173`에서 실행됩니다.

## 검증

```powershell
pnpm check
```

`check`는 lint, TypeScript 검사, 테스트, 프로덕션 빌드를 순서대로 실행합니다.

## 워크스페이스

- `apps/web`: React 기반 반응형 웹
- `packages/shared`: 여러 앱과 서비스에서 공유하는 타입과 상수
- `packages/design-system`: 공통 UI 토큰과 컴포넌트
- `packages/statement-parser`: 은행 명세 파싱·정규화·분류
- `services/analytics`: 향후 Python 분석 서비스가 들어갈 위치
- `supabase`: 향후 migration, Edge Function, RLS 테스트가 들어갈 위치
- `docs`: 제품·기능·아키텍처 명세

