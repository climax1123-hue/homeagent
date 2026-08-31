# statement-import - Gap Analysis

> Date: 2026-08-28 | Iteration: 1 | Match Rate: 94%

## 1. 요약

초기 분석의 25개 검사항목 중 18개 일치(72%)에서 Iterate 후 23.5개 상당이 일치(94%)한다. 파일 형식 검사, sheet/인코딩 선택, 행 전체 수정, 기존 원장 중복 후보, 모바일 카드 UI와 합성 XLSX 테스트를 보완했다.

## 2. 항목별 비교

| 영역                     | 결과    | 근거 또는 Gap                                            |
| ------------------------ | ------- | -------------------------------------------------------- |
| CSV/XLSX 입력            | Match   | parser와 file input 구현                                 |
| 10MB/10,000행 제한       | Match   | parser에서 강제                                          |
| UTF-8/CP949 후보 처리    | Match   | 자동 판별 구현                                           |
| CSV delimiter/quote      | Match   | 쉼표·탭·세미콜론과 quote 처리                            |
| 실제 파일 signature      | Match   | XLSX ZIP signature와 CSV 위장 검사                       |
| XLSX sheet 선택          | Match   | 복수 sheet select와 재파싱                               |
| CSV 인코딩 재선택        | Match   | UTF-8/CP949 select와 재파싱                              |
| 자동/수동 열 매핑        | Match   | alias 탐지와 select 제공                                 |
| 날짜/금액/방향 정규화    | Match   | bigint 문자열과 서울 달력일 처리                         |
| Excel serial date        | Match   | serial 변환 구현                                         |
| 행별 오류와 원본 행 번호 | Match   | error code와 sourceRowNumber 유지                        |
| 행별 포함/제외           | Match   | checkbox 제공                                            |
| 행별 일자·유형·금액 수정 | Match   | 수정 즉시 정규화·fingerprint 재계산                      |
| 행별 메모 수정           | Match   | 모바일 포함 편집 UI 제공                                 |
| 파일 fingerprint 중복    | Match   | DB unique/RPC 오류                                       |
| batch 내부 행 중복       | Match   | unique(batch,row_fingerprint)                            |
| 기존 원장 중복 후보      | Match   | 권한 검증 RPC로 조회, 자동 제외 후 재포함 가능           |
| 원자적 commit            | Match   | SECURITY DEFINER 단일 transaction                        |
| family/private 권한      | Match   | `can_read_ledger_book`과 trigger                         |
| 원본 파일 미보관         | Match   | hash와 메타데이터만 저장                                 |
| 결과 요약                | Match   | 반영 건수 표시                                           |
| PC 검토 표               | Match   | sticky header 표                                         |
| 390px 모바일 카드        | Match   | 760px 이하에서 행별 카드로 전환                          |
| 합성 parser 테스트       | Partial | 8개 통과, CP949 byte fixture와 10,000행 성능 측정은 후속 |
| RLS/rollback 테스트      | Partial | SQL 테스트 작성, 로컬 Docker 미가동으로 미실행           |

## 3. Iterate 결과

1. 실제 XLSX ZIP signature와 CSV binary 오인 방지 완료
2. XLSX sheet 및 CSV 인코딩 재선택 UI 완료
3. 행별 일자·유형·금액·거래처·메모 수정과 재검증 완료
4. 기존 transaction 중복 후보 RPC/UI 및 클라우드 적용 완료
5. 390px 카드형 행 레이아웃 완료
6. 합성 XLSX·signature·수정 재검증 테스트 추가 완료

## 4. 판단

Match Rate 94%로 Report 기준을 충족한다. 잔여 항목은 Docker 복구 후 pgTAP 실행, 실제 익명화 은행 샘플 호환성, Web Worker 필요성 성능 측정이다.
