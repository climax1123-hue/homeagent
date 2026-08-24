# 우리집 웹사이트 개발 지침

## 제품 목표

부부가 일정, 가계부, 디데이, 목표를 안전하게 공유하는 PC·모바일 반응형 웹을 만든다.

## 기술 구성

- React + TypeScript + Vite
- pnpm workspace
- Supabase PostgreSQL, Auth, RLS
- Vitest, Playwright
- 향후 Python FastAPI 분석 서비스

## 필수 원칙

- 모든 업무 데이터는 `household_id`를 통해 격리한다.
- 모든 공개 업무 테이블에 RLS를 적용한다.
- 금액 계산에 JavaScript 부동소수점 연산을 사용하지 않는다.
- 날짜와 시간은 UTC 저장, `Asia/Seoul` 표시를 기본으로 한다.
- `service_role`과 OAuth refresh token을 클라이언트에 노출하지 않는다.
- 실제 금융 명세나 개인정보를 테스트 fixture로 커밋하지 않는다.
- 모바일의 주요 터치 영역은 최소 44px로 만든다.
- 기존 DB migration을 수정하지 않고 새 migration을 추가한다.

## 작업 방식

- 작업 전에 관련 `docs/features` 문서를 읽는다.
- 한 작업에서는 하나의 기능 또는 결함만 다룬다.
- 기존 컴포넌트, 타입, 유틸리티를 우선 재사용한다.
- 변경한 동작에 대한 테스트를 추가한다.
- UI 변경은 PC와 모바일 너비에서 확인한다.
- DB 변경은 RLS 권한 테스트를 포함한다.
- 작업 후 `pnpm check`를 실행한다.

## 완료 조건

- 요청의 인수 조건을 충족한다.
- lint와 TypeScript 오류가 없다.
- 관련 테스트와 프로덕션 빌드가 통과한다.
- 권한 경계를 우회할 수 없다.
- 문서와 실제 동작이 일치한다.
