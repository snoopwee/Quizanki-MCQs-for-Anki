// Service worker.
//  - "quizanki-scanned": a set page reported how many cards it found → badge the
//    toolbar icon with the count so the user sees the page is ready to import.
//  - "quizanki-import": the popup asked to import → open Quizanki's review screen
//    and inject the pairs via a same-origin postMessage the app listens for
//    (see FE/lib/extensionImport.ts).

const DEFAULT_APP_URL = "http://localhost:3000";

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: "#2f8f6f" });
});

async function getAppUrl() {
  try {
    const { appUrl } = await chrome.storage.local.get("appUrl");
    return (appUrl || DEFAULT_APP_URL).replace(/\/+$/, "");
  } catch {
    return DEFAULT_APP_URL;
  }
}

// Runs IN the opened Quizanki tab (isolated world; shares window messaging with the
// page). Posts the pairs once, and again when the page signals it's ready — so it
// works whether the page mounts before or after this injection.
function deliverToPage(payload) {
  const msg = {
    source: "quizanki-extension",
    type: "import-pairs",
    name: payload.name,
    pairs: payload.pairs,
  };
  const post = () => window.postMessage(msg, window.location.origin);
  window.addEventListener("message", (e) => {
    if (e.source === window && e.data && e.data.source === "quizanki-app" && e.data.type === "ready") {
      post();
    }
  });
  post();
}

function injectWhenLoaded(tabId, payload) {
  const onUpdated = (updatedTabId, info) => {
    if (updatedTabId !== tabId || info.status !== "complete") return;
    chrome.tabs.onUpdated.removeListener(onUpdated);
    setTimeout(() => {
      chrome.scripting
        .executeScript({ target: { tabId }, func: deliverToPage, args: [payload] })
        .catch((e) => console.error("[Quizanki] inject failed", e));
    }, 800);
  };
  chrome.tabs.onUpdated.addListener(onUpdated);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "quizanki-scanned") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId != null) {
      chrome.action.setBadgeText({ tabId, text: msg.count ? String(msg.count) : "" });
    }
    return; // no response needed
  }

  if (msg && msg.type === "quizanki-import") {
    (async () => {
      try {
        const appUrl = await getAppUrl();
        // We hold no blanket host access — injecting into the Quizanki tab needs
        // permission for that exact origin, granted when the user saved the
        // address in the popup. Fail loudly rather than opening a tab that then
        // silently never receives the cards.
        let pattern = null;
        try {
          pattern = new URL(appUrl).origin + "/*";
        } catch {
          /* malformed stored URL */
        }
        if (!pattern || !(await chrome.permissions.contains({ origins: [pattern] }))) {
          sendResponse({ ok: false, error: "no-permission" });
          return;
        }
        const tab = await chrome.tabs.create({ url: `${appUrl}/import?from=extension` });
        injectWhenLoaded(tab.id, { name: msg.name, pairs: msg.pairs });
        sendResponse({ ok: true });
      } catch (e) {
        console.error("[Quizanki] open failed", e);
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // async sendResponse
  }
});
