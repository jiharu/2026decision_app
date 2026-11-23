const STORAGE_KEY = "ocadu_exan_iqap_decision_app_v2";

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
// Application State Management & Firebase Real-Time Sync State
// ============================================================================
const CLIENT_SESSION_ID = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let appState = loadInitialState();
let activeSectionFilter = "all";
let activeStatusFilter = "all";
let searchQuery = "";
let questionEditMode = {}; // { [itemId]: boolean }
let cardOpenState = {}; // { [itemId]: boolean }
let existingOpenState = {}; // { [itemId]: boolean }

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let currentUser = null;
let cloudSyncActive = false;
let metaSyncReady = false;
let itemsSyncReady = false;
let isFlushingCloudSync = false;
let pendingCloudResync = false;
let unsubscribeMetaListener = null;
let unsubscribeItemsListener = null;
let cloudDiffSyncTimer = null;
const lastSyncedItemJson = new Map();
let lastSyncedMetaJson = "";

function getItemById(itemId) {
  return appState.items.find((i) => i.id === itemId) || null;
}

function getSubItemById(itemId, subId) {
  const item = getItemById(itemId);
  if (!item || !Array.isArray(item.grayZoneSubItems)) return null;
  return item.grayZoneSubItems.find((s) => s.id === subId) || null;
}

function serializeComparableMeta(meta) {
  if (!meta) return "";
  const { lastUpdated, ...rest } = meta;
  return JSON.stringify(rest);
}

function cloneDefaultState() {
  return {
    metadata: structuredClone(INITIAL_BRIEF_METADATA),
    items: structuredClone(INITIAL_ITEMS)
  };
}

function normalizeSingleItem(item) {
  if (!item) return item;
  if (item.sectionId === "part1") {
    item.sectionLabel = "Part B: Proposed Major Modification";
  } else if (item.sectionId === "part2") {
    item.sectionLabel = "Part C: Evaluation Criteria";
  }
  if (["4", "6", "7", "8"].includes(String(item.code))) {
    item.noResponseNeeded = true;
    if (!item.status || item.status === "not_started") {
      item.status = "no_response_needed";
    }
  }
  const defItem = INITIAL_ITEMS.find((d) => d.id === item.id);
  if (defItem && Array.isArray(defItem.questionLinks)) {
    if (!Array.isArray(item.questionLinks) || item.questionLinks.length === 0) {
      item.questionLinks = structuredClone(defItem.questionLinks);
    } else {
      for (const defLink of defItem.questionLinks) {
        if (!item.questionLinks.some((l) => l.id === defLink.id)) {
          item.questionLinks.push(structuredClone(defLink));
        }
      }
    }
  }
  return item;
}

function normalizeLoadedState(state) {
  if (!state || !Array.isArray(state.items)) return state;
  for (const item of state.items) {
    normalizeSingleItem(item);
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
    if (cloudSyncActive && currentUser) {
      updateSyncStatusUI("live", `Live Syncing... · ${formatShortTime(appState.metadata.lastUpdated)}`);
      scheduleCloudDiffSync();
    } else {
      updateSyncStatusUI("ok", `${statusMsg} · ${formatShortTime(appState.metadata.lastUpdated)}`);
    }
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
  if (level === "live") dot.classList.add("live");
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
    no_response_needed: 0,
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

function hasMeaningfulHtmlContent(html) {
  if (!html || typeof html !== "string") return false;
  if (/<table/i.test(html)) return true;
  const stripped = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return stripped.length > 0;
}

function getItemQuickJumpState(item) {
  if (!item || !Array.isArray(item.grayZoneSubItems) || item.grayZoneSubItems.length === 0) {
    return "default";
  }
  const anyUncompletedWithContent = item.grayZoneSubItems.some(
    (sub) => !sub.isComplete && hasMeaningfulHtmlContent(sub.finalHtml)
  );
  if (anyUncompletedWithContent) {
    return "working";
  }
  const anyCompleted = item.grayZoneSubItems.some((sub) => Boolean(sub.isComplete));
  if (anyCompleted) {
    return "complete";
  }
  if (item.noResponseNeeded || item.status === "no_response_needed" || ["4", "6", "7", "8"].includes(String(item.code))) {
    return "no_response";
  }
  return "default";
}

function applyQuickJumpPillState(pillEl, item) {
  pillEl.classList.remove("is-no-response", "is-working", "is-complete");
  const state = getItemQuickJumpState(item);
  if (state === "no_response") {
    pillEl.classList.add("is-no-response");
  } else if (state === "working") {
    pillEl.classList.add("is-working");
  } else if (state === "complete") {
    pillEl.classList.add("is-complete");
  }
}

function updateQuickJumpPillsState() {
  for (const item of appState.items) {
    const pill = document.querySelector(`[data-jump-item-id="${item.id}"]`);
    if (pill) {
      applyQuickJumpPillState(pill, item);
    }
  }
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
    a.dataset.jumpItemId = item.id;
    a.textContent = item.code.startsWith("Appendix") ? item.code : `#${item.code}`;
    a.title = `${item.code}: ${item.shortTitle}`;
    applyQuickJumpPillState(a, item);
    a.addEventListener("click", () => {
      const detailsEl = document.querySelector(`#card-${item.id} > details`);
      if (detailsEl) detailsEl.open = true;
    });
    container.appendChild(a);
  }

  const legend = document.createElement("span");
  legend.className = "jump-legend";
  legend.innerHTML = `<span class="legend-item"><span class="legend-swatch no-response"></span> No Input Needed (Grey: #4, #6, #7, #8)</span><span class="legend-item"><span class="legend-swatch working"></span> In Progress (Orange)</span><span class="legend-item"><span class="legend-swatch complete"></span> Complete (Blue)</span>`;
  container.appendChild(legend);
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
  const itemId = item.id;
  const card = document.createElement("article");
  card.className = "item-card";
  card.id = `card-${itemId}`;

  // Use native <details> per modern-web-guidance (search-hidden-content)
  // so Find-in-page (Cmd+F) automatically reveals collapsed items
  const details = document.createElement("details");
  details.className = "item-card-details";
  details.open = cardOpenState[itemId] ?? true;

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
  titleEl.dataset.syncTitle = "true";
  titleEl.textContent = item.shortTitle;

  headerLeft.append(codeBadge, titleEl, secTag);

  const headerRight = document.createElement("div");
  headerRight.className = "item-header-right";

  // Status selector
  const statusSelect = document.createElement("select");
  statusSelect.className = "auto-fit-select";
  statusSelect.dataset.syncField = "status";
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
    const liveItem = getItemById(itemId);
    if (!liveItem) return;
    liveItem.status = e.target.value;
    liveItem.noResponseNeeded = e.target.value === "no_response_needed";
    saveStateLocally();
    updateQuickJumpPillsState();
  });

  const subCountBadge = document.createElement("span");
  subCountBadge.className = "status-badge status-not-started";
  subCountBadge.dataset.syncSubcount = "true";
  subCountBadge.textContent = `Gray Zone: ${item.grayZoneSubItems.length} sub-item(s)`;

  const toggleHint = document.createElement("span");
  toggleHint.className = "btn btn-sm no-print";
  toggleHint.style.pointerEvents = "none";
  toggleHint.textContent = details.open ? "▾ Collapse" : "▸ Expand";

  details.addEventListener("toggle", () => {
    cardOpenState[itemId] = details.open;
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
  const isEditingQ = Boolean(questionEditMode[itemId]);
  qEditBtn.textContent = isEditingQ ? "Done Editing Question" : "Edit Question / Title";
  qEditBtn.addEventListener("click", () => {
    questionEditMode[itemId] = !questionEditMode[itemId];
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
    titleInput.dataset.syncField = "shortTitle";
    titleInput.style.width = "100%";
    titleInput.style.maxInlineSize = "100%";
    titleInput.value = item.shortTitle;
    titleInput.placeholder = "Item summary title";
    titleInput.addEventListener("input", () => {
      const liveItem = getItemById(itemId);
      if (!liveItem) return;
      liveItem.shortTitle = titleInput.value;
      titleEl.textContent = liveItem.shortTitle;
      saveStateLocally();
    });
    titleInputWrap.appendChild(titleInput);
    qBlock.appendChild(titleInputWrap);

    const { wrapper: qEditor, editor: qEditorEl } = createRichEditorWidget({
      initialHtml: item.questionHtml,
      placeholder: `Enter the question or prompt for Item ${num}...`,
      onChange: (html) => {
        const liveItem = getItemById(itemId);
        if (!liveItem) return;
        liveItem.questionHtml = html;
        saveStateLocally();
      }
    });
    qEditorEl.dataset.syncField = "questionHtml";
    qBlock.appendChild(qEditor);
  } else {
    const qContent = document.createElement("div");
    qContent.className = "question-display";
    qContent.dataset.syncDisplay = "questionHtml";
    safeSetHTML(qContent, item.questionHtml);
    qBlock.appendChild(qContent);
  }

  if (Array.isArray(item.questionLinks) && item.questionLinks.length > 0) {
    qBlock.appendChild(buildQuestionLinksBarDOM(item, num));
  }

  // -------------------------------------------------------------------------
  // N-1. Existing / Pre-filled Answer Block
  // -------------------------------------------------------------------------
  const exDetails = document.createElement("details");
  exDetails.className = "block-existing";
  exDetails.open = existingOpenState[itemId] ?? false;

  const exSummary = document.createElement("summary");
  exSummary.innerHTML = `<span>${num}-1. Existing / Pre-filled Answer Input (Pre-populated by CLT / Administration — click to expand or edit)</span><span style="font-size:0.76rem;color:var(--text-muted);">Expand / Collapse ▾</span>`;

  exDetails.addEventListener("toggle", () => {
    existingOpenState[itemId] = exDetails.open;
  });

  const exContent = document.createElement("div");
  exContent.className = "block-existing-content";

  const { wrapper: exEditor, editor: exEditorEl } = createRichEditorWidget({
    initialHtml: item.existingAnswerHtml,
    placeholder: `${num}-1. Enter or edit the existing pre-filled answer text or tables...`,
    onChange: (html) => {
      const liveItem = getItemById(itemId);
      if (!liveItem) return;
      liveItem.existingAnswerHtml = html;
      saveStateLocally();
    }
  });
  exEditorEl.dataset.syncField = "existingAnswerHtml";
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
    const liveItem = getItemById(itemId);
    if (!liveItem) return;
    liveItem.grayZoneSubItems.push({
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

function buildQuestionLinksBarDOM(item, num) {
  const itemId = item.id;
  const bar = document.createElement("div");
  bar.className = "question-links-bar";

  const label = document.createElement("span");
  label.className = "question-links-label";
  label.textContent = "Reference Data & Stakeholder Input:";
  bar.appendChild(label);

  for (const qlink of item.questionLinks) {
    const qlinkId = qlink.id;
    const group = document.createElement("div");
    group.className = "qlink-group";

    const hasUrl = Boolean(qlink.url && qlink.url.trim());
    const hasNotes = hasMeaningfulHtmlContent(qlink.notesHtml);
    const hasData = hasUrl || hasNotes;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `qlink-btn${hasData ? " has-data" : ""}`;
    const icon = qlink.kind === "document" ? "↗" : "▣";
    btn.textContent = `${icon} ${qlink.label}${hasData ? " ●" : ""}`;
    btn.title = hasData
      ? `Click to view or edit ${qlink.label}`
      : `Click to add link or input for ${qlink.label}`;
    btn.addEventListener("click", () => {
      const liveItem = getItemById(itemId);
      const liveQlink = liveItem?.questionLinks?.find((l) => l.id === qlinkId);
      if (liveItem && liveQlink) {
        openQuestionLinkDialog(liveItem, liveQlink, num);
      }
    });
    group.appendChild(btn);

    if (hasUrl) {
      const directLink = document.createElement("a");
      directLink.href = qlink.url.trim();
      directLink.target = "_blank";
      directLink.rel = "noopener noreferrer";
      directLink.className = "btn btn-sm no-print";
      directLink.textContent = "Open URL ↗";
      directLink.title = `Open linked document for ${qlink.label} in a new tab`;
      group.appendChild(directLink);
    }

    bar.appendChild(group);
  }

  return bar;
}

function openQuestionLinkDialog(item, qlink, num) {
  const itemId = item.id;
  const qlinkId = qlink.id;
  const getLiveQlink = () => getItemById(itemId)?.questionLinks?.find((l) => l.id === qlinkId) || null;

  const dialog = document.getElementById("question-link-dialog");
  if (!dialog) return;

  const titleEl = document.getElementById("qlink-dialog-title");
  if (titleEl) {
    titleEl.textContent = `Item #${num} — ${qlink.label}`;
  }

  const urlInput = document.getElementById("qlink-url-input");
  const openUrlBtn = document.getElementById("btn-qlink-open-url");
  if (urlInput && openUrlBtn) {
    urlInput.value = qlink.url || "";
    openUrlBtn.disabled = !urlInput.value.trim();

    urlInput.oninput = () => {
      const liveQlink = getLiveQlink();
      if (!liveQlink) return;
      liveQlink.url = urlInput.value.trim();
      openUrlBtn.disabled = !liveQlink.url;
      saveStateLocally();
    };

    openUrlBtn.onclick = () => {
      const liveQlink = getLiveQlink();
      if (liveQlink?.url) {
        window.open(liveQlink.url, "_blank", "noopener,noreferrer");
      }
    };
  }

  const currMapWrap = document.getElementById("qlink-jump-currmap-wrap");
  const jumpAppBBtn = document.getElementById("btn-qlink-jump-appb");
  if (currMapWrap && jumpAppBBtn) {
    const isCurrMap = qlink.id === "qlink-4-currmap" || /curriculum map/i.test(qlink.label);
    currMapWrap.style.display = isCurrMap ? "block" : "none";
    jumpAppBBtn.onclick = () => {
      dialog.close();
      const appBCard = document.getElementById("card-item-app-b");
      if (appBCard) {
        const detailsEl = appBCard.querySelector("details");
        if (detailsEl) detailsEl.open = true;
        appBCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
  }

  const editorMount = document.getElementById("qlink-editor-mount");
  if (editorMount) {
    editorMount.replaceChildren();
    const { wrapper } = createRichEditorWidget({
      initialHtml: qlink.notesHtml || "",
      placeholder: `Paste or enter content, notes, or tables for "${qlink.label}" here...`,
      onChange: (html) => {
        const liveQlink = getLiveQlink();
        if (!liveQlink) return;
        liveQlink.notesHtml = html;
        saveStateLocally();
      }
    });
    editorMount.appendChild(wrapper);
  }

  dialog.onclose = () => {
    dialog.returnValue = "";
    renderItemsList();
  };

  dialog.showModal();
}

function buildGrayZoneSubItemDOM(item, sub, idx, subCountBadge) {
  const itemId = item.id;
  const subId = sub.id;
  const num = getItemPrefix(item);
  const subCard = document.createElement("div");
  subCard.className = "subitem-card";
  subCard.dataset.subId = subId;

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
    const liveItem = getItemById(itemId);
    if (!liveItem || liveItem.grayZoneSubItems.length <= 1) return;
    liveItem.grayZoneSubItems = liveItem.grayZoneSubItems.filter((s) => s.id !== subId);
    if (subCountBadge) {
      subCountBadge.textContent = `Gray Zone: ${liveItem.grayZoneSubItems.length} sub-item(s)`;
    }
    saveStateLocally();
    renderItemsList();
  });

  subTopBar.append(indexTag, delBtn);

  const promptTextarea = document.createElement("textarea");
  promptTextarea.className = "auto-fit-textarea";
  promptTextarea.dataset.syncSubField = "prompt";
  promptTextarea.placeholder = "Enter the dissected Gray Zone prompt, instruction, or specific committee question to address...";
  promptTextarea.value = sub.prompt || "";
  promptTextarea.addEventListener("input", () => {
    const liveSub = getSubItemById(itemId, subId);
    if (!liveSub) return;
    liveSub.prompt = promptTextarea.value;
    saveStateLocally();
  });

  subTop.append(subTopBar, promptTextarea);

  // N-2-1. Primary Assignee (Who Can Answer — Free-text Input)
  const assigneeBar = document.createElement("div");
  assigneeBar.className = "assignee-bar";

  const assigneeLabel = document.createElement("label");
  assigneeLabel.className = "assignee-label";
  const assigneeInputId = `primary-assignee-${subId}`;
  assigneeLabel.htmlFor = assigneeInputId;
  assigneeLabel.textContent = `${num}-2-1. Who Can Answer (Primary Responder / Assignee):`;

  const assigneeInput = document.createElement("input");
  assigneeInput.id = assigneeInputId;
  assigneeInput.type = "text";
  assigneeInput.className = "auto-fit-input";
  assigneeInput.dataset.syncSubField = "primaryAssignee";
  assigneeInput.placeholder = "e.g., Program Chair, Curriculum Committee, Faculty Representative, CEAD, Registrar, CLT...";
  assigneeInput.value = sub.primaryAssignee || "";
  assigneeInput.addEventListener("input", () => {
    const liveSub = getSubItemById(itemId, subId);
    if (!liveSub) return;
    liveSub.primaryAssignee = assigneeInput.value;
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
      const liveSub = getSubItemById(itemId, subId);
      if (!liveSub) return;
      liveSub.draftHtml = html;
      saveStateLocally();
    }
  });
  draftEditorEl.dataset.syncSubField = "draftHtml";

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
  const optInputId = `opt-assignee-${subId}`;
  optTitle.htmlFor = optInputId;
  optTitle.className = "response-box-title";
  optTitle.textContent = `${num}-2-2. Optional Responder (Who else wants to contribute / comment):`;

  const optInput = document.createElement("input");
  optInput.id = optInputId;
  optInput.type = "text";
  optInput.className = "auto-fit-input";
  optInput.dataset.syncSubField = "optionalAssignee";
  optInput.placeholder = "e.g., Faculty Member, Curriculum Committee, Advisor (free text)";
  optInput.value = sub.optionalAssignee || "";
  optInput.addEventListener("input", () => {
    const liveSub = getSubItemById(itemId, subId);
    if (!liveSub) return;
    liveSub.optionalAssignee = optInput.value;
    saveStateLocally();
  });

  optLabelWrap.append(optTitle, optInput);
  optHeader.appendChild(optLabelWrap);

  const { wrapper: optEditorWidget, editor: optEditorEl } = createRichEditorWidget({
    initialHtml: sub.optionalHtml,
    placeholder: `${num}-2-2. Enter optional response, additional perspective, or supporting tables...`,
    onChange: (html) => {
      const liveSub = getSubItemById(itemId, subId);
      if (!liveSub) return;
      liveSub.optionalHtml = html;
      saveStateLocally();
    }
  });
  optEditorEl.dataset.syncSubField = "optionalHtml";

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

  const completeLabel = document.createElement("label");
  completeLabel.className = `complete-checkbox-label no-print${sub.isComplete ? " checked" : ""}`;
  completeLabel.title = "Mark this Finalized Response as Complete (turns Quick Jump button Blue)";

  const completeCheckbox = document.createElement("input");
  completeCheckbox.type = "checkbox";
  completeCheckbox.dataset.syncSubField = "isComplete";
  completeCheckbox.checked = Boolean(sub.isComplete);
  completeCheckbox.addEventListener("change", () => {
    const liveSub = getSubItemById(itemId, subId);
    if (!liveSub) return;
    liveSub.isComplete = completeCheckbox.checked;
    completeLabel.classList.toggle("checked", Boolean(liveSub.isComplete));
    saveStateLocally();
    updateQuickJumpPillsState();
  });

  const completeText = document.createElement("span");
  completeText.textContent = "Complete";
  completeLabel.append(completeCheckbox, completeText);

  const { wrapper: finalEditorWidget, editor: finalEditorEl } = createRichEditorWidget({
    initialHtml: sub.finalHtml,
    placeholder: `${num}-2-1-2. Enter the finalized response here (supports formatted text and tables)...`,
    onChange: (html) => {
      const liveSub = getSubItemById(itemId, subId);
      if (!liveSub) return;
      liveSub.finalHtml = html;
      saveStateLocally();
      updateQuickJumpPillsState();
    }
  });
  finalEditorEl.dataset.syncSubField = "finalHtml";

  finalHeader.append(finalTitle, completeLabel);
  finalBox.append(finalHeader, finalEditorWidget);

  subCard.append(subTop, assigneeBar, responsesGrid, finalBox);
  return subCard;
}

// ============================================================================
// N-3. Supporting Data & Attachments (OneDrive Links + Local File Upload)
// ============================================================================
function buildAttachmentsBlockDOM(item) {
  const itemId = item.id;
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
    const liveItem = getItemById(itemId) || item;
    list.replaceChildren();
    if (!liveItem.attachments || liveItem.attachments.length === 0) {
      const emptyNote = document.createElement("span");
      emptyNote.style.fontSize = "0.8rem";
      emptyNote.style.color = "var(--text-muted)";
      emptyNote.textContent = "No supporting documents or data links attached yet.";
      list.appendChild(emptyNote);
      return;
    }

    liveItem.attachments.forEach((att) => {
      const attId = att.id;
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
        const curItem = getItemById(itemId);
        if (!curItem) return;
        curItem.attachments = (curItem.attachments || []).filter((a) => a.id !== attId);
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
    const curItem = getItemById(itemId);
    if (!curItem) return;
    const title = titleInput.value.trim() || urlInput.value.trim();
    const url = urlInput.value.trim();
    if (!url) return;
    if (!Array.isArray(curItem.attachments)) curItem.attachments = [];
    curItem.attachments.push({
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
      const curItem = getItemById(itemId);
      if (!curItem) return;
      if (!Array.isArray(curItem.attachments)) curItem.attachments = [];
      curItem.attachments.push({
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
// Firebase Authentication & Real-Time Firestore Per-Item Sync
// ============================================================================
function getWorkspaceMetaRef() {
  const wsId = typeof FIRESTORE_WORKSPACE_ID !== "undefined" ? FIRESTORE_WORKSPACE_ID : "exan-2026";
  return firebaseDb.collection("workspaces").doc(wsId).collection("meta").doc("info");
}

function getWorkspaceItemsCollectionRef() {
  const wsId = typeof FIRESTORE_WORKSPACE_ID !== "undefined" ? FIRESTORE_WORKSPACE_ID : "exan-2026";
  return firebaseDb.collection("workspaces").doc(wsId).collection("items");
}

function showAuthFeedback(msg, isError = false) {
  const box = document.getElementById("auth-feedback-box");
  if (!box) return;
  if (!msg) {
    box.style.display = "none";
    box.textContent = "";
    return;
  }
  box.style.display = "block";
  box.style.borderColor = isError ? "var(--accent-primary)" : "var(--border-strong)";
  box.textContent = msg;
}

function updateAuthModalUI(user) {
  const signedOutView = document.getElementById("auth-signed-out-view");
  const signedInView = document.getElementById("auth-signed-in-view");
  const userEmailEl = document.getElementById("auth-user-email");
  const headerBtn = document.getElementById("btn-open-auth");
  const cloudBadge = document.getElementById("auth-cloud-badge");

  if (user) {
    if (signedOutView) signedOutView.style.display = "none";
    if (signedInView) signedInView.style.display = "flex";
    if (userEmailEl) userEmailEl.textContent = user.email || "Authenticated User";
    if (headerBtn) {
      const shortName = (user.email || "Signed In").split("@")[0];
      headerBtn.textContent = `● Live: ${shortName}`;
    }
    if (cloudBadge) {
      cloudBadge.textContent = cloudSyncActive ? "Live Sync Active" : "Connecting...";
    }
  } else {
    if (signedOutView) signedOutView.style.display = "flex";
    if (signedInView) signedInView.style.display = "none";
    if (headerBtn) {
      headerBtn.textContent = "● Sign In (Live Sync)";
    }
  }
}

function stripCloudMetaFields(docData) {
  const clean = { ...docData };
  delete clean._clientSessionId;
  delete clean._updatedAt;
  delete clean._updatedBy;
  return clean;
}

function snapshotCurrentSyncHashes() {
  lastSyncedMetaJson = serializeComparableMeta(appState.metadata);
  lastSyncedItemJson.clear();
  for (const item of appState.items) {
    lastSyncedItemJson.set(item.id, JSON.stringify(item));
  }
}

function mergeRemoteItemWithLocalEdits(localItem, remoteItem, baseItem) {
  if (!baseItem || !localItem) {
    return { mergedItem: remoteItem, keptLocalChanges: false };
  }

  const merged = structuredClone(remoteItem);
  let keptLocalChanges = false;

  const scalarFields = ["shortTitle", "status", "noResponseNeeded", "questionHtml", "existingAnswerHtml"];
  for (const field of scalarFields) {
    if (localItem[field] !== baseItem[field] && localItem[field] !== remoteItem[field]) {
      merged[field] = localItem[field];
      keptLocalChanges = true;
    }
  }

  // Merge questionLinks per-link so concurrent edits on different links/fields do not clobber each other
  if (Array.isArray(merged.questionLinks) && Array.isArray(localItem.questionLinks) && Array.isArray(baseItem.questionLinks)) {
    const baseLinks = new Map(baseItem.questionLinks.map((l) => [l.id, l]));
    const localLinks = new Map(localItem.questionLinks.map((l) => [l.id, l]));
    for (const rLink of merged.questionLinks) {
      const bLink = baseLinks.get(rLink.id);
      const lLink = localLinks.get(rLink.id);
      if (bLink && lLink) {
        for (const f of ["url", "notesHtml"]) {
          if (lLink[f] !== bLink[f] && lLink[f] !== rLink[f]) {
            rLink[f] = lLink[f];
            keptLocalChanges = true;
          }
        }
      }
    }
  }

  // Merge attachments: keep locally added attachments not yet present in remote
  if (Array.isArray(localItem.attachments) && Array.isArray(baseItem.attachments)) {
    const baseAttIds = new Set(baseItem.attachments.map((a) => a.id));
    const remoteAttIds = new Set((merged.attachments || []).map((a) => a.id));
    for (const lAtt of localItem.attachments) {
      if (!baseAttIds.has(lAtt.id) && !remoteAttIds.has(lAtt.id)) {
        if (!Array.isArray(merged.attachments)) merged.attachments = [];
        merged.attachments.push(structuredClone(lAtt));
        keptLocalChanges = true;
      }
    }
  }

  // Merge Gray Zone sub-items per-field so two members can edit Draft & Optional of the SAME item concurrently
  if (Array.isArray(merged.grayZoneSubItems) && Array.isArray(localItem.grayZoneSubItems) && Array.isArray(baseItem.grayZoneSubItems)) {
    const baseSubs = new Map(baseItem.grayZoneSubItems.map((s) => [s.id, s]));
    const localSubs = new Map(localItem.grayZoneSubItems.map((s) => [s.id, s]));
    const subFields = [
      "prompt",
      "primaryAssignee",
      "draftHtml",
      "finalHtml",
      "isComplete",
      "optionalAssignee",
      "optionalHtml"
    ];

    for (const rSub of merged.grayZoneSubItems) {
      const bSub = baseSubs.get(rSub.id);
      const lSub = localSubs.get(rSub.id);
      if (bSub && lSub) {
        for (const f of subFields) {
          if (lSub[f] !== bSub[f] && lSub[f] !== rSub[f]) {
            rSub[f] = lSub[f];
            keptLocalChanges = true;
          }
        }
      }
    }

    // Preserve any newly added local sub-item not yet synced to cloud
    const mergedSubIds = new Set(merged.grayZoneSubItems.map((s) => s.id));
    for (const lSub of localItem.grayZoneSubItems) {
      if (!baseSubs.has(lSub.id) && !mergedSubIds.has(lSub.id)) {
        merged.grayZoneSubItems.push(structuredClone(lSub));
        keptLocalChanges = true;
      }
    }
  }

  return { mergedItem: merged, keptLocalChanges };
}

function isElementFocused(el) {
  if (!el || !document.activeElement) return false;
  return document.activeElement === el || el.contains(document.activeElement);
}

function syncItemCardDOMInPlace(existingCard, item) {
  if (!existingCard || !item) return;

  const titleEl = existingCard.querySelector('[data-sync-title="true"]');
  if (titleEl && titleEl.textContent !== item.shortTitle) {
    titleEl.textContent = item.shortTitle;
  }

  const subCountBadge = existingCard.querySelector('[data-sync-subcount="true"]');
  if (subCountBadge) {
    subCountBadge.textContent = `Gray Zone: ${item.grayZoneSubItems.length} sub-item(s)`;
  }

  const statusSelect = existingCard.querySelector('[data-sync-field="status"]');
  if (statusSelect && !isElementFocused(statusSelect) && statusSelect.value !== item.status) {
    statusSelect.value = item.status;
  }

  const titleInput = existingCard.querySelector('[data-sync-field="shortTitle"]');
  if (titleInput && !isElementFocused(titleInput) && titleInput.value !== (item.shortTitle || "")) {
    titleInput.value = item.shortTitle || "";
  }

  const qDisplay = existingCard.querySelector('[data-sync-display="questionHtml"]');
  if (qDisplay) {
    const cleanQ = sanitizeHTMLString(item.questionHtml || "");
    if (sanitizeHTMLString(qDisplay.innerHTML) !== cleanQ) {
      safeSetHTML(qDisplay, cleanQ);
    }
  }

  const qEditor = existingCard.querySelector('[data-sync-field="questionHtml"]');
  if (qEditor && !isElementFocused(qEditor)) {
    const cleanQ = sanitizeHTMLString(item.questionHtml || "");
    if (sanitizeHTMLString(qEditor.innerHTML) !== cleanQ) {
      safeSetHTML(qEditor, cleanQ);
    }
  }

  const exEditor = existingCard.querySelector('[data-sync-field="existingAnswerHtml"]');
  if (exEditor && !isElementFocused(exEditor)) {
    const cleanEx = sanitizeHTMLString(item.existingAnswerHtml || "");
    if (sanitizeHTMLString(exEditor.innerHTML) !== cleanEx) {
      safeSetHTML(exEditor, cleanEx);
    }
  }

  // Update question links bar if present
  const existingLinksBar = existingCard.querySelector(".question-links-bar");
  if (existingLinksBar && Array.isArray(item.questionLinks) && item.questionLinks.length > 0) {
    if (!isElementFocused(existingLinksBar)) {
      existingLinksBar.replaceWith(buildQuestionLinksBarDOM(item, getItemPrefix(item)));
    }
  }

  // Update each Gray Zone sub-item surgically (skipping ONLY the exact focused input/editor)
  const dissectList = existingCard.querySelector(".dissect-list");
  if (dissectList && Array.isArray(item.grayZoneSubItems)) {
    const validSubIds = new Set(item.grayZoneSubItems.map((s) => s.id));

    // Remove sub-item cards deleted remotely (unless user is focused inside one)
    for (const domSub of Array.from(dissectList.querySelectorAll(".subitem-card"))) {
      const domSubId = domSub.dataset.subId;
      if (domSubId && !validSubIds.has(domSubId) && !isElementFocused(domSub)) {
        domSub.remove();
      }
    }

    item.grayZoneSubItems.forEach((sub, idx) => {
      let subCard = dissectList.querySelector(`.subitem-card[data-sub-id="${CSS.escape(sub.id)}"]`);
      if (!subCard) {
        subCard = buildGrayZoneSubItemDOM(item, sub, idx, subCountBadge);
        dissectList.appendChild(subCard);
        return;
      }

      const textFields = ["prompt", "primaryAssignee", "optionalAssignee"];
      for (const field of textFields) {
        const inputEl = subCard.querySelector(`[data-sync-sub-field="${field}"]`);
        const nextVal = sub[field] || "";
        if (inputEl && !isElementFocused(inputEl) && inputEl.value !== nextVal) {
          inputEl.value = nextVal;
        }
      }

      const htmlFields = ["draftHtml", "optionalHtml", "finalHtml"];
      for (const field of htmlFields) {
        const editorEl = subCard.querySelector(`[data-sync-sub-field="${field}"]`);
        const nextHtml = sanitizeHTMLString(sub[field] || "");
        if (editorEl && !isElementFocused(editorEl) && sanitizeHTMLString(editorEl.innerHTML) !== nextHtml) {
          safeSetHTML(editorEl, nextHtml);
        }
      }

      const completeCheckbox = subCard.querySelector('[data-sync-sub-field="isComplete"]');
      if (completeCheckbox) {
        const nextChecked = Boolean(sub.isComplete);
        if (completeCheckbox.checked !== nextChecked) {
          completeCheckbox.checked = nextChecked;
        }
        const labelEl = completeCheckbox.closest(".complete-checkbox-label");
        if (labelEl) {
          labelEl.classList.toggle("checked", nextChecked);
        }
      }
    });
  }

  // Update attachments section if user is not focused inside the attachment form
  const attBlock = existingCard.querySelector(".block-attachments");
  if (attBlock && !isElementFocused(attBlock)) {
    attBlock.replaceWith(buildAttachmentsBlockDOM(item));
  }
}

function scheduleCloudDiffSync() {
  if (!cloudSyncActive || !firebaseDb || !currentUser) return;
  if (cloudDiffSyncTimer) clearTimeout(cloudDiffSyncTimer);
  cloudDiffSyncTimer = setTimeout(() => {
    cloudDiffSyncTimer = null;
    flushCloudDiffSync();
  }, 450);
}

async function flushCloudDiffSync() {
  if (!cloudSyncActive || !firebaseDb || !currentUser) return;
  if (isFlushingCloudSync) {
    pendingCloudResync = true;
    return;
  }

  isFlushingCloudSync = true;
  pendingCloudResync = false;

  try {
    const batch = firebaseDb.batch();
    let writeCount = 0;
    let committedMetaJson = null;
    const committedItems = [];

    if (metaSyncReady) {
      const currentMetaJson = serializeComparableMeta(appState.metadata);
      if (currentMetaJson !== lastSyncedMetaJson) {
        batch.set(getWorkspaceMetaRef(), {
          ...appState.metadata,
          _clientSessionId: CLIENT_SESSION_ID,
          _updatedAt: Date.now(),
          _updatedBy: currentUser.email || ""
        });
        committedMetaJson = currentMetaJson;
        writeCount++;
      }
    }

    if (itemsSyncReady) {
      const itemsCol = getWorkspaceItemsCollectionRef();
      for (const item of appState.items) {
        const serialized = JSON.stringify(item);
        if (serialized !== lastSyncedItemJson.get(item.id)) {
          batch.set(itemsCol.doc(item.id), {
            ...item,
            _clientSessionId: CLIENT_SESSION_ID,
            _updatedAt: Date.now(),
            _updatedBy: currentUser.email || ""
          });
          committedItems.push({ id: item.id, serialized });
          writeCount++;
        }
      }
    }

    if (writeCount > 0) {
      await batch.commit();
      if (committedMetaJson !== null) {
        lastSyncedMetaJson = committedMetaJson;
      }
      for (const entry of committedItems) {
        lastSyncedItemJson.set(entry.id, entry.serialized);
      }
      updateSyncStatusUI("live", `Live Synced (${writeCount} update${writeCount > 1 ? "s" : ""}) · ${formatShortTime(new Date().toISOString())}`);
    }
  } catch (err) {
    console.error("Firestore write error:", err);
    if (err.code === "permission-denied") {
      handleFirestorePermissionDenied();
    } else {
      updateSyncStatusUI("error", `Cloud sync error: ${err.message}`);
    }
  } finally {
    isFlushingCloudSync = false;
    if (pendingCloudResync) {
      pendingCloudResync = false;
      scheduleCloudDiffSync();
    }
  }
}

async function pushFullStateToFirestore() {
  if (!firebaseDb || !currentUser) return;
  try {
    updateSyncStatusUI("live", "Uploading full workspace to Firebase Firestore...");
    const batch = firebaseDb.batch();
    batch.set(getWorkspaceMetaRef(), {
      ...appState.metadata,
      _clientSessionId: CLIENT_SESSION_ID,
      _updatedAt: Date.now(),
      _updatedBy: currentUser.email || ""
    });
    const itemsCol = getWorkspaceItemsCollectionRef();
    for (const item of appState.items) {
      batch.set(itemsCol.doc(item.id), {
        ...item,
        _clientSessionId: CLIENT_SESSION_ID,
        _updatedAt: Date.now(),
        _updatedBy: currentUser.email || ""
      });
    }
    await batch.commit();
    metaSyncReady = true;
    itemsSyncReady = true;
    snapshotCurrentSyncHashes();
    updateSyncStatusUI("live", `Live Cloud Sync Active · Uploaded ${formatShortTime(new Date().toISOString())}`);
    showAuthFeedback("Workspace successfully uploaded to Firebase Firestore.");
  } catch (err) {
    console.error("Full cloud upload error:", err);
    if (err.code === "permission-denied") {
      handleFirestorePermissionDenied();
    } else {
      showAuthFeedback(`Upload failed: ${err.message}`, true);
      updateSyncStatusUI("error", `Cloud upload failed: ${err.message}`);
    }
  }
}

function handleFirestorePermissionDenied() {
  stopFirestoreRealtimeSync();
  const email = currentUser?.email || "this account";
  const msg = `Access Denied: "${email}" is not authorized in Firestore Security Rules for workspaces/${typeof FIRESTORE_WORKSPACE_ID !== "undefined" ? FIRESTORE_WORKSPACE_ID : "exan-2026"}. Please check that your email is in the 4-member allowlist.`;
  updateSyncStatusUI("error", "Access Denied (Not in 4-member allowlist)");
  showAuthFeedback(msg, true);
  const badge = document.getElementById("auth-cloud-badge");
  if (badge) badge.textContent = "Access Denied";
  const dlg = document.getElementById("auth-sync-dialog");
  if (dlg && !dlg.open) dlg.showModal();
}

function stopFirestoreRealtimeSync() {
  cloudSyncActive = false;
  metaSyncReady = false;
  itemsSyncReady = false;
  isFlushingCloudSync = false;
  pendingCloudResync = false;
  lastSyncedMetaJson = "";
  lastSyncedItemJson.clear();
  if (cloudDiffSyncTimer) {
    clearTimeout(cloudDiffSyncTimer);
    cloudDiffSyncTimer = null;
  }
  if (unsubscribeMetaListener) {
    unsubscribeMetaListener();
    unsubscribeMetaListener = null;
  }
  if (unsubscribeItemsListener) {
    unsubscribeItemsListener();
    unsubscribeItemsListener = null;
  }
}

function startFirestoreRealtimeSync() {
  if (!firebaseDb || !currentUser) return;
  stopFirestoreRealtimeSync();
  updateSyncStatusUI("live", "Connecting to Firebase Live Sync...");

  let hasCheckedInitialSeed = false;
  let hasReceivedInitialItemsSnapshot = false;

  // 1. Real-time Metadata listener
  unsubscribeMetaListener = getWorkspaceMetaRef().onSnapshot(
    (docSnap) => {
      cloudSyncActive = true;
      updateAuthModalUI(currentUser);

      if (!docSnap.exists) {
        if (!hasCheckedInitialSeed) {
          hasCheckedInitialSeed = true;
          pushFullStateToFirestore();
        }
        return;
      }

      const raw = docSnap.data();
      if (docSnap.metadata.hasPendingWrites || raw._clientSessionId === CLIENT_SESSION_ID) {
        metaSyncReady = true;
        return;
      }

      const cleanMeta = stripCloudMetaFields(raw);
      const isInitialMeta = !metaSyncReady;
      const prevMetaBase = !isInitialMeta && lastSyncedMetaJson ? JSON.parse(lastSyncedMetaJson) : null;
      const mergedMeta = { ...appState.metadata, ...cleanMeta };
      let keptLocalMetaChanges = false;

      if (prevMetaBase) {
        for (const field of ["programName", "preparedBy", "implementationDate", "oneDriveFolderUrl"]) {
          if (appState.metadata[field] !== prevMetaBase[field] && appState.metadata[field] !== cleanMeta[field]) {
            mergedMeta[field] = appState.metadata[field];
            keptLocalMetaChanges = true;
          }
        }
      }

      appState.metadata = mergedMeta;
      lastSyncedMetaJson = serializeComparableMeta({ ...appState.metadata, ...cleanMeta });
      metaSyncReady = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));

      const metaFieldMap = [
        ["meta-program-name", "programName"],
        ["meta-prepared-by", "preparedBy"],
        ["meta-impl-date", "implementationDate"],
        ["meta-onedrive-url", "oneDriveFolderUrl"]
      ];
      for (const [elId, prop] of metaFieldMap) {
        const inputEl = document.getElementById(elId);
        if (inputEl && !isElementFocused(inputEl)) {
          inputEl.value = appState.metadata[prop] || "";
        }
      }
      const oneDriveOpenBtn = document.getElementById("btn-open-onedrive");
      if (oneDriveOpenBtn) {
        oneDriveOpenBtn.disabled = !appState.metadata.oneDriveFolderUrl;
      }

      if (keptLocalMetaChanges) {
        scheduleCloudDiffSync();
      }
      if (!isInitialMeta) {
        updateSyncStatusUI("live", `Live Sync · Metadata updated · ${formatShortTime(new Date().toISOString())}`);
      }
    },
    (err) => {
      console.error("Firestore meta listener error:", err);
      if (err.code === "permission-denied") {
        handleFirestorePermissionDenied();
      } else {
        updateSyncStatusUI("error", `Sync connection error: ${err.message}`);
      }
    }
  );

  // 2. Real-time Per-Item Collection listener
  unsubscribeItemsListener = getWorkspaceItemsCollectionRef().onSnapshot(
    (querySnap) => {
      cloudSyncActive = true;
      updateAuthModalUI(currentUser);

      if (querySnap.empty) {
        if (!hasCheckedInitialSeed) {
          hasCheckedInitialSeed = true;
          pushFullStateToFirestore();
        }
        return;
      }

      const isInitialSnapshot = !hasReceivedInitialItemsSnapshot;
      let remoteChangedCodes = [];
      let needsFullRender = false;
      let shouldResyncMergedLocalEdits = false;

      querySnap.docChanges().forEach((change) => {
        if (change.type !== "added" && change.type !== "modified") return;
        const raw = change.doc.data();
        if (change.doc.metadata.hasPendingWrites || raw._clientSessionId === CLIENT_SESSION_ID) {
          return;
        }

        const normalizedRemote = normalizeSingleItem(stripCloudMetaFields(raw));
        const idx = appState.items.findIndex((i) => i.id === normalizedRemote.id);
        if (idx < 0) return;

        const remoteSerialized = JSON.stringify(normalizedRemote);
        const baseJson = !isInitialSnapshot ? lastSyncedItemJson.get(normalizedRemote.id) : null;

        if (!baseJson) {
          // Initial load: accept authoritative cloud data without modifying existing Firestore records
          appState.items[idx] = normalizedRemote;
        } else {
          // Ongoing live session: 3-way merge preserves any unsent local edits on other fields
          const baseItem = JSON.parse(baseJson);
          const { mergedItem, keptLocalChanges } = mergeRemoteItemWithLocalEdits(
            appState.items[idx],
            normalizedRemote,
            baseItem
          );
          appState.items[idx] = mergedItem;
          if (keptLocalChanges) {
            shouldResyncMergedLocalEdits = true;
          }
        }

        lastSyncedItemJson.set(normalizedRemote.id, remoteSerialized);

        const existingCard = document.getElementById(`card-${normalizedRemote.id}`);
        if (existingCard) {
          if (!existingCard.contains(document.activeElement)) {
            existingCard.replaceWith(buildItemCardDOM(appState.items[idx]));
          } else {
            syncItemCardDOMInPlace(existingCard, appState.items[idx]);
          }
        } else {
          needsFullRender = true;
        }
        remoteChangedCodes.push(appState.items[idx].code);
      });

      hasReceivedInitialItemsSnapshot = true;
      itemsSyncReady = true;

      if (remoteChangedCodes.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
        if (needsFullRender) {
          renderItemsList();
        } else {
          renderDashboardCountsOnly();
          updateQuickJumpPillsState();
        }
        const labelText =
          remoteChangedCodes.length === 1
            ? `Live Sync · Item #${remoteChangedCodes[0]} updated`
            : `Live Sync · ${remoteChangedCodes.length} items synced`;
        updateSyncStatusUI("live", `${labelText} · ${formatShortTime(new Date().toISOString())}`);
      } else if (isInitialSnapshot) {
        updateSyncStatusUI("live", `Live Sync Connected · ${formatShortTime(new Date().toISOString())}`);
      }

      if (shouldResyncMergedLocalEdits) {
        scheduleCloudDiffSync();
      }
    },
    (err) => {
      console.error("Firestore items listener error:", err);
      if (err.code === "permission-denied") {
        handleFirestorePermissionDenied();
      } else {
        updateSyncStatusUI("error", `Sync connection error: ${err.message}`);
      }
    }
  );
}

function initFirebase() {
  if (typeof firebase === "undefined" || typeof FIREBASE_CONFIG === "undefined") {
    updateSyncStatusUI("ok", "Offline / Local Mode (Firebase SDK unavailable)");
    return;
  }
  try {
    firebaseApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
    firebaseAuth = firebase.auth();
    firebaseDb = firebase.firestore();

    firebaseAuth.onAuthStateChanged((user) => {
      currentUser = user || null;
      showAuthFeedback("");
      if (currentUser) {
        updateAuthModalUI(currentUser);
        startFirestoreRealtimeSync();
      } else {
        stopFirestoreRealtimeSync();
        updateAuthModalUI(null);
        updateSyncStatusUI("ok", "Local Auto-Save Only (Sign in for Live Sync)");
      }
    });
  } catch (err) {
    console.warn("Firebase initialization error:", err);
    updateSyncStatusUI("warning", "Local Mode (Firebase init error)");
  }
}

// ============================================================================
// Template Mode (Pre-Extracted Brief vs. Blank Template)
// ============================================================================
function stripQuestionsToBlankTemplate() {
  for (const item of appState.items) {
    item.questionHtml = `<p><strong>${item.code}.</strong> [Enter the question prompt here]</p>`;
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
      questionLinks: currentItem.questionLinks?.length ? currentItem.questionLinks : defItem.questionLinks,
      grayZoneSubItems: defItem.grayZoneSubItems.map((defSub, idx) => {
        const curSub = currentItem.grayZoneSubItems[idx];
        if (!curSub) return defSub;
        return {
          ...defSub,
          primaryAssignee: curSub.primaryAssignee || defSub.primaryAssignee,
          draftHtml: curSub.draftHtml || "",
          finalHtml: curSub.finalHtml || "",
          isComplete: Boolean(curSub.isComplete),
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

  // Firebase Auth & Real-Time Cloud Sync Dialog
  const authDialog = document.getElementById("auth-sync-dialog");
  document.getElementById("btn-open-auth")?.addEventListener("click", () => {
    updateAuthModalUI(currentUser);
    if (window.location.protocol === "file:") {
      showAuthFeedback(
        "Note: Browser security restricts Firebase Sign-In on local file:// URLs. Deploy to GitHub Pages (https://...) or run via http://localhost:8080 to sign in for live sync.",
        false
      );
    }
    authDialog?.showModal();
  });

  document.getElementById("btn-google-signin")?.addEventListener("click", async () => {
    if (!firebaseAuth) {
      showAuthFeedback("Firebase SDK is not loaded (check internet connection).", true);
      return;
    }
    try {
      showAuthFeedback("Opening Google Sign-In...");
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await firebaseAuth.signInWithPopup(provider);
      showAuthFeedback("");
    } catch (err) {
      console.error("Google sign-in error:", err);
      showAuthFeedback(`Google Sign-In failed: ${err.message}`, true);
    }
  });

  document.getElementById("email-signin-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!firebaseAuth) {
      showAuthFeedback("Firebase SDK is not loaded (check internet connection).", true);
      return;
    }
    const email = document.getElementById("auth-email")?.value.trim();
    const password = document.getElementById("auth-password")?.value || "";
    if (!email || !password) return;

    try {
      showAuthFeedback("Signing in...");
      await firebaseAuth.signInWithEmailAndPassword(email, password);
      showAuthFeedback("");
      const pwInput = document.getElementById("auth-password");
      if (pwInput) pwInput.value = "";
    } catch (err) {
      console.error("Email sign-in error:", err);
      showAuthFeedback(`Sign-in failed: ${err.message}`, true);
    }
  });

  document.getElementById("btn-email-signup")?.addEventListener("click", async () => {
    if (!firebaseAuth) {
      showAuthFeedback("Firebase SDK is not loaded (check internet connection).", true);
      return;
    }
    const email = document.getElementById("auth-email")?.value.trim();
    const password = document.getElementById("auth-password")?.value || "";
    if (!email) {
      showAuthFeedback("Please enter your authorized committee email first.", true);
      return;
    }
    if (password.length < 6) {
      showAuthFeedback("Please choose a password of at least 6 characters.", true);
      return;
    }
    try {
      showAuthFeedback("Creating your committee login...");
      await firebaseAuth.createUserWithEmailAndPassword(email, password);
      showAuthFeedback("");
      const pwInput = document.getElementById("auth-password");
      if (pwInput) pwInput.value = "";
    } catch (err) {
      console.error("Account creation error:", err);
      if (err.code === "auth/email-already-in-use") {
        showAuthFeedback("An account already exists for this email. Click 'Sign In' (or 'Forgot Password?') instead.", true);
      } else {
        showAuthFeedback(`Account setup failed: ${err.message}`, true);
      }
    }
  });

  document.getElementById("btn-reset-password")?.addEventListener("click", async () => {
    if (!firebaseAuth) {
      showAuthFeedback("Firebase SDK is not loaded (check internet connection).", true);
      return;
    }
    const email = document.getElementById("auth-email")?.value.trim();
    if (!email) {
      showAuthFeedback("Enter your committee email in the box above, then click 'Forgot Password?'.", true);
      return;
    }
    try {
      await firebaseAuth.sendPasswordResetEmail(email);
      showAuthFeedback(`Password reset link sent to ${email}. Please check your inbox (or spam folder).`);
    } catch (err) {
      console.error("Password reset error:", err);
      showAuthFeedback(`Could not send reset email: ${err.message}`, true);
    }
  });

  document.getElementById("btn-signout")?.addEventListener("click", async () => {
    if (!firebaseAuth) return;
    stopFirestoreRealtimeSync();
    await firebaseAuth.signOut();
    showAuthFeedback("Signed out. App is now in Local Auto-Save mode.");
  });

  // Flush any debounced edits immediately if the user switches tabs or minimizes the browser
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && cloudDiffSyncTimer) {
      clearTimeout(cloudDiffSyncTimer);
      cloudDiffSyncTimer = null;
      flushCloudDiffSync();
    }
  });

  // Initialize Firebase Authentication & Firestore Real-Time Sync
  initFirebase();
}

document.addEventListener("DOMContentLoaded", initApp);
