# 2026 IQAP Major Modifications — Committee Decision Support App

## 1. Overview
- **Purpose**: A decision-support web application designed for the **Experimental Animation (EXAN) Curriculum Committee** at OCAD University to systematically dissect, assign, draft, and finalize responses for the **IQAP Major Modifications Proposal Brief (Co-op & Trimesterization)** under tight timelines and limited data conditions.
- **Core Capabilities**:
  - Pre-populated with all 13 items from the **IQAP Major Modification Proposal Brief**:
    - **Part I (Part B: Proposed Major Modification)**: Items `1`, `2`, `3`
    - **Part II (Part C: Evaluation Criteria)**: Items `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`
    - **Appendixes**: `Appendix A`, `Appendix B`
  - Clearly separates **1. Question / Prompt**, **2-1. Existing / Pre-filled Answer** (pre-populated by CLT/administration), and **2-2. Gray Zone** (the core workspace where the faculty committee dissects and responds to required items).
  - Supports **multi-part Gray Zone Dissection (`+ Add Dissected Sub-item`)** so complex questions can be split into sub-issues, each with:
    - **2-2-1. Who Can Answer (Primary Responder / Assignee)** — free-text input
    - **2-2-1-1. Draft Response** — rich text and interactive table editor (supports direct Excel/Word table copy-paste)
    - **2-2-1-2. Finalized Response** — rich text and interactive table editor with 1-click `Copy Draft ➔ Final`
    - **2-2-2. Optional Responder** — free-text contributor field and rich text/table response editor
  - **2-3. Supporting Data & Attached Documents** — link directly to institutional OneDrive (`Share with specific members`) files or attach files up to 2MB.
  - **Status Dashboard & Filtering** — filter items by section, keyword search, or status (`Not Started`, `Needs Data / Info Requested`, `Delegate to Chair / Other Unit`, `Draft in Progress`, `Finalized`).

---

## 2. Architecture: GitHub Repository Sync + OneDrive Integration + AES-256 Encryption

1. **Zero-Server Web App Hosting (GitHub Pages or Local)**:
   - Hosted via GitHub Pages (or run locally in any modern browser) with no external database dependencies.
2. **GitHub Cloud Sync (`⚙️ GitHub Sync Setup`)**:
   - Reads and writes the shared workspace state (`data/committee-workspace.json`) directly to the GitHub repository via the GitHub Contents API (`⬇️ Pull` / `⬆️ Save to GitHub (Push)`), with optional 30-second auto-polling.
   - Includes 1-click `💾 Export JSON` and `📂 Import JSON` for saving snapshots directly to the shared OneDrive folder.
3. **Institutional OneDrive (`Share with specific members`) Integration**:
   - Sensitive or large supporting files (original PDFs, Registrar sequencing charts, spreadsheets) remain strictly inside OCAD U's institutional OneDrive folder and are linked by URL reference.

---

## 3. Security & Privacy Architecture

1. **Standard University Policy Template Headers**:
   - The numbered prompts (Items 1–11 and Appendices A–B) are standard OCAD U Senate IQAP Policy (June 2023) template questions and contain zero student PII, HR records, or confidential data.
2. **Source Documents Excluded from Git**:
   - The `resource/` directory is listed in `.gitignore` so raw institutional PDFs are never committed to GitHub.
   - All sensitive supporting documents stay inside OCAD U's Microsoft 365 OneDrive (`Share with specific members`).
3. **Client-Side AES-256-GCM Encryption & Template Mode Toggle**:
   - Setting a **Committee Encryption Passcode** in `⚙️ GitHub Sync Setup` encrypts the JSON workspace in the browser using WebCrypto `AES-256-GCM` before uploading to GitHub.
   - Via `🔒 Security & Template Mode`, the app can also be switched at any time between the **Pre-Extracted EXAN Brief Template** and a **Blank Template Mode** (manual input / JSON load only).

---

## 4. Repository Structure
- [index.html](file:///Users/jiharu/Frodo/OCADU/code_work/2026decision_app/index.html): Application shell, dashboard filters, GitHub sync modal, and security modal
- [styles.css](file:///Users/jiharu/Frodo/OCADU/code_work/2026decision_app/styles.css): Responsive layout, Gray Zone workspace styling, container-query tables, dark mode, and print styles
- [brief-data.js](file:///Users/jiharu/Frodo/OCADU/code_work/2026decision_app/brief-data.js): Pre-extracted questions, CLT pre-filled text, and initial Gray Zone sub-items for Items 1–11 and Appendices A–B
- [app.js](file:///Users/jiharu/Frodo/OCADU/code_work/2026decision_app/app.js): State management, Gray Zone dissection, rich text/table editor, WebCrypto `AES-256-GCM` encryption, and GitHub API sync
- [.gitignore](file:///Users/jiharu/Frodo/OCADU/code_work/2026decision_app/.gitignore): Excludes `resource/` and system files from version control
