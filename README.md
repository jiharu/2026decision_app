# 2026 IQAP Major Modifications — Committee Decision Support App

## 1. 프로젝트 개요 (Overview)
- **목적**: 패컬티 커미티(Faculty Curriculum Committee)에서 **IQAP Major Modifications** 문서를 짧은 준비 시간과 부족한 데이터 환경 속에서도 체계적으로 분석(Dissect)하고, 역할 분담 및 의사결정을 신속하게 내릴 수 있도록 돕는 의사결정 지원 웹 애플리케이션.
- **배경 및 핵심 과제**:
  - 준비 시간 부족 및 의사결정에 필요한 근거 데이터 부족 문제를 해결하기 위해, 각 문항의 **기존 답변(Pre-filled)** 과 패컬티가 실제로 채워야 하는 **Gray Zone(핵심 작업 공간)** 을 명확히 분리.
  - 각 Gray Zone 항목을 세부적으로 쪼개어(Dissect), **누가 대답해야 하는지(커미티, 프로그램 체어, 행정부서 등)** 지정하고 **초안(Draft)** 과 **최종안(Finalized)** 을 구분해 작성.
  - 추가 의견이 있는 사람을 위한 옵셔널 입력란, 표(Table) 및 텍스트 편집, 근거 데이터/첨부 문서 연결 기능 제공.
  - **OneDrive (`Share with specific members`)** 환경에서 커미티 멤버들과 안전하게 공유 및 협업할 수 있는 구조 지향.

---

## 2. 전체 문항 구조 (Document Sections & Items)
총 **3개 섹션, 13개 문항**으로 구성됩니다.

| 섹션 (Section) | 문항 번호 (Items) | 문항 수 | 비고 |
| :--- | :--- | :---: | :--- |
| **Part I (Part B)** | 문항 `1`, `2`, `3` | 3문항 | 초기 개요 및 기본 협의 항목 |
| **Part II (Part C)** | 문항 `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11` | 8문항 | 세부 프로그램 수정 및 운영 계획 |
| **Appendixes** | 문항 `A`, `B` | 2문항 | 부록 및 커리큘럼 맵/추가 자료 |

---

## 3. 개별 문항 워크스페이스 구조 (Per-Item Workspace Anatomy)

각 문항(1~11, A, B)은 다음과 같은 계층 구조를 가집니다:

```text
[문항 카드 (Item 1 ~ 11, Appendix A ~ B)]
 ├── 1. 문제 항목 (Question / Prompt)
 │    └── 문항 제목, 원문 질문, 가이드라인 텍스트 입력/표시
 │
 └── 2. 답 항목 (Response Section)
      ├── 2-1. 기존 대답 인풋 (Existing / Pre-filled Answer)
      │    └── CLT 등에서 이미 채워 넣은 기존 답변 텍스트 및 표 보관/표시
      │
      ├── 2-2. Gray Zone (핵심 패컬티 커미티 작업 공간 - Dissection 가능)
      │    ├── [Dissect 단위별 블록 (필요 시 1개 이상으로 쪼개기 가능)]
      │    ├── 2-2-1. 대답 담당자 지정 (Who Can Answer / Primary Assignee)
      │    │    ├── 2-2-1-1. Draft 대답 (초안 작성란: 텍스트 + 테이블)
      │    │    └── 2-2-1-2. Finalized 대답 (최종 확정란: 텍스트 + 테이블)
      │    │
      │    └── 2-2-2. 옵셔널 추가 대답자 (Optional / Secondary Responder)
      │         └── 다른 패컬티/멤버가 추가로 대답하거나 코멘트를 남기는 공간 (텍스트 + 테이블)
      │
      └── 2-3. 데이터 및 추가 문서 첨부 (Attachments & Supporting Data)
           └── 관련 파일 첨부 또는 OneDrive 공유 문서 링크/데이터 테이블 연결
```

### 주요 입력/편집 기능 요구사항
1. **텍스트 & 테이블(표) 지원**:
   - 모든 대답 칸(`2-1`, `2-2-1-1 Draft`, `2-2-1-2 Finalized`, `2-2-2 Optional`)에서 일반 서식 텍스트뿐만 아니라 **표(Table) 생성/편집 및 엑셀·워드 표 복사/붙여넣기** 지원.
2. **Gray Zone Dissection (세분화)**:
   - 하나의 문항 안에서도 여러 쟁점이 섞여 있을 경우, Gray Zone을 하위 항목(Sub-items)으로 쪼개어 각각 담당자(`2-2-1`)를 지정할 수 있는 구조.
3. **데이터 및 문서 첨부 (Attachments)**:
   - 참고 자료(PDF, Excel, 회의록, 시퀀싱 차트 등)를 문항별로 첨부하거나 같은 OneDrive 폴더 내 파일/링크로 연결.

---

## 4. OneDrive ("Share with Specific Members") 구동 설계 방안

OneDrive에서 특정 멤버에게만 공유(`Share with specific members`)하여 앱을 실행할 때, Microsoft OneDrive의 웹 보안 정책(브라우저 내 `.html` 직접 실행 제한 여부)에 따라 다음 **3가지 방식** 중 하나(또는 하이브리드)를 선택할 수 있습니다:

1. **방식 A: 단일 HTML 앱 파일 + 공유 OneDrive 데이터 파일 (권장 / Zero-Server)**
   - OneDrive 공유 폴더 안에 `IQAP_Decision_App.html` (단일 파일 웹앱)과 `iqap_data.json` 및 `attachments/` 폴더를 둡니다.
   - 멤버들은 OneDrive 동기화 폴더(또는 다운로드)에서 HTML 파일을 브라우저로 열고, 폴더 내 `iqap_data.json`을 불러오거나 저장(Auto-save / Export)하며 작업합니다.
   - **장점**: 외부 서버가 전혀 필요 없고, OCAD U OneDrive 권한(`Share with specific members`)만으로 100% 보안 유지.
2. **방식 B: 웹 브라우저 즉시 실행 링크 (Private URL) + OneDrive 파일 연동**
   - 앱 화면 자체는 비공개 웹 링크(암호 보호 또는 비공개 배포)로 열어서 설치/다운로드 없이 브라우저에서 바로 실행하고, 데이터 파일(JSON)과 첨부 문서는 OneDrive 공유 폴더에 저장/연동합니다.
   - **장점**: 회의 중이나 각자 접속할 때 HTML 파일을 다운로드할 필요 없이 링크 클릭만으로 즉시 실행 가능.
3. **방식 C: 실시간 동시 편집(Live Multi-user Sync) 포함 여부**
   - 회의 중 한 명이 화면 공유를 하며 입력하거나 순차적으로 파일을 업데이트하는 방식(비동기 파일 공유) vs. 여러 명이 동시에 각자 컴퓨터에서 같은 화면을 실시간으로 고치는 방식.

---

## 5. 향후 진행 단계 (Next Steps)
1. **세부 요구사항 인터뷰 완료** (협업 방식, 문항 원문 유무, 담당자 프리셋, 첨부파일 방식 등)
2. **데이터 스키마 및 UI 프로토타입 구현** (Part I 1~3, Part II 4~11, Appendixes A~B 기본 세팅)
3. **리치 텍스트/테이블 에디터 및 OneDrive 저장/공유 워크플로우 연결**
4. **최종 테스트 및 커미티 배포용 패키징**
