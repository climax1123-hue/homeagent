# calendar-notifications 구현 기록

## 완료

- PWA manifest, 아이콘, service worker push/click 처리
- 기기별 Web Push 구독/해제와 RLS
- 매일/선택 요일·시간 반복 알림 CRUD
- 일정 연결 알림을 수용하는 DB 모델
- delivery unique key 기반 중복 발송 방지
- 만료 endpoint(404/410) 자동 비활성화
- VAPID 키와 cron secret 서버 설정
- 매분 Supabase Cron과 dispatch Edge Function 배포
- iPhone 홈 화면 설치 안내

## 검증

- 웹 테스트 26개 통과
- TypeScript 및 production build 통과
- 원격 migration `20260826120000` 적용
- dispatch endpoint 무권한 요청 401
- cron job active, 최근 실행 `succeeded`

## 남은 개선

일정 작성 form에서 `시작 N분 전` reminder rule을 함께 저장하는 UI는 반복 알림 안정화 후 보강한다.
