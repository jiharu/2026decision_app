# 2026 IQAP Major Modifications — Committee Decision Support App

https://jiharu.github.io/2026decision_app/

## 1. Overview
- **Purpose**: A real-time collaborative decision-support web application designed for the **Experimental Animation (EXAN) Curriculum Committee** at OCAD University to systematically dissect, assign, draft, and finalize responses for the **IQAP Major Modifications Proposal Brief (Co-op & Trimesterization)** under tight timelines and limited data conditions.
- **Design & Privacy Principles**:
  - **100% English UI** with a stark **OCAD U Black & White (Monochrome)** theme.
  - **Zero Personal Data (PII-Free)**: All examples, placeholders, and pre-populated consultation records use institutional role titles and department names only (no personal names).
  - **Real-Time Multi-User Sync (Firebase Firestore — Toronto, Canada)** + **Zero-Install Hosting (GitHub Pages)** + **Institutional File Storage (OCAD U OneDrive `Share with specific members`)**.

---

## 2. Document Structure & Per-Item Workspace Hierarchy

The application covers all **13 items** across **3 sections**:
- **Part B: Proposed Major Modification**: Items `1`, `2`, `3`
- **Part C: Evaluation Criteria**: Items `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`
- **Appendices**: `Appendix A`, `Appendix B`

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

## 3. Real-Time Collaboration Architecture (GitHub Pages + Firebase Firestore)

1. **Per-Item Real-Time Sync (`workspaces/exan-2026/items/{item.id}`)**:
   - Each of the 13 items is stored as an independent Firestore document, preventing overwrite conflicts when all 4 committee members work simultaneously on different questions.
   - Edits sync across signed-in members in ~0.5 seconds without interrupting cursor focus in other items.
2. **Server-Side 4-Member Access Control (Firestore Security Rules)**:
   - Hosted in **Toronto, Canada (`northamerica-northeast2`)** under Firebase project `exan2026-decisionapp`.
   - Supports **self-service first-time `@ocadu.ca` password setup** (`First-Time Setup: Create Password`), returning `Sign In`, `Forgot Password?` email reset, and optional Google Sign-In.
   - Firestore Security Rules restrict all reads/writes strictly to the 4 authorized committee `@ocadu.ca` email addresses (stored privately in Firebase Console, never committed to GitHub):
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /workspaces/exan-2026/{document=**} {
         allow read, write: if request.auth != null
           && request.auth.token.email in [
             'member1@ocadu.ca',
             'member2@ocadu.ca',
             'member3@ocadu.ca',
             'member4@ocadu.ca'
           ];
       }
     }
   }
   ```
3. **Deployment & Sharing Status (Completed)**:
   - Deployed live on **GitHub Pages** (`https://jiharu.github.io/2026decision_app/`) with `jiharu.github.io` registered in Firebase **Authorized domains**.
   - Real-time Firestore sync verified (`Live Sync · 13 items synced`).
   - A 1-page English colleague onboarding handout (`resource/EXAN_Decision_App_Quick_Guide.pdf`, git-ignored) is ready to share alongside the institutional **OCAD U OneDrive (`Share with specific members`)** folder.

---

## 4. Repository Structure
- `index.html`: Application shell, official OCAD U logo/favicon, dashboard filters, Firebase Sign-In modal, security modal, and reference input modal
- `styles.css`: Monochrome Black & White theme (including automatic white OCAD U logo rendering in dark mode), Grey/Orange/Blue Quick Jump indicators, responsive tables, and print styles
- `assets/ocadu-logo.png`: Official OCAD University monochrome logo used in the app header and browser favicon
- `firebase-config.js`: Firebase Web App configuration for `exan2026-decisionapp`
- `brief-data.js`: Pre-extracted questions, anonymized CLT pre-filled text, item-specific reference buttons, and initial Gray Zone sub-items for Items 1–11 and Appendices A–B
- `app.js`: State management, per-item real-time Firestore sync, self-service password creation/reset, Gray Zone dissection, rich text/table editor, `Complete` checkbox & Quick Jump sync, and Print/PDF report export
- `.gitignore`: Excludes `resource/` (source PDF brief & 1-page colleague guide PDF) and local system files from Git tracking
