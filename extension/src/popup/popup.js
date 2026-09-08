// Popup: when the user clicks the extension icon, ask the active tab's content
// script for the cards it scanned, show a preview, and let the user import them.

const DEFAULT_APP_URL = "http://localhost:3000";
const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const listEl = $("list");
const footerEl = $("footer");
const importBtn = $("import");

let current = { name: "", pairs: [] };

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function renderCards(name, pairs) {
  current = { name, pairs };
  if (!pairs.length) {
    statusEl.innerHTML =
      "No cards found here. Open a <b>Quizlet</b> or <b>Knowt</b> flashcard set (logged in), then click the icon again.";
    listEl.innerHTML = "";
    footerEl.hidden = true;
    return;
  }
  statusEl.innerHTML = `<span class="setname">${esc(name)}</span> — ${pairs.length} card${pairs.length === 1 ? "" : "s"} ready`;
  listEl.innerHTML = pairs
    .map(
      (p, i) => `<div class="row"><span class="num">${i + 1}</span>` +
        `<span class="front">${esc(p.front) || "<em>(no text)</em>"}</span>` +
        `<span class="back">${esc(p.back) || "<em>(no text)</em>"}</span></div>`,
    )
    .join("");
  importBtn.textContent = `Import ${pairs.length} card${pairs.length === 1 ? "" : "s"}`;
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
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "quizanki-get-cards" });
    renderCards(res?.name || "Imported set", res?.pairs || []);
  } catch {
    // Content script not ready (e.g. page opened before install) — ask for a reload.
    statusEl.innerHTML = "Couldn't read this page. Reload the set page, then click the icon again.";
  }
}

importBtn.addEventListener("click", async () => {
  importBtn.disabled = true;
  importBtn.textContent = "Opening Quizanki…";
  try {
    const res = await chrome.runtime.sendMessage({
      type: "quizanki-import",
      name: current.name,
      pairs: current.pairs,
    });
    if (res && res.ok) {
      importBtn.textContent = "Opened ✓";
      setTimeout(() => window.close(), 800);
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
$("save").addEventListener("click", async () => {
  const appUrl = ($("appUrl").value || DEFAULT_APP_URL).trim().replace(/\/+$/, "");
  await chrome.storage.local.set({ appUrl });
  $("saved").textContent = "Saved ✓";
  setTimeout(() => ($("saved").textContent = ""), 1500);
});

loadCards();
