# 2026 IQAP Major Modifications — Committee Decision Support App

## 1. Overview
- **Purpose**: A decision-support web application designed for the **Experimental Animation (EXAN) Curriculum Committee** at OCAD University to systematically dissect, assign, draft, and finalize responses for the **IQAP Major Modifications Proposal Brief (Co-op & Trimesterization)** under tight timelines and limited data conditions.
- **Design & Privacy Principles**:
  - **100% English UI** with a stark **OCAD U Black & White (Monochrome)** theme.
  - **Zero Personal Data (PII-Free)**: All examples, placeholders, and pre-populated consultation records use institutional role titles and department names only (no personal names).
  - **Works Locally (`file://`) & on the Web (`https://`)**: Can be opened directly by double-clicking `index.html` in Finder/Explorer or hosted via GitHub Pages.

---

## 2. Document Structure & Per-Item Workspace Hierarchy

The application covers all **13 items** across **3 sections**:
- **Part B: Proposed Major Modification**: Items `1`, `2`, `3`
- **Part C: Evaluation Criteria**: Items `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`
- **Appendixes**: `Appendix A`, `Appendix B`

Each item uses its own question number (`N` = `1`..`11`, `A`, `B`) as the prefix across its workspace sections:

```text
[Item Card #N (1–11, Appendix A–B)]
 ├── N. Question / Prompt (IQAP Major Modification Brief)
 │    ├── Official question text (editable via "Edit Question / Title")
 │    └── Reference Data & Stakeholder Input Bar (item-specific quick buttons):
 │         • Item #1:  [↗ Original Proposal for the New EXAN Program]
 │         • Item #2:  [▣ Program Chair Input]
 │         • Item #3:  [▣ CLT Input]  [↗ Student Survey]
 │         • Item #4:  [↗ Curriculum Map]
 │         • Item #9:  [▣ Program Chair Input]  [▣ Dean Input]
 │         • Item #11: [▣ Dean Input]
 │
 ├── N-1. Existing / Pre-filled Answer Input
 │    └── Collapsible rich-text & table editor pre-populated with CLT/administration text
 │
 ├── N-2. GRAY ZONE (Faculty Committee Core Workspace — Dissect & Assign)
 │    └── [+ Add Dissected Sub-item] button to split complex issues into multiple parts
 │         ├── Dissected Part Header & Prompt Textarea
 │         ├── N-2-1. Who Can Answer (Primary Responder / Assignee — free-text input)
 │         ├── [2-Column Side-by-Side Grid]
 │         │    ├── Left:  N-2-1-1. Draft Response (rich text + interactive tables)
 │         │    └── Right: N-2-2. Optional Responder (free-text contributor + rich text/tables)
 │         └── [Full-Width Bottom Box]
 │              └── N-2-1-2. Finalized Response (rich text + tables) + [✓ Complete] Checkbox
 │
 └── N-3. Supporting Data & Attached Documents
      └── Link to institutional OneDrive ("Share with specific members") files or attach files (≤ 2MB)
```

### Quick Jump Progress Color Indicators
Located at the top dashboard bar next to `Quick Jump:`:
- **Active Default (High-Contrast Monochrome)**: Committee items requiring input (`#1, #2, #3, #5, #9, #10, #11, Appendix A, Appendix B`) with no `Finalized Response` content yet.
- **No Input Needed (Grey `#6b7280`)**: Pre-filled items that do not require committee response (**`#4`, `#6`, `#7`, `#8`**).
- **In Progress (Orange `#ea580c`)**: Automatically turns **Orange** as soon as text or a table is entered into `N-2-1-2. Finalized Response`.
- **Complete (Blue `#2563eb`)**: Automatically turns **Blue** when the **`[✓] Complete`** checkbox next to `N-2-1-2. Finalized Response` is checked.

---

## 3. Step-by-Step Deployment, Security & Sharing Guide (Next Session Checklist)

### Step 1. Create a GitHub Repository
1. Sign in to [github.com](https://github.com) and click **`+`** ➔ **`New repository`**.
2. Set **Repository name** to `2026decision_app`.
3. Leave "Add a README file" unchecked and click **`Create repository`**.

### Step 2. Push Local Repository to GitHub
Run the following commands in Terminal (replace `<your-github-username>` with your GitHub account username):
```bash
git -C "/Users/jiharu/Frodo/OCADU/code_work/2026decision_app" remote add origin https://github.com/<your-github-username>/2026decision_app.git
git -C "/Users/jiharu/Frodo/OCADU/code_work/2026decision_app" push -u origin main
```
*(Note: The `resource/` folder containing the source PDF is excluded via `.gitignore` and will never be uploaded to GitHub.)*

### Step 3. Enable GitHub Pages (Web App Link)
1. In your GitHub repository, go to **`Settings`** ➔ **`Pages`** (left sidebar).
2. Under **Build and deployment**, set **Branch** to **`main`** (`/ (root)`) and click **`Save`**.
3. Wait ~1 minute for the live URL: `https://<your-github-username>.github.io/2026decision_app/`.

### Step 4. Generate a Scoped GitHub Access Key (Fine-Grained PAT)
1. On GitHub, go to your profile icon (top right) ➔ **`Settings`** ➔ **`Developer settings`** (bottom left).
2. Click **`Personal access tokens`** ➔ **`Fine-grained tokens`** ➔ **`Generate new token`**.
3. Configure the token:
   - **Token name**: `EXAN-Committee-App`
   - **Expiration**: Set to match the committee review period (e.g., 30 or 90 days)
   - **Repository access**: Select **`Only select repositories`** ➔ choose **`2026decision_app`** only
   - **Permissions** ➔ **Repository permissions** ➔ **`Contents`**: Set to **`Read and write`**
4. Click **`Generate token`** and copy the generated `github_pat_...` key.

### Step 5. Configure Encryption & Share via OCAD U OneDrive ("Share with specific members")
1. Open the web app and click **`⚙ GitHub Sync Setup`**.
2. Enter:
   - **GitHub Owner**: `<your-github-username>`
   - **Repository Name**: `2026decision_app`
   - **GitHub Access Key**: The `github_pat_...` token from Step 4
   - **Committee Encryption Passcode**: A shared password for the committee (enables client-side WebCrypto `AES-256-GCM` encryption on `data/committee-workspace.json`)
3. Click **`↑ Push to GitHub Now`** to initialize the encrypted workspace file in the repository.
4. *(Optional extra privacy)*: Click **`■ Security & Template Mode`** ➔ **`○ Clear to Blank Template Mode`** if you want the initial HTML shell to display blank placeholders until a committee member clicks `↓ Pull`.
5. Inside your institutional **OCAD U OneDrive (`Share with specific members`)** folder:
   - Store all confidential supporting files (original PDF brief, Registrar sequencing charts, spreadsheets) and paste the folder link into the app's **Shared OneDrive Folder** field.
   - Share the **Web App URL**, **GitHub Access Key**, and **Committee Encryption Passcode** with your fellow committee members inside the restricted OneDrive folder.

---

## 4. Repository Structure & Upcoming Tasks
- `index.html`: Application shell, dashboard filters, GitHub sync modal, and security modal
- `styles.css`: Monochrome Black & White theme, Orange/Blue Quick Jump indicators, responsive container-query tables, and print styles
- `brief-data.js`: Pre-extracted questions, anonymized CLT pre-filled text, and initial Gray Zone sub-items for Items 1–11 and Appendices A–B
- `app.js`: State management, Gray Zone dissection, rich text/table editor, `Complete` checkbox & Quick Jump state sync, WebCrypto `AES-256-GCM` encryption, and GitHub API sync
- `.gitignore`: Excludes `resource/` and local system files from Git tracking

### Next Session To-Do List
- [ ] Connect local Git repository to remote GitHub account (`git remote add origin` & `git push`)
- [ ] Enable GitHub Pages and verify live web URL
- [ ] Generate Fine-grained Personal Access Token and test `↑ Push` / `↓ Pull` with AES-256-GCM encryption
- [ ] Connect OCAD U OneDrive (`Share with specific members`) folder and verify end-to-end sharing workflow for committee members
