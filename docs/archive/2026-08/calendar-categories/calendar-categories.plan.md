# calendar-categories - Plan Document

> Version: 1.0.0 | Date: 2026-08-26 | Status: Approved | Level: Dynamic

## 1. Overview

가족 구성원이 만든 일정을 한눈에 구분하고 필요한 일정만 골라 볼 수 있게 한다. 일정 상세에서는 해당 일정을 Google Calendar 작성 화면으로 전달한다.

## 2. Goals

- [ ] 일정 카드에 등록자 이름과 공개 범위를 항상 표시한다.
- [ ] 전체, 가족 공유, 내 일정, 개인 일정, 구성원별 필터를 제공한다.
- [ ] 구성원별 색상 표식을 일관되게 적용한다.
- [ ] 일정 상세에서 Google Calendar에 단건 추가할 수 있다.

## 3. Scope

### In Scope

- 기존 `household_members`의 표시 이름 재사용
- 활성 구성원 필터와 접근 가능한 일정의 클라이언트 필터링
- 등록자별 고정 색상 토큰, 범례, 일정 카드 표식
- Google Calendar event template URL 생성
- PC·모바일 반응형 및 테스트

### Out of Scope

- 새로운 일정 분류 DB 테이블
- Google OAuth, 자동/양방향 동기화, Google 일정 가져오기
- 공개 ICS 구독 URL

## 4. Success Criteria

- [ ] 본인과 다른 가족의 일정이 이름과 색으로 구분된다.
- [ ] 공개 범위 및 구성원 필터가 월·주·목록 보기에 동일하게 적용된다.
- [ ] 개인 일정은 기존 RLS 범위를 넘어 노출되지 않는다.
- [ ] 일반·종일·반복 일정의 Google 작성 URL이 올바르다.
- [ ] `pnpm check`가 통과한다.

## 5. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| 일정 자체 색상과 등록자 색상 혼동 | 일정 색은 배경, 등록자 색은 좌측 선·점으로 역할 분리 |
| 탈퇴 구성원 이름 누락 | 알 수 없는 구성원 fallback 제공 |
| Google 단건 추가를 동기화로 오해 | 버튼에 단건 복사임을 명시하고 안내 문구 제공 |

## 6. Google Integration Review

1차는 OAuth가 필요 없는 단건 추가를 제공한다. 전체 자동 동기화는 `calendar-google-sync`에서 Google OAuth, 최소 scope, Supabase Edge Function, 암호화된 refresh token, 외부 ID 매핑과 충돌 정책을 설계한다.
