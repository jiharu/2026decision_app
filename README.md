# 2026 IQAP Major Modifications — Committee Decision Support App

https://jiharu.github.io/2026decision_app/

## 1. Overview
- **Purpose**: A real-time collaborative decision-support web application designed for the **Experimental Animation (EXAN) Curriculum Committee** at OCAD University to systematically dissect, assign, draft, and finalize responses for the **IQAP Major Modifications Proposal Brief (Co-op & Trimesterization)** under tight timelines and limited data conditions.
- **Design & Privacy Principles**:
  - **100% English UI** with a stark **OCAD U Black & White (Monochrome)** theme, a borderless dark-grey header block (`#242424`) with the white OCAD U logo, and a streamlined 3-button toolbar (`Sign In (Live Sync)`, `Security & Template Mode`, `Print / Export PDF`).
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

1. **Per-Item Real-Time Sync & Field-Level 3-Way Merge (`workspaces/exan-2026/items/{item.id}`)**:
   - Each of the 13 items is stored as an independent Firestore document (`workspaces/exan-2026/items/{item.id}`), and shared workspace metadata (such as the OneDrive folder link) is stored separately in `workspaces/exan-2026/meta/info`.
   - **Concurrent Same-Item Editing**: Input handlers dynamically resolve live item/sub-item records by ID (eliminating stale card closures), apply **surgical field-level DOM updates** (skipping only the single active focused input while updating all other boxes in the same card live), and run a **3-way field-level merge** against the last synced cloud snapshot so all 4 committee members can simultaneously edit different items or different boxes within the same item (`Who Can Answer`, `Draft Response`, `Optional Responder`, `Finalized Response`, or separate Dissected Sub-items).
   - **Data Safety & Clean Sync**: Independent startup readiness guards (`metaSyncReady`, `itemsSyncReady`) prevent local cache from ever overwriting existing Firestore data on sign-in; sync hashes update only after `batch.commit()` succeeds; pending edits flush on `visibilitychange`; and manual `Push Current Local State to Cloud` and JSON Export/Import controls were intentionally removed to prevent accidental overwrites and keep the UI focused on live sync + `Print / Export PDF`.
   - **Concurrent Editing Note**: Sync operates per field/box rather than character-by-character (unlike Google Docs). Members should avoid typing inside the exact same single text box at the exact same moment—use **Optional Responder** or **+ Add Dissected Sub-item** when contributing simultaneously on the same item.
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
3. **Deployment & Sharing Status (Completed & Multi-Member Tested)**:
   - Deployed live on **GitHub Pages** (`https://jiharu.github.io/2026decision_app/`) with `jiharu.github.io` registered in Firebase **Authorized domains**.
   - Real-time multi-member Firestore collaboration verified across committee accounts (`Live Sync`).
   - A 1-page English colleague onboarding handout (`resource/EXAN_Decision_App_Quick_Guide.pdf`, git-ignored, matching borderless dark-grey header with white OCAD U logo) is ready to share alongside the institutional **OCAD U OneDrive (`Share with specific members`)** folder.

---

## 4. Repository Structure
- `index.html`: Application shell, official OCAD U logo/favicon, streamlined 3-button header, dashboard filters, Firebase Sign-In modal, security modal, reference input modal, and cache-busted asset links (`styles.css?v=3`, `app.js?v=2`)
- `styles.css`: Monochrome Black & White theme with a borderless dark-grey header block (`#242424`) and inverted white OCAD U logo, Grey/Orange/Blue Quick Jump indicators, responsive tables, and print styles
- `assets/ocadu-logo.png`: Official OCAD University monochrome logo used in the app header and browser favicon
- `firebase-config.js`: Firebase Web App configuration for `exan2026-decisionapp`
- `brief-data.js`: Pre-extracted questions, anonymized CLT pre-filled text, item-specific reference buttons, and initial Gray Zone sub-items for Items 1–11 and Appendices A–B
- `app.js`: State management, per-item real-time Firestore sync with field-level 3-way merge & surgical DOM updates, self-service password creation/reset, Gray Zone dissection, rich text/table editor, `Complete` checkbox & Quick Jump sync, and Print/PDF report export
- `.gitignore`: Excludes `resource/` (source PDF brief & 1-page colleague guide PDF) and local system files from Git tracking
