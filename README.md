# 2026 IQAP Major Modifications — Committee Decision Support App

## 1. 프로젝트 개요 (Overview)
- **목적**: 패컬티 커미티(EXAN Curriculum Committee)에서 **IQAP Major Modifications (Co-op & Trimesterization Proposal Brief)** 문서를 짧은 준비 시간과 부족한 데이터 환경 속에서도 체계적으로 분석(Dissect)하고, 역할 분담 및 의사결정을 신속하게 내릴 수 있도록 돕는 의사결정 지원 웹 애플리케이션.
- **배경 및 핵심 과제**:
  - `resource/EXAN Coop Major Mod Brief .pdf`의 **Part I (Part B: 1~3)**, **Part II (Part C: 4~11)**, **Appendixes (A, B)** 총 13개 문항 원문과 CLT 사전 작성 본문(`2-1`), 그리고 대괄호(`[...]`)로 표시된 **Gray Zone 지시문(`2-2`)** 을 모두 추출하여 즉시 작업 가능하도록 구성.
  - 각 Gray Zone 항목을 세부적으로 쪼개어(`+ 세부 항목 쪼개기`), **누가 대답해야 하는지(`2-2-1`)** 자유 텍스트로 지정하고 **초안(`2-2-1-1 Draft`)** 과 **최종안(`2-2-1-2 Finalized`)** 을 구분해 작성.
  - 추가 의견이 있는 사람을 위한 옵셔널 입력란(`2-2-2`), 표(Table) 및 텍스트 편집(엑셀·워드 표 복사/붙여넣기 자동 변환 포함), 근거 데이터/첨부 문서 연결 기능(`2-3`) 제공.
  - 문항별 진행 상태(`미착수`, `데이터 부족/요청 필요`, `Chair/타부서 위임`, `Draft 작성 중`, `Final 완료`)를 한눈에 파악할 수 있는 **대시보드 및 필터** 제공.

---

## 2. 아키텍처: 추천 A (GitHub 단독 통합 + OneDrive 연동 + AES-256 암호화)

1. **웹앱 실행 (GitHub Pages 또는 로컬 실행)**:
   - 외부 DB(Firebase 등) 가입 없이 **GitHub 저장소 하나**로 웹 호스팅(GitHub Pages)과 데이터 동기화(`data/committee-workspace.json`)를 모두 처리합니다.
2. **실시간/준실시간 데이터 동기화 (GitHub Contents API)**:
   - 상단 `⚙️ GitHub 연동 설정`에서 저장소 정보와 Access Token을 입력하면, `⬆️ GitHub 저장 (Push)` 및 `⬇️ Pull` (또는 30초 주기 자동 동기화)로 커미티 멤버 간 데이터를 공유합니다.
   - 언제든 `💾 JSON 백업` / `📂 JSON 열기` 버튼으로 OneDrive 공유 폴더에 백업 파일을 저장하거나 복원할 수 있습니다.
3. **OneDrive (`Share with specific members`) 연동**:
   - 원본 PDF, Registrar 시퀀싱 차트, 예산 자료 등 민감하거나 무거운 파일은 **OCAD U OneDrive 공유 폴더**에 보관하고, 상단 대시보드 및 각 문항 하단 `2-3. 첨부 자료`에 OneDrive 링크를 연결합니다.

---

## 3. 보안 가이드: "문항이 앱에 포함되어 있으면 보안 문제를 뭐라고 대답해야 할까?"

커미티 멤버나 대학 행정 측에서 웹앱 사용에 따른 보안 우려를 질문할 경우, 아래 **3가지 핵심 근거**로 명확히 설명하실 수 있습니다 (앱 상단 `🔒 보안 안내 & 원문 모드` 버튼에서도 언제든 확인 가능):

### 🇰🇷 한국어 설명 포인트
1. **문항 질문 자체는 공개된 대학 표준 양식(Public Policy Template)입니다**:
   - Part B(1~3), Part C(4~11), Appendix(A~B)의 질문은 OCAD U Senate IQAP Policy(2023년 6월 개정 양식)의 표준 템플릿 문항이며, 학생 개인정보(PII)나 인사·성적 같은 기밀 데이터가 전혀 포함되어 있지 않습니다.
2. **원본 PDF 및 민감한 첨부 문서는 GitHub에 올라가지 않고 OCAD U OneDrive에만 보관됩니다**:
   - `resource/` 폴더는 `.gitignore`로 차단되어 원본 PDF가 외부에 업로드되지 않습니다.
   - 실제 시퀀싱 차트, 내부 데이터, 첨부 문서들은 **OCAD U 공식 OneDrive (`Share with specific members`)** 내부에만 두어 OCAD U 계정 권한이 있는 커미티 멤버만 열람할 수 있습니다.
3. **위원회의 내부 작성 의견(Draft/Final)은 AES-256 암호화 및 비공개 키로 보호됩니다**:
   - GitHub 동기화 시 위원회 암호(Passcode)를 설정하면 브라우저 내장 표준 암호화(WebCrypto `AES-256-GCM`)로 암호화되어 저장되며, 검색 엔진 크롤링 방지(`noindex, nofollow, noarchive`)가 적용되어 있습니다.
   - 또한 원하실 경우 앱 내 **`🧹 문항 원문 모두 비우기`** 버튼을 눌러 기본 문항까지 모두 비운 뒤, 회의 시에만 OneDrive의 JSON 파일을 불러와 사용할 수도 있습니다.

### 🇺🇸 English Talking Points (For Committee Colleagues)
> *"No confidential student, HR, or institutional files are hosted publicly. The numbered prompts (1–11, Appendices A–B) are standard OCAD U Senate IQAP template headers. All sensitive supporting documents (PDF briefs, Registrar sequencing charts, spreadsheets) remain strictly inside our institutional OCAD U OneDrive ('Share with specific members'). Furthermore, our committee's working drafts can be synced using client-side AES-256 encryption or saved directly as a JSON file inside our shared OneDrive folder."*

---

## 4. 파일 구조 (Repository Structure)
- [index.html](file:///Users/jiharu/Frodo/OCADU/code_work/2026decision_app/index.html): 메인 애플리케이션 UI 및 보안/GitHub 동기화 모달
- [styles.css](file:///Users/jiharu/Frodo/OCADU/code_work/2026decision_app/styles.css): 반응형 레이아웃, Gray Zone 워크스페이스, 반응형 테이블 및 인쇄용 스타일시트
- [brief-data.js](file:///Users/jiharu/Frodo/OCADU/code_work/2026decision_app/brief-data.js): `EXAN Coop Major Mod Brief .pdf`에서 추출한 13개 문항(Part I 1~3, Part II 4~11, Appendix A~B), 기존 답변(2-1), Gray Zone 초기 세분화 데이터(2-2)
- [app.js](file:///Users/jiharu/Frodo/OCADU/code_work/2026decision_app/app.js): 상태 관리, Gray Zone 세부 항목 쪼개기(`+ Dissect`), 리치 텍스트/표 편집기, AES-256-GCM 암호화, GitHub API 동기화 및 JSON 백업 로직
- [.gitignore](file:///Users/jiharu/Frodo/OCADU/code_work/2026decision_app/.gitignore): `resource/` 폴더(원본 PDF 보관 폴더)를 Git 추적에서 제외하여 외부 유출 방지
