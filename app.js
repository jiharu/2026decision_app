const STORAGE_KEY = "ocadu_exan_iqap_decision_app_v2";
const GITHUB_CONFIG_KEY = "ocadu_exan_iqap_github_config_v1";

const ALLOWED_ELEMENTS = [
  "p", "b", "i", "strong", "em", "u", "mark", "ul", "ol", "li", "br",
  "div", "span", "table", "thead", "tbody", "tr", "th", "td", "caption",
  "h3", "h4", "blockquote", "a"
];

const ALLOWED_ATTRIBUTES = [
  "class", "href", "target", "rel", "colspan", "rowspan", "type",
  "tabindex", "role", "aria-label", "aria-labelledby"
];

/**
 * Safely sanitize and insert HTML into an element following modern-web-guidance (sanitize-untrusted-html)
 */
function safeSetHTML(el, rawHtml) {
  const html = rawHtml || "";
  if ("setHTML" in Element.prototype) {
    try {
      el.setHTML(html, {
        sanitizer: {
          elements: ALLOWED_ELEMENTS,
          attributes: ALLOWED_ATTRIBUTES
        }
      });
      return;
    } catch {
      // Fall through to DOMParser sanitizer if browser Sanitizer config signature differs
    }
  }
  el.innerHTML = sanitizeHTMLString(html);
}

function sanitizeHTMLString(rawHtml) {
  if (!rawHtml) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");
  const allowedSet = new Set(ALLOWED_ELEMENTS.map((t) => t.toUpperCase()));
  const allowedAttrSet = new Set(ALLOWED_ATTRIBUTES.map((a) => a.toLowerCase()));

  function cleanNode(node) {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toUpperCase();
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH"].includes(tag)) {
          child.remove();
          continue;
        }
        if (!allowedSet.has(tag)) {
          cleanNode(child);
          child.replaceWith(...Array.from(child.childNodes));
          continue;
        }
        for (const attr of Array.from(child.attributes)) {
          const name = attr.name.toLowerCase();
          const val = attr.value.trim();
          if (name.startsWith("on") || !allowedAttrSet.has(name)) {
            child.removeAttribute(attr.name);
          } else if (name === "href" && /^javascript:/i.test(val)) {
            child.removeAttribute(attr.name);
          }
        }
        cleanNode(child);
      }
    }
  }

  cleanNode(doc.body);
  return doc.body.innerHTML;
}

/**
 * Client-Side Authenticated Encryption (AES-GCM 256-bit with 12-byte random IV & AAD)
 * following modern-web-guidance (client-side-encryption)
 */
async function deriveAesGcmKey(passcode, saltBytes) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 120000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function encryptWorkspacePayload(plainObject, passcode) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesGcmKey(passcode, salt);
  const additionalData = new TextEncoder().encode("ocadu-iqap-v1");
  const encoded = new TextEncoder().encode(JSON.stringify(plainObject));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    encoded
  );

  return {
    encrypted: true,
    version: "ocadu-iqap-v1",
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
    updatedAt: new Date().toISOString()
  };
}

async function decryptWorkspacePayload(envelope, passcode) {
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const key = await deriveAesGcmKey(passcode, salt);
  const additionalData = new TextEncoder().encode(envelope.version || "ocadu-iqap-v1");

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    ciphertext
  );

  const jsonStr = new TextDecoder().decode(plainBuffer);
  return JSON.parse(jsonStr);
}

// ============================================================================
// Application State Management
// ============================================================================
let appState = loadInitialState();
let activeSectionFilter = "all";
let activeStatusFilter = "all";
let searchQuery = "";
let questionEditMode = {}; // { [itemId]: boolean }
let cardOpenState = {}; // { [itemId]: boolean }
let existingOpenState = {}; // { [itemId]: boolean }
let autoSyncTimer = null;

function cloneDefaultState() {
  return {
    metadata: structuredClone(INITIAL_BRIEF_METADATA),
    items: structuredClone(INITIAL_ITEMS)
  };
}

function normalizeLoadedState(state) {
  if (!state || !Array.isArray(state.items)) return state;
  for (const item of state.items) {
    if (item.sectionId === "part1") {
      item.sectionLabel = "Part B: Proposed Major Modification";
    } else if (item.sectionId === "part2") {
      item.sectionLabel = "Part C: Evaluation Criteria";
    }
  }
  return state;
}

function getItemPrefix(item) {
  return String(item.code || "1").replace(/^Appendix\s+/i, "").trim();
}

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return normalizeLoadedState(parsed);
      }
    }
  } catch (err) {
    console.warn("Failed to load state from localStorage, using defaults:", err);
  }
  return cloneDefaultState();
}

function saveStateLocally(statusMsg = "Auto-saved locally") {
  appState.metadata.lastUpdated = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    updateSyncStatusUI("ok", `${statusMsg} · ${formatShortTime(appState.metadata.lastUpdated)}`);
    renderDashboardCountsOnly();
  } catch (err) {
    console.error("Local save error:", err);
    updateSyncStatusUI("warning", "Local storage full — please export JSON backup");
  }
}

function formatShortTime(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

function updateSyncStatusUI(level, text) {
  const dot = document.getElementById("sync-dot");
  const label = document.getElementById("sync-status-text");
  if (!dot || !label) return;
  dot.className = "sync-dot";
  if (level === "warning") dot.classList.add("warning");
  if (level === "error") dot.classList.add("error");
  label.textContent = text;
}

// ============================================================================
// Dashboard & Filter Rendering
// ============================================================================
function renderDashboardCountsOnly() {
  const counts = {
    all: appState.items.length,
    not_started: 0,
    needs_data: 0,
    delegate_chair: 0,
    drafting: 0,
    finalized: 0
  };
  for (const item of appState.items) {
    if (counts[item.status] !== undefined) {
      counts[item.status]++;
    }
  }
  for (const [key, val] of Object.entries(counts)) {
    const badge = document.querySelector(`[data-status-count="${key}"]`);
    if (badge) badge.textContent = String(val);
  }
}

function renderMetadataFields() {
  const progInput = document.getElementById("meta-program-name");
  const prepInput = document.getElementById("meta-prepared-by");
  const implInput = document.getElementById("meta-impl-date");
  const oneDriveInput = document.getElementById("meta-onedrive-url");
  const oneDriveOpenBtn = document.getElementById("btn-open-onedrive");

  if (progInput) progInput.value = appState.metadata.programName || "";
  if (prepInput) prepInput.value = appState.metadata.preparedBy || "";
  if (implInput) implInput.value = appState.metadata.implementationDate || "";
  if (oneDriveInput) oneDriveInput.value = appState.metadata.oneDriveFolderUrl || "";
  if (oneDriveOpenBtn) {
    oneDriveOpenBtn.disabled = !appState.metadata.oneDriveFolderUrl;
  }
}

function getFilteredItems() {
  return appState.items.filter((item) => {
    if (activeSectionFilter !== "all" && item.sectionId !== activeSectionFilter) {
      return false;
    }
    if (activeStatusFilter !== "all" && item.status !== activeStatusFilter) {
      return false;
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const haystack = [
        item.code,
        item.shortTitle,
        item.questionHtml,
        item.existingAnswerHtml,
        ...item.grayZoneSubItems.map(
          (s) => `${s.prompt} ${s.primaryAssignee} ${s.draftHtml} ${s.finalHtml} ${s.optionalAssignee} ${s.optionalHtml}`
        )
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function renderQuickJumpBar(filteredItems) {
  const container = document.getElementById("quick-jump-bar");
  if (!container) return;
  container.replaceChildren();

  const label = document.createElement("span");
  label.style.fontSize = "0.78rem";
  label.style.fontWeight = "700";
  label.style.color = "var(--text-muted)";
  label.textContent = "Quick Jump:";
  container.appendChild(label);

  for (const item of filteredItems) {
    const a = document.createElement("a");
    a.href = `#card-${item.id}`;
    a.className = "jump-pill";
    a.textContent = item.code.startsWith("Appendix") ? item.code : `#${item.code}`;
    a.title = `${item.code}: ${item.shortTitle}`;
    a.addEventListener("click", () => {
      const detailsEl = document.querySelector(`#card-${item.id} > details`);
      if (detailsEl) detailsEl.open = true;
    });
    container.appendChild(a);
  }
}

// ============================================================================
// Rich Editor & Table Builder Component
// ============================================================================
function createRichEditorWidget({ initialHtml, placeholder, onChange }) {
  const wrapper = document.createElement("div");
  wrapper.className = "rich-editor-widget";

  const toolbar = document.createElement("div");
  toolbar.className = "rich-toolbar";

  const editor = document.createElement("div");
  editor.className = "rich-editor";
  editor.contentEditable = "true";
  editor.dataset.placeholder = placeholder || "Enter text or insert a table here (you can also paste tables directly from Excel or Word)...";
  safeSetHTML(editor, initialHtml || "");

  const addToolButton = (label, title, onClick) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tool-btn";
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      editor.focus();
      onClick();
      onChange(sanitizeHTMLString(editor.innerHTML));
    });
    toolbar.appendChild(btn);
  };

  addToolButton("B", "Bold", () => document.execCommand("bold"));
  addToolButton("I", "Italic", () => document.execCommand("italic"));
  addToolButton("• List", "Bullet List", () => document.execCommand("insertUnorderedList"));
  addToolButton("Highlight", "Highlight selected text", () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const mark = document.createElement("mark");
    try {
      range.surroundContents(mark);
    } catch {
      document.execCommand("hiliteColor", false, "#e5e5e5");
    }
  });

  addToolButton("+ Insert Table", "Insert a 3x3 table", () => {
    insertTableAtCursor(editor, 3, 3);
  });

  addToolButton("+ Row", "Add a row to the active table", () => {
    modifyActiveTable(editor, "add-row");
  });

  addToolButton("+ Column", "Add a column to the active table", () => {
    modifyActiveTable(editor, "add-col");
  });

  addToolButton("- Delete Row", "Delete the current or last row in the table", () => {
    modifyActiveTable(editor, "del-row");
  });

  // Handle paste: convert TSV (from Excel / Google Sheets) or sanitize HTML tables
  editor.addEventListener("paste", (e) => {
    const clipboard = e.clipboardData;
    if (!clipboard) return;
    const htmlData = clipboard.getData("text/html");
    const textData = clipboard.getData("text/plain");

    if (htmlData && htmlData.includes("<table")) {
      e.preventDefault();
      const cleanHtml = sanitizeHTMLString(htmlData);
      document.execCommand("insertHTML", false, cleanHtml);
      onChange(sanitizeHTMLString(editor.innerHTML));
      return;
    }

    // Check if plain text is tab-separated (Excel/Sheets copy)
    if (textData && textData.includes("\t") && textData.includes("\n")) {
      e.preventDefault();
      const rows = textData
        .trim()
        .split(/\r?\n/)
        .map((line) => line.split("\t"));
      const tableHtml = buildTableHtmlFromMatrix(rows);
      document.execCommand("insertHTML", false, tableHtml);
      onChange(sanitizeHTMLString(editor.innerHTML));
    }
  });

  editor.addEventListener("input", () => {
    onChange(sanitizeHTMLString(editor.innerHTML));
  });

  wrapper.append(toolbar, editor);
  return { wrapper, editor };
}

function buildTableHtmlFromMatrix(rows) {
  if (!rows || rows.length === 0) return "";
  const header = rows[0];
  const body = rows.slice(1);
  let html = `<div tabindex="0" role="region" aria-label="Inserted Data Table" class="table-wrapper"><table><thead><tr>`;
  for (const cell of header) {
    html += `<th>${escapeText(cell)}</th>`;
  }
  html += `</tr></thead><tbody>`;
  if (body.length === 0) {
    html += `<tr>${header.map((_, idx) => (idx === 0 ? "<th>Row 1</th>" : "<td></td>")).join("")}</tr>`;
  } else {
    for (const r of body) {
      html += `<tr>`;
      r.forEach((cell, idx) => {
        const tag = idx === 0 ? "th" : "td";
        html += `<${tag}>${escapeText(cell)}</${tag}>`;
      });
      html += `</tr>`;
    }
  }
  html += `</tbody></table></div><p><br></p>`;
  return html;
}

function escapeText(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function insertTableAtCursor(editorEl, numRows = 3, numCols = 3) {
  const matrix = [];
  const headers = [];
  for (let c = 1; c <= numCols; c++) {
    headers.push(`Column ${c}`);
  }
  matrix.push(headers);
  for (let r = 1; r < numRows; r++) {
    const row = [];
    for (let c = 1; c <= numCols; c++) {
      row.push(c === 1 ? `Item ${r}` : "");
    }
    matrix.push(row);
  }
  const tableHtml = buildTableHtmlFromMatrix(matrix);
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && editorEl.contains(sel.anchorNode)) {
    document.execCommand("insertHTML", false, tableHtml);
  } else {
    editorEl.insertAdjacentHTML("beforeend", tableHtml);
  }
}

function modifyActiveTable(editorEl, action) {
  const sel = window.getSelection();
  let targetTable = null;
  let activeRow = null;

  if (sel && sel.anchorNode && editorEl.contains(sel.anchorNode)) {
    const el = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
    if (el) {
      targetTable = el.closest("table");
      activeRow = el.closest("tr");
    }
  }
  if (!targetTable) {
    const tables = editorEl.querySelectorAll("table");
    if (tables.length > 0) {
      targetTable = tables[tables.length - 1];
    }
  }
  if (!targetTable) {
    insertTableAtCursor(editorEl, 3, 3);
    return;
  }

  const tbody = targetTable.querySelector("tbody") || targetTable;
  const theadRow = targetTable.querySelector("thead tr");
  const colCount = theadRow
    ? theadRow.children.length
    : (tbody.querySelector("tr")?.children.length || 3);

  if (action === "add-row") {
    const tr = document.createElement("tr");
    for (let c = 0; c < colCount; c++) {
      const cell = document.createElement(c === 0 ? "th" : "td");
      cell.textContent = "";
      tr.appendChild(cell);
    }
    if (activeRow && tbody.contains(activeRow)) {
      activeRow.after(tr);
    } else {
      tbody.appendChild(tr);
    }
  } else if (action === "add-col") {
    if (theadRow) {
      const th = document.createElement("th");
      th.textContent = `Column ${colCount + 1}`;
      theadRow.appendChild(th);
    }
    for (const tr of tbody.querySelectorAll("tr")) {
      const td = document.createElement("td");
      td.textContent = "";
      tr.appendChild(td);
    }
  } else if (action === "del-row") {
    const rows = tbody.querySelectorAll("tr");
    if (rows.length <= 1) {
      const wrapper = targetTable.closest(".table-wrapper") || targetTable;
      wrapper.remove();
    } else if (activeRow && tbody.contains(activeRow)) {
      activeRow.remove();
    } else {
      rows[rows.length - 1].remove();
    }
  }
}

// ============================================================================
// Item Card Rendering
// ============================================================================
function renderItemsList() {
  const listEl = document.getElementById("items-list");
  if (!listEl) return;
  listEl.replaceChildren();

  const filtered = getFilteredItems();
  renderQuickJumpBar(filtered);
  renderDashboardCountsOnly();

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dashboard-panel";
    empty.style.textAlign = "center";
    empty.textContent = "No items match the selected filter or search criteria.";
    listEl.appendChild(empty);
    return;
  }

  for (const item of filtered) {
    listEl.appendChild(buildItemCardDOM(item));
  }
}

function buildItemCardDOM(item) {
  const card = document.createElement("article");
  card.className = "item-card";
  card.id = `card-${item.id}`;

  // Use native <details> per modern-web-guidance (search-hidden-content)
  // so Find-in-page (Cmd+F) automatically reveals collapsed items
  const details = document.createElement("details");
  details.className = "item-card-details";
  details.open = cardOpenState[item.id] ?? true;

  const summary = document.createElement("summary");

  const headerLeft = document.createElement("div");
  headerLeft.className = "item-header-left";

  const codeBadge = document.createElement("span");
  codeBadge.className = "item-code-badge";
  codeBadge.textContent = item.code.startsWith("Appendix") ? item.code : `Item #${item.code}`;

  const secTag = document.createElement("span");
  secTag.className = "item-section-tag";
  secTag.textContent = item.sectionLabel;

  const titleEl = document.createElement("h2");
  titleEl.className = "item-short-title";
  titleEl.textContent = item.shortTitle;

  headerLeft.append(codeBadge, titleEl, secTag);

  const headerRight = document.createElement("div");
  headerRight.className = "item-header-right";

  // Status selector
  const statusSelect = document.createElement("select");
  statusSelect.className = "auto-fit-select";
  statusSelect.setAttribute("aria-label", `Select status for ${item.code}`);
  for (const opt of STATUS_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    if (item.status === opt.value) o.selected = true;
    statusSelect.appendChild(o);
  }
  statusSelect.addEventListener("click", (e) => e.stopPropagation());
  statusSelect.addEventListener("change", (e) => {
    item.status = e.target.value;
    saveStateLocally();
  });

  const subCountBadge = document.createElement("span");
  subCountBadge.className = "status-badge status-not-started";
  subCountBadge.textContent = `Gray Zone: ${item.grayZoneSubItems.length} sub-item(s)`;

  const toggleHint = document.createElement("span");
  toggleHint.className = "btn btn-sm no-print";
  toggleHint.style.pointerEvents = "none";
  toggleHint.textContent = details.open ? "▾ Collapse" : "▸ Expand";

  details.addEventListener("toggle", () => {
    cardOpenState[item.id] = details.open;
    toggleHint.textContent = details.open ? "▾ Collapse" : "▸ Expand";
  });

  headerRight.append(subCountBadge, statusSelect, toggleHint);
  summary.append(headerLeft, headerRight);

  const body = document.createElement("div");
  body.className = "item-body";

  const num = getItemPrefix(item);

  // -------------------------------------------------------------------------
  // N. Question / Prompt Block
  // -------------------------------------------------------------------------
  const qBlock = document.createElement("section");
  qBlock.className = "block-question";

  const qHeader = document.createElement("div");
  qHeader.className = "block-header";

  const qLabel = document.createElement("span");
  qLabel.className = "block-label";
  qLabel.textContent = `${num}. Question / Prompt (IQAP Major Modification Brief)`;

  const qEditBtn = document.createElement("button");
  qEditBtn.type = "button";
  qEditBtn.className = "btn btn-sm no-print";
  const isEditingQ = Boolean(questionEditMode[item.id]);
  qEditBtn.textContent = isEditingQ ? "Done Editing Question" : "Edit Question / Title";
  qEditBtn.addEventListener("click", () => {
    questionEditMode[item.id] = !questionEditMode[item.id];
    renderItemsList();
  });

  qHeader.append(qLabel, qEditBtn);
  qBlock.appendChild(qHeader);

  if (isEditingQ) {
    const titleInputWrap = document.createElement("div");
    titleInputWrap.style.marginBottom = "0.5rem";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "auto-fit-input";
    titleInput.style.width = "100%";
    titleInput.style.maxInlineSize = "100%";
    titleInput.value = item.shortTitle;
    titleInput.placeholder = "Item summary title";
    titleInput.addEventListener("input", () => {
      item.shortTitle = titleInput.value;
      titleEl.textContent = item.shortTitle;
      saveStateLocally();
    });
    titleInputWrap.appendChild(titleInput);
    qBlock.appendChild(titleInputWrap);

    const { wrapper: qEditor } = createRichEditorWidget({
      initialHtml: item.questionHtml,
      placeholder: `Enter the question or prompt for Item ${num}...`,
      onChange: (html) => {
        item.questionHtml = html;
        saveStateLocally();
      }
    });
    qBlock.appendChild(qEditor);
  } else {
    const qContent = document.createElement("div");
    qContent.className = "question-display";
    safeSetHTML(qContent, item.questionHtml);
    qBlock.appendChild(qContent);
  }

  // -------------------------------------------------------------------------
  // N-1. Existing / Pre-filled Answer Block
  // -------------------------------------------------------------------------
  const exDetails = document.createElement("details");
  exDetails.className = "block-existing";
  exDetails.open = existingOpenState[item.id] ?? false;

  const exSummary = document.createElement("summary");
  exSummary.innerHTML = `<span>${num}-1. Existing / Pre-filled Answer Input (Pre-populated by CLT / Administration — click to expand or edit)</span><span style="font-size:0.76rem;color:var(--text-muted);">Expand / Collapse ▾</span>`;

  exDetails.addEventListener("toggle", () => {
    existingOpenState[item.id] = exDetails.open;
  });

  const exContent = document.createElement("div");
  exContent.className = "block-existing-content";

  const { wrapper: exEditor } = createRichEditorWidget({
    initialHtml: item.existingAnswerHtml,
    placeholder: `${num}-1. Enter or edit the existing pre-filled answer text or tables...`,
    onChange: (html) => {
      item.existingAnswerHtml = html;
      saveStateLocally();
    }
  });
  exContent.appendChild(exEditor);
  exDetails.append(exSummary, exContent);

  // -------------------------------------------------------------------------
  // N-2. GRAY ZONE (Faculty Committee Core Workspace — Dissected Sub-items)
  // -------------------------------------------------------------------------
  const gzBlock = document.createElement("section");
  gzBlock.className = "block-gray-zone";

  const gzBanner = document.createElement("div");
  gzBanner.className = "gray-zone-banner";

  const gzTitle = document.createElement("h3");
  gzTitle.className = "gray-zone-title";
  gzTitle.innerHTML = `<span class="gray-zone-pill">${num}-2. GRAY ZONE</span> <span>Faculty Committee Core Workspace (Dissect &amp; Assign)</span>`;

  const addSubBtn = document.createElement("button");
  addSubBtn.type = "button";
  addSubBtn.className = "btn btn-primary no-print";
  addSubBtn.textContent = "+ Add Dissected Sub-item";
  addSubBtn.addEventListener("click", () => {
    item.grayZoneSubItems.push({
      id: `gz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      prompt: "",
      primaryAssignee: "",
      draftHtml: "",
      finalHtml: "",
      optionalAssignee: "",
      optionalHtml: ""
    });
    saveStateLocally();
    renderItemsList();
  });

  gzBanner.append(gzTitle, addSubBtn);
  gzBlock.appendChild(gzBanner);

  const dissectList = document.createElement("div");
  dissectList.className = "dissect-list";

  item.grayZoneSubItems.forEach((sub, idx) => {
    const subCard = buildGrayZoneSubItemDOM(item, sub, idx, subCountBadge);
    dissectList.appendChild(subCard);
  });

  gzBlock.appendChild(dissectList);

  // -------------------------------------------------------------------------
  // 2-3. Supporting Data & Attachments (OneDrive Links + Local File Upload)
  // -------------------------------------------------------------------------
  const attBlock = buildAttachmentsBlockDOM(item);

  body.append(qBlock, exDetails, gzBlock, attBlock);
  details.append(summary, body);
  card.appendChild(details);
  return card;
}

function buildGrayZoneSubItemDOM(item, sub, idx, subCountBadge) {
  const num = getItemPrefix(item);
  const subCard = document.createElement("div");
  subCard.className = "subitem-card";

  // Top bar: Sub-item index + Dissected Prompt Input + Delete button
  const subTop = document.createElement("div");
  subTop.className = "subitem-top";

  const subTopBar = document.createElement("div");
  subTopBar.className = "subitem-top-bar";

  const indexTag = document.createElement("span");
  indexTag.className = "subitem-index-tag";
  indexTag.textContent = `Dissected Part #${idx + 1} (${num}-2 · Part ${idx + 1})`;

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "btn btn-sm btn-danger no-print";
  delBtn.textContent = "Remove Sub-item";
  delBtn.disabled = item.grayZoneSubItems.length <= 1;
  delBtn.title = item.grayZoneSubItems.length <= 1 ? "At least one Gray Zone sub-item is required" : "Remove this dissected sub-item";
  delBtn.addEventListener("click", () => {
    if (item.grayZoneSubItems.length <= 1) return;
    item.grayZoneSubItems = item.grayZoneSubItems.filter((s) => s.id !== sub.id);
    if (subCountBadge) {
      subCountBadge.textContent = `Gray Zone: ${item.grayZoneSubItems.length} sub-item(s)`;
    }
    saveStateLocally();
    renderItemsList();
  });

  subTopBar.append(indexTag, delBtn);

  const promptTextarea = document.createElement("textarea");
  promptTextarea.className = "auto-fit-textarea";
  promptTextarea.placeholder = "Enter the dissected Gray Zone prompt, instruction, or specific committee question to address...";
  promptTextarea.value = sub.prompt || "";
  promptTextarea.addEventListener("input", () => {
    sub.prompt = promptTextarea.value;
    saveStateLocally();
  });

  subTop.append(subTopBar, promptTextarea);

  // N-2-1. Primary Assignee (Who Can Answer — Free-text Input)
  const assigneeBar = document.createElement("div");
  assigneeBar.className = "assignee-bar";

  const assigneeLabel = document.createElement("label");
  assigneeLabel.className = "assignee-label";
  const assigneeInputId = `primary-assignee-${sub.id}`;
  assigneeLabel.htmlFor = assigneeInputId;
  assigneeLabel.textContent = `${num}-2-1. Who Can Answer (Primary Responder / Assignee):`;

  const assigneeInput = document.createElement("input");
  assigneeInput.id = assigneeInputId;
  assigneeInput.type = "text";
  assigneeInput.className = "auto-fit-input";
  assigneeInput.placeholder = "e.g., Program Chair, Curriculum Committee, Faculty Representative, CEAD, Registrar, CLT...";
  assigneeInput.value = sub.primaryAssignee || "";
  assigneeInput.addEventListener("input", () => {
    sub.primaryAssignee = assigneeInput.value;
    saveStateLocally();
  });

  assigneeBar.append(assigneeLabel, assigneeInput);

  // N-2-1-1 (Draft) & N-2-2 (Optional Responder) Side-by-Side Grid, followed by N-2-1-2 (Finalized)
  const responsesGrid = document.createElement("div");
  responsesGrid.className = "responses-grid";

  // N-2-1-1 Draft Box
  const draftBox = document.createElement("div");
  draftBox.className = "response-box draft-box";

  const draftHeader = document.createElement("div");
  draftHeader.className = "response-box-header";

  const draftTitle = document.createElement("span");
  draftTitle.className = "response-box-title";
  draftTitle.textContent = `${num}-2-1-1. Draft Response (Working Draft, Notes & Missing Data Flags)`;

  draftHeader.appendChild(draftTitle);

  const { wrapper: draftEditorWidget, editor: draftEditorEl } = createRichEditorWidget({
    initialHtml: sub.draftHtml,
    placeholder: `${num}-2-1-1. Enter the draft response here (supports formatted text and tables)...`,
    onChange: (html) => {
      sub.draftHtml = html;
      saveStateLocally();
    }
  });

  draftBox.append(draftHeader, draftEditorWidget);

  // N-2-2. Optional Responder (Anyone Else Who Wants to Answer) — placed in the grid alongside Draft
  const optBox = document.createElement("div");
  optBox.className = "response-box optional-box";

  const optHeader = document.createElement("div");
  optHeader.className = "response-box-header";

  const optLabelWrap = document.createElement("div");
  optLabelWrap.style.display = "flex";
  optLabelWrap.style.flexWrap = "wrap";
  optLabelWrap.style.alignItems = "center";
  optLabelWrap.style.gap = "0.5rem";

  const optTitle = document.createElement("label");
  const optInputId = `opt-assignee-${sub.id}`;
  optTitle.htmlFor = optInputId;
  optTitle.className = "response-box-title";
  optTitle.textContent = `${num}-2-2. Optional Responder (Who else wants to contribute / comment):`;

  const optInput = document.createElement("input");
  optInput.id = optInputId;
  optInput.type = "text";
  optInput.className = "auto-fit-input";
  optInput.placeholder = "e.g., Faculty Member, Curriculum Committee, Advisor (free text)";
  optInput.value = sub.optionalAssignee || "";
  optInput.addEventListener("input", () => {
    sub.optionalAssignee = optInput.value;
    saveStateLocally();
  });

  optLabelWrap.append(optTitle, optInput);
  optHeader.appendChild(optLabelWrap);

  const { wrapper: optEditorWidget } = createRichEditorWidget({
    initialHtml: sub.optionalHtml,
    placeholder: `${num}-2-2. Enter optional response, additional perspective, or supporting tables...`,
    onChange: (html) => {
      sub.optionalHtml = html;
      saveStateLocally();
    }
  });

  optBox.append(optHeader, optEditorWidget);

  responsesGrid.append(draftBox, optBox);

  // N-2-1-2 Finalized Box — placed below Draft & Optional Responder
  const finalBox = document.createElement("div");
  finalBox.className = "response-box final-box";

  const finalHeader = document.createElement("div");
  finalHeader.className = "response-box-header";

  const finalTitle = document.createElement("span");
  finalTitle.className = "response-box-title";
  finalTitle.textContent = `${num}-2-1-2. Finalized Response (Approved Committee Response)`;

  const copyFromDraftBtn = document.createElement("button");
  copyFromDraftBtn.type = "button";
  copyFromDraftBtn.className = "btn btn-sm no-print";
  copyFromDraftBtn.textContent = "Copy Draft ➔ Final";
  copyFromDraftBtn.title = "Copy text and tables from Draft into Finalized Response";

  const { wrapper: finalEditorWidget, editor: finalEditorEl } = createRichEditorWidget({
    initialHtml: sub.finalHtml,
    placeholder: `${num}-2-1-2. Enter the finalized response here (supports formatted text and tables)...`,
    onChange: (html) => {
      sub.finalHtml = html;
      saveStateLocally();
    }
  });

  copyFromDraftBtn.addEventListener("click", () => {
    const currentDraft = sanitizeHTMLString(draftEditorEl.innerHTML);
    sub.finalHtml = currentDraft;
    safeSetHTML(finalEditorEl, currentDraft);
    saveStateLocally();
  });

  finalHeader.append(finalTitle, copyFromDraftBtn);
  finalBox.append(finalHeader, finalEditorWidget);

  subCard.append(subTop, assigneeBar, responsesGrid, finalBox);
  return subCard;
}

// ============================================================================
// N-3. Supporting Data & Attachments (OneDrive Links + Local File Upload)
// ============================================================================
function buildAttachmentsBlockDOM(item) {
  const num = getItemPrefix(item);
  const block = document.createElement("section");
  block.className = "block-attachments";

  const header = document.createElement("div");
  header.className = "block-header";
  header.style.marginBottom = "0";

  const label = document.createElement("span");
  label.className = "block-label";
  label.style.color = "var(--text-secondary)";
  label.textContent = `${num}-3. Supporting Data & Attached Documents (OneDrive Shared Links / File Attachments)`;

  header.appendChild(label);
  block.appendChild(header);

  const list = document.createElement("div");
  list.className = "attachment-list";

  const renderChips = () => {
    list.replaceChildren();
    if (!item.attachments || item.attachments.length === 0) {
      const emptyNote = document.createElement("span");
      emptyNote.style.fontSize = "0.8rem";
      emptyNote.style.color = "var(--text-muted)";
      emptyNote.textContent = "No supporting documents or data links attached yet.";
      list.appendChild(emptyNote);
      return;
    }

    item.attachments.forEach((att) => {
      const chip = document.createElement("div");
      chip.className = "attachment-chip";

      const icon = document.createElement("span");
      icon.textContent = att.type === "file" ? "[File]" : "[Link]";

      const link = document.createElement("a");
      link.href = att.url || "#";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = att.title || "Attached Document";
      if (att.type === "file" && att.fileName) {
        link.download = att.fileName;
      }

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-sm btn-danger no-print";
      delBtn.style.padding = "0.05rem 0.35rem";
      delBtn.textContent = "✕";
      delBtn.title = "Remove attachment";
      delBtn.addEventListener("click", () => {
        item.attachments = item.attachments.filter((a) => a.id !== att.id);
        saveStateLocally();
        renderChips();
      });

      chip.append(icon, link, delBtn);
      list.appendChild(chip);
    });
  };

  renderChips();

  // Form to add OneDrive link or upload local file
  const form = document.createElement("div");
  form.className = "attachment-form no-print";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "auto-fit-input";
  titleInput.placeholder = "Document / Data Title (e.g., Registrar Sequencing Chart)";

  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.className = "auto-fit-input";
  urlInput.placeholder = "OneDrive Shared Link (https://...)";

  const addLinkBtn = document.createElement("button");
  addLinkBtn.type = "button";
  addLinkBtn.className = "btn btn-sm btn-secondary";
  addLinkBtn.textContent = "+ Add Link";
  addLinkBtn.addEventListener("click", () => {
    const title = titleInput.value.trim() || urlInput.value.trim();
    const url = urlInput.value.trim();
    if (!url) return;
    item.attachments.push({
      id: `att-${Date.now()}`,
      type: "link",
      title,
      url
    });
    titleInput.value = "";
    urlInput.value = "";
    saveStateLocally();
    renderChips();
  });

  // File attach input
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.style.display = "none";
  fileInput.accept = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.json";

  const addFileBtn = document.createElement("button");
  addFileBtn.type = "button";
  addFileBtn.className = "btn btn-sm btn-secondary";
  addFileBtn.textContent = "+ Attach File (≤ 2MB)";
  addFileBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      updateSyncStatusUI("warning", "For files larger than 2MB, please upload to your shared OneDrive folder and paste the link.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      item.attachments.push({
        id: `att-${Date.now()}`,
        type: "file",
        title: `${file.name} (${Math.round(file.size / 1024)}KB)`,
        fileName: file.name,
        url: String(reader.result)
      });
      saveStateLocally();
      renderChips();
    };
    reader.readAsDataURL(file);
    fileInput.value = "";
  });

  form.append(titleInput, urlInput, addLinkBtn, addFileBtn, fileInput);
  block.append(list, form);
  return block;
}

// ============================================================================
// GitHub Repository API Cloud Sync (Pull & Push)
// ============================================================================
function loadGitHubConfig() {
  try {
    const raw = localStorage.getItem(GITHUB_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    owner: "",
    repo: "",
    branch: "main",
    path: "data/committee-workspace.json",
    token: "",
    passcode: "",
    autoSync: false
  };
}

function saveGitHubConfig(cfg) {
  localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(cfg));
  setupAutoSyncTimer(cfg);
}

function setupAutoSyncTimer(cfg) {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
  if (cfg.autoSync && cfg.owner && cfg.repo && cfg.token) {
    autoSyncTimer = setInterval(() => {
      pullFromGitHub(true);
    }, 30000);
  }
}

async function pullFromGitHub(silent = false) {
  const cfg = loadGitHubConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    if (!silent) updateSyncStatusUI("warning", "Please configure GitHub Sync Settings first.");
    return;
  }

  try {
    if (!silent) updateSyncStatusUI("ok", "Pulling latest workspace from GitHub...");
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${cfg.path}?ref=${encodeURIComponent(cfg.branch || "main")}`;
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/vnd.github+json"
      },
      cache: "no-store"
    });

    if (res.status === 404) {
      if (!silent) updateSyncStatusUI("warning", "No workspace file found on GitHub yet. Click 'Save to GitHub (Push)' first.");
      return;
    }
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}`);
    }

    const fileMeta = await res.json();
    const rawBytes = base64ToBytes(fileMeta.content.replace(/\s/g, ""));
    const jsonText = new TextDecoder().decode(rawBytes);
    const parsed = JSON.parse(jsonText);

    let incomingState = parsed;
    if (parsed.encrypted) {
      if (!cfg.passcode) {
        updateSyncStatusUI("warning", "Workspace is encrypted. Please enter the Committee Encryption Passcode in GitHub Sync Setup.");
        return;
      }
      incomingState = await decryptWorkspacePayload(parsed, cfg.passcode);
    }

    if (incomingState && Array.isArray(incomingState.items)) {
      appState = normalizeLoadedState(incomingState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      renderMetadataFields();
      renderItemsList();
      updateSyncStatusUI("ok", `Synced from GitHub (Pull · ${formatShortTime(new Date().toISOString())})`);
    }
  } catch (err) {
    console.error("GitHub pull error:", err);
    if (!silent) updateSyncStatusUI("error", `GitHub Pull failed: ${err.message}`);
  }
}

async function pushToGitHub() {
  const cfg = loadGitHubConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    const dlg = document.getElementById("github-sync-dialog");
    if (dlg) dlg.showModal();
    return;
  }

  try {
    updateSyncStatusUI("ok", "Pushing workspace to GitHub repository...");
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${cfg.path}`;

    // 1. Check current SHA if file exists
    let existingSha = undefined;
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(cfg.branch || "main")}`, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/vnd.github+json"
      },
      cache: "no-store"
    });
    if (getRes.ok) {
      const existingMeta = await getRes.json();
      existingSha = existingMeta.sha;
    }

    // 2. Prepare payload (optionally AES-256-GCM encrypted with passcode)
    appState.metadata.lastUpdated = new Date().toISOString();
    let payloadToStore = appState;
    if (cfg.passcode && cfg.passcode.trim() !== "") {
      payloadToStore = await encryptWorkspacePayload(appState, cfg.passcode.trim());
    }

    const encodedBytes = new TextEncoder().encode(JSON.stringify(payloadToStore, null, 2));
    const contentBase64 = bytesToBase64(encodedBytes);

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `sync: update IQAP committee workspace (${new Date().toISOString()})`,
        content: contentBase64,
        branch: cfg.branch || "main",
        ...(existingSha ? { sha: existingSha } : {})
      })
    });

    if (!putRes.ok) {
      const errBody = await putRes.text();
      throw new Error(`HTTP ${putRes.status}: ${errBody.slice(0, 120)}`);
    }

    updateSyncStatusUI(
      "ok",
      `Saved to GitHub (${cfg.passcode ? "AES-256 Encrypted" : "Standard JSON"} · ${formatShortTime(new Date().toISOString())})`
    );
  } catch (err) {
    console.error("GitHub push error:", err);
    updateSyncStatusUI("error", `GitHub Push failed: ${err.message}`);
  }
}

// ============================================================================
// Export / Import JSON & Blank Question Mode (Security Option)
// ============================================================================
function exportWorkspaceJSON() {
  const dataStr = JSON.stringify(appState, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateTag = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `EXAN_IQAP_Decision_Workspace_${dateTag}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importWorkspaceJSON(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      let loaded = parsed;
      if (parsed.encrypted) {
        const cfg = loadGitHubConfig();
        const pass = cfg.passcode || window.prompt("This backup file is encrypted. Please enter the Committee Encryption Passcode:");
        if (!pass) return;
        loaded = await decryptWorkspacePayload(parsed, pass);
      }
      if (loaded && Array.isArray(loaded.items)) {
        appState = normalizeLoadedState(loaded);
        saveStateLocally("Restored workspace from JSON file");
        renderMetadataFields();
        renderItemsList();
      }
    } catch (err) {
      updateSyncStatusUI("error", `Failed to import file: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

function stripQuestionsToBlankTemplate() {
  for (const item of appState.items) {
    item.questionHtml = `<p><strong>${item.code}.</strong> [Enter the question prompt here or import from a saved JSON workspace file]</p>`;
    item.existingAnswerHtml = "";
    item.grayZoneSubItems = [
      {
        id: `gz-blank-${item.id}`,
        prompt: "[Enter the Gray Zone issue or prompt to address]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      }
    ];
  }
  saveStateLocally("Switched to Blank Template Mode");
  renderItemsList();
}

function restorePreExtractedBriefTemplate() {
  const defaults = cloneDefaultState();
  appState.items = defaults.items.map((defItem) => {
    const currentItem = appState.items.find((i) => i.id === defItem.id);
    if (!currentItem) return defItem;
    return {
      ...defItem,
      status: currentItem.status || defItem.status,
      attachments: currentItem.attachments?.length ? currentItem.attachments : defItem.attachments,
      grayZoneSubItems: defItem.grayZoneSubItems.map((defSub, idx) => {
        const curSub = currentItem.grayZoneSubItems[idx];
        if (!curSub) return defSub;
        return {
          ...defSub,
          primaryAssignee: curSub.primaryAssignee || defSub.primaryAssignee,
          draftHtml: curSub.draftHtml || "",
          finalHtml: curSub.finalHtml || "",
          optionalAssignee: curSub.optionalAssignee || "",
          optionalHtml: curSub.optionalHtml || ""
        };
      })
    };
  });
  saveStateLocally("Restored EXAN IQAP Brief Template");
  renderItemsList();
}

// ============================================================================
// Dialog Polyfill / Fallbacks per modern-web-guidance (dialog & light-dismiss-a-dialog)
// ============================================================================
function setupDialogsAndFallbacks() {
  const dialogs = document.querySelectorAll("dialog");

  for (const dialog of dialogs) {
    // Reset returnValue on close per modern-web-guidance (dialog)
    dialog.addEventListener("close", () => {
      dialog.returnValue = "";
    });

    // Mandatory fallback for browsers without closedby="any" support per light-dismiss-a-dialog
    if (!("closedBy" in HTMLDialogElement.prototype) && dialog.getAttribute("closedby") === "any") {
      dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      });
    }
  }
}

// ============================================================================
// Initialize App & Event Listeners
// ============================================================================
function initApp() {
  setupDialogsAndFallbacks();
  renderMetadataFields();
  renderItemsList();

  // Metadata inputs
  document.getElementById("meta-program-name")?.addEventListener("input", (e) => {
    appState.metadata.programName = e.target.value;
    saveStateLocally();
  });
  document.getElementById("meta-prepared-by")?.addEventListener("input", (e) => {
    appState.metadata.preparedBy = e.target.value;
    saveStateLocally();
  });
  document.getElementById("meta-impl-date")?.addEventListener("input", (e) => {
    appState.metadata.implementationDate = e.target.value;
    saveStateLocally();
  });
  document.getElementById("meta-onedrive-url")?.addEventListener("input", (e) => {
    appState.metadata.oneDriveFolderUrl = e.target.value.trim();
    const openBtn = document.getElementById("btn-open-onedrive");
    if (openBtn) openBtn.disabled = !appState.metadata.oneDriveFolderUrl;
    saveStateLocally();
  });
  document.getElementById("btn-open-onedrive")?.addEventListener("click", () => {
    if (appState.metadata.oneDriveFolderUrl) {
      window.open(appState.metadata.oneDriveFolderUrl, "_blank", "noopener,noreferrer");
    }
  });

  // Section tabs
  document.querySelectorAll("[data-section-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-section-tab]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeSectionFilter = btn.getAttribute("data-section-tab") || "all";
      renderItemsList();
    });
  });

  // Status filter chips
  document.querySelectorAll("[data-status-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-status-filter]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeStatusFilter = btn.getAttribute("data-status-filter") || "all";
      renderItemsList();
    });
  });

  // Search box
  document.getElementById("search-input")?.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderItemsList();
  });

  // Expand / Collapse all items
  document.getElementById("btn-expand-all")?.addEventListener("click", () => {
    for (const item of appState.items) {
      cardOpenState[item.id] = true;
      existingOpenState[item.id] = true;
    }
    document.querySelectorAll(".item-card-details, .block-existing").forEach((d) => {
      d.open = true;
    });
    updateSyncStatusUI("ok", "Expanded all items & pre-filled answers");
  });
  document.getElementById("btn-collapse-all")?.addEventListener("click", () => {
    for (const item of appState.items) {
      cardOpenState[item.id] = false;
      existingOpenState[item.id] = false;
    }
    document.querySelectorAll(".item-card-details, .block-existing").forEach((d) => {
      d.open = false;
    });
    updateSyncStatusUI("ok", "Collapsed all items");
  });

  // Export / Import JSON buttons
  document.getElementById("btn-export-json")?.addEventListener("click", exportWorkspaceJSON);
  const importInput = document.getElementById("input-import-json");
  document.getElementById("btn-import-json")?.addEventListener("click", () => importInput?.click());
  importInput?.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (file) importWorkspaceJSON(file);
    importInput.value = "";
  });

  // Print / Export PDF Report
  document.getElementById("btn-print-report")?.addEventListener("click", () => {
    document.querySelectorAll(".item-card-details").forEach((d) => {
      d.open = true;
    });
    window.print();
  });

  // Security & Template Mode Dialog
  const secDialog = document.getElementById("security-guide-dialog");
  document.getElementById("btn-open-security")?.addEventListener("click", () => {
    secDialog?.showModal();
  });
  document.getElementById("btn-switch-blank-mode")?.addEventListener("click", () => {
    stripQuestionsToBlankTemplate();
    secDialog?.close();
  });
  document.getElementById("btn-restore-brief-mode")?.addEventListener("click", () => {
    restorePreExtractedBriefTemplate();
    secDialog?.close();
  });

  // GitHub Sync Dialog
  const ghDialog = document.getElementById("github-sync-dialog");
  const populateGhForm = () => {
    const cfg = loadGitHubConfig();
    document.getElementById("gh-owner").value = cfg.owner || "";
    document.getElementById("gh-repo").value = cfg.repo || "";
    document.getElementById("gh-branch").value = cfg.branch || "main";
    document.getElementById("gh-path").value = cfg.path || "data/committee-workspace.json";
    document.getElementById("gh-token").value = cfg.token || "";
    document.getElementById("gh-passcode").value = cfg.passcode || "";
    document.getElementById("gh-autosync").checked = Boolean(cfg.autoSync);
  };

  document.getElementById("btn-open-github-sync")?.addEventListener("click", () => {
    populateGhForm();
    ghDialog?.showModal();
  });

  const readGhForm = () => ({
    owner: document.getElementById("gh-owner").value.trim(),
    repo: document.getElementById("gh-repo").value.trim(),
    branch: document.getElementById("gh-branch").value.trim() || "main",
    path: document.getElementById("gh-path").value.trim() || "data/committee-workspace.json",
    token: document.getElementById("gh-token").value.trim(),
    passcode: document.getElementById("gh-passcode").value.trim(),
    autoSync: document.getElementById("gh-autosync").checked
  });

  document.getElementById("btn-save-gh-config")?.addEventListener("click", () => {
    const cfg = readGhForm();
    saveGitHubConfig(cfg);
    ghDialog?.close();
    updateSyncStatusUI("ok", "GitHub sync settings saved.");
  });

  document.getElementById("btn-gh-pull-now")?.addEventListener("click", async () => {
    const cfg = readGhForm();
    saveGitHubConfig(cfg);
    await pullFromGitHub(false);
    ghDialog?.close();
  });

  document.getElementById("btn-gh-push-now")?.addEventListener("click", async () => {
    const cfg = readGhForm();
    saveGitHubConfig(cfg);
    await pushToGitHub();
    ghDialog?.close();
  });

  document.getElementById("btn-quick-push")?.addEventListener("click", () => {
    pushToGitHub();
  });
  document.getElementById("btn-quick-pull")?.addEventListener("click", () => {
    pullFromGitHub(false);
  });

  // Start auto-sync timer if previously configured
  setupAutoSyncTimer(loadGitHubConfig());
}

document.addEventListener("DOMContentLoaded", initApp);
