# Web Push 알림 아키텍처

## 구성

```text
Web / PWA
  ├─ Service Worker
  └─ Push subscription 등록
          ↓
Supabase PostgreSQL
  ├─ notification rules
  ├─ push subscriptions
  └─ delivery jobs
          ↓
Supabase Cron → Edge Function → Web Push provider → PC / Android / iPhone PWA
```

## 예약 전략

모든 개인 알림마다 별도 Cron job을 만들지 않는다. 하나의 주기적 dispatcher가 가까운 발송 작업을 batch로 가져와 처리한다.

- 반복 규칙 변경 시 다음 발송 시각 재계산
- DB에는 발송 예정 시각을 UTC로 저장
- 표시와 반복 계산에는 사용자 시간대 사용
- `rule_id + scheduled_at + target_user_id`로 중복 발송 방지
- 여러 dispatcher가 실행돼도 하나만 작업을 점유하도록 DB lock 사용

## Push 구독

- 사용자·브라우저·기기별 복수 구독 허용
- endpoint, `p256dh`, `auth` key를 민감정보로 저장
- 발송 API가 구독 만료를 반환하면 즉시 비활성화
- 마지막 성공, 실패 코드와 사용자 에이전트의 최소 정보 저장

## Service Worker

- 백그라운드 Push 수신
- 알림 제목, 내용과 앱 내 이동 URL 표시
- 알림 클릭 시 기존 앱 창을 활성화하거나 새 창 열기
- 동일 알림 tag를 사용해 중복 표시 방지

## 재시도

- 일시적 네트워크 오류와 5xx는 제한된 지수 백오프
- 폐기된 endpoint는 재시도하지 않음
- 발송 결과를 `pending`, `processing`, `sent`, `failed`, `expired`로 기록
- 재시도 후 이미 만료된 일정 알림은 발송하지 않음

## 개인정보

잠금 화면에 민감한 일정 제목이나 약 이름이 노출될 수 있다. 사용자가 알림 미리보기 수준을 선택할 수 있게 한다.

- 전체 내용 표시
- `예정된 알림이 있습니다`처럼 제목 숨김
- 잠금 화면 Push 사용 안 함
