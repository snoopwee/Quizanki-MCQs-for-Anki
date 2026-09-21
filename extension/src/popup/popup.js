// Popup: when the user clicks the extension icon, ask the active tab's content
// script for the cards it scanned, show a preview, and let the user import them.
//
// Pictures are previewed straight from the source CDN (cheap — no download). The
// bytes are only pulled when the user commits to the import, by asking the content
// script to "materialize" them into data: URLs; see src/content/extract.js for why
// the download has to happen in the content script rather than here.

const DEFAULT_APP_URL = "http://localhost:3000";
const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const listEl = $("list");
const footerEl = $("footer");
const noteEl = $("note");
const importBtn = $("import");

let current = { name: "", pairs: [], imageCount: 0 };
let sourceTabId = null;

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// Only ever render a plain http(s) URL into the preview's src attribute.
function safeUrl(u) {
  return typeof u === "string" && /^https?:\/\//i.test(u) ? u : "";
}

function thumb(url) {
  const safe = safeUrl(url);
  return safe ? `<img class="thumb" src="${esc(safe)}" alt="" loading="lazy">` : "";
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function renderCards(name, pairs, imageCount) {
  current = { name, pairs, imageCount };
  if (!pairs.length) {
    statusEl.innerHTML =
      "No cards found here. Open a <b>Quizlet</b> or <b>Knowt</b> flashcard set (logged in), then click the icon again.";
    listEl.innerHTML = "";
    footerEl.hidden = true;
    return;
  }
  const imgNote = imageCount > 0 ? ` · ${plural(imageCount, "picture")}` : "";
  statusEl.innerHTML = `<span class="setname">${esc(name)}</span> — ${plural(pairs.length, "card")} ready${imgNote}`;
  listEl.innerHTML = pairs
    .map(
      (p, i) => `<div class="row"><span class="num">${i + 1}</span>` +
        `<span class="front">${thumb(p.frontImage)}${esc(p.front) || "<em>(no text)</em>"}</span>` +
        `<span class="back">${thumb(p.backImage)}${esc(p.back) || "<em>(no text)</em>"}</span></div>`,
    )
    .join("");
  noteEl.textContent =
    imageCount > 0
      ? `Pictures and GIFs are downloaded when you import. Audio is still skipped.`
      : `This set has no pictures. Audio is still skipped.`;
  importBtn.textContent = `Import ${plural(pairs.length, "card")}`;
  importBtn.disabled = false;
  footerEl.hidden = false;
}

async function loadCards() {
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    /* ignore */
  }
  if (!tab || !/^https:\/\/(www\.)?(quizlet|knowt)\.com\//.test(tab.url || "")) {
    statusEl.innerHTML = "Open a <b>Quizlet</b> or <b>Knowt</b> flashcard set page, then click this icon.";
    return;
  }
  sourceTabId = tab.id;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "quizanki-get-cards" });
    renderCards(res?.name || "Imported set", res?.pairs || [], res?.imageCount || 0);
  } catch {
    // Content script not ready (e.g. page opened before install) — ask for a reload.
    statusEl.innerHTML = "Couldn't read this page. Reload the set page, then click the icon again.";
  }
}

// The content script reports download progress while materializing pictures.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "quizanki-image-progress") {
    importBtn.textContent = `Downloading pictures… ${msg.done}/${msg.total}`;
  }
});

// Pull the picture bytes for this set. Falls back to the text-only pairs if the
// content script is gone or errors — a set still imports, just without pictures.
async function withImages() {
  if (!current.imageCount || sourceTabId == null) return { pairs: current.pairs, failed: 0 };
  importBtn.textContent = "Downloading pictures…";
  try {
    const r = await chrome.tabs.sendMessage(sourceTabId, { type: "quizanki-materialize-images" });
    if (r && r.ok && Array.isArray(r.pairs)) return { pairs: r.pairs, failed: r.failed || 0 };
  } catch (e) {
    console.error("[Quizanki] image download failed", e);
  }
  return { pairs: current.pairs, failed: current.imageCount };
}

importBtn.addEventListener("click", async () => {
  importBtn.disabled = true;
  try {
    const { pairs, failed } = await withImages();
    importBtn.textContent = "Opening Quizanki…";
    const res = await chrome.runtime.sendMessage({
      type: "quizanki-import",
      name: current.name,
      pairs,
    });
    if (res && res.ok) {
      // Say so when some pictures couldn't be fetched — the cards still import.
      importBtn.textContent = failed > 0 ? `Opened ✓ (${failed} picture(s) skipped)` : "Opened ✓";
      setTimeout(() => window.close(), failed > 0 ? 2200 : 800);
    } else if (res && res.error === "no-permission") {
      importBtn.textContent = "Open ⚙ and re-save your address";
      importBtn.disabled = false;
    } else {
      importBtn.textContent = "Couldn't open — check Settings";
      importBtn.disabled = false;
    }
  } catch (e) {
    console.error(e);
    importBtn.textContent = "Error — see console";
    importBtn.disabled = false;
  }
});

// --- settings (Quizanki address) ---
$("gear").addEventListener("click", () => {
  $("settings").hidden = !$("settings").hidden;
});
chrome.storage.local.get("appUrl").then(({ appUrl }) => {
  $("appUrl").value = appUrl || DEFAULT_APP_URL;
});
// The manifest asks for NO blanket site access. Instead we request permission for
// exactly the origin the user typed, at the moment they save it (a click is the
// user gesture chrome.permissions.request requires). localhost is already in
// host_permissions, so it grants silently.
function originPattern(url) {
  try {
    return new URL(url).origin + "/*";
  } catch {
    return null;
  }
}

$("save").addEventListener("click", async () => {
  const appUrl = ($("appUrl").value || DEFAULT_APP_URL).trim().replace(/\/+$/, "");
  const pattern = originPattern(appUrl);
  if (!pattern) {
    $("saved").textContent = "Invalid URL";
    setTimeout(() => ($("saved").textContent = ""), 2000);
    return;
  }
  try {
    const already = await chrome.permissions.contains({ origins: [pattern] });
    if (!already && !(await chrome.permissions.request({ origins: [pattern] }))) {
      $("saved").textContent = "Access denied";
      setTimeout(() => ($("saved").textContent = ""), 2500);
      return;
    }
  } catch (e) {
    console.error("[Quizanki] permission request failed", e);
  }
  await chrome.storage.local.set({ appUrl });
  $("saved").textContent = "Saved ✓";
  setTimeout(() => ($("saved").textContent = ""), 1500);
});

loadCards();
