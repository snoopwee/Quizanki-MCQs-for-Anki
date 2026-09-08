// Content script on quizlet.com / knowt.com set pages.
//
// Runs automatically on page load: extracts the whole set and reports the count to
// the background worker, which shows it as a badge on the toolbar icon ("ready to
// import"). It draws NO UI on the page. When the user clicks the extension icon,
// the popup asks this script for the cards and shows the preview.
//
// Quizlet fast path: the full set is embedded in #__NEXT_DATA__ (verified: all
// cards, even logged-out on public sets) — instant, no scrolling. Knowt doesn't
// embed its cards (loads them via API), so it falls back to an off-screen DOM read
// and polls until they render. Text only for now (images/TTS kept for later).

(() => {
  "use strict";
  if (window.__quizankiScanner) return;
  window.__quizankiScanner = true;

  const SITE = location.hostname.includes("quizlet")
    ? "quizlet"
    : location.hostname.includes("knowt")
      ? "knowt"
      : "generic";

  const clean = (s) =>
    (s || "").replace(/\s+/g, " ").replace(/^\s*(get a hint|hint)\s*/i, "").trim();

  // ---- Quizlet: read embedded set data (no scroll, no API, all cards) ----------
  function extractQuizletFromNextData() {
    const el = document.getElementById("__NEXT_DATA__");
    if (!el) return null;
    let root;
    try {
      root = JSON.parse(el.textContent);
    } catch {
      return null;
    }
    // Card array is nested and part of the tree is a JSON *string* — parse any
    // string containing "cardSides" until we find the array of card objects.
    let cards = null;
    (function find(o, d) {
      if (cards || d > 16 || o == null) return;
      if (typeof o === "string") {
        if (o.length > 100 && o.includes('"cardSides"')) {
          try {
            find(JSON.parse(o), d + 1);
          } catch {
            /* not JSON */
          }
        }
        return;
      }
      if (typeof o !== "object") return;
      if (Array.isArray(o)) {
        if (o.length && o[0] && typeof o[0] === "object" && "cardSides" in o[0]) {
          cards = o;
          return;
        }
        for (const v of o) {
          if (cards) break;
          find(v, d + 1);
        }
      } else {
        for (const k of Object.keys(o)) {
          if (cards) break;
          find(o[k], d + 1);
        }
      }
    })(root, 0);
    if (!cards) return null;

    const textOfSide = (side) =>
      (side && Array.isArray(side.media) ? side.media : [])
        .filter((m) => m && m.type === 1 && typeof m.plainText === "string")
        .map((m) => m.plainText)
        .join(" ")
        .trim();
    const pickSide = (sides, label, idx) =>
      sides.find((s) => s && s.label === label) || sides[idx] || null;

    return cards.map((c) => {
      const sides = Array.isArray(c.cardSides) ? c.cardSides : [];
      return {
        front: textOfSide(pickSide(sides, "word", 0)),
        back: textOfSide(pickSide(sides, "definition", 1)),
      };
    });
  }

  // ---- Generic / Knowt fallback: off-screen structural DOM read ----------------
  function scrapeDom() {
    let best = null;
    let bestCount = 0;
    for (const container of document.querySelectorAll("ul, ol, div, section")) {
      const kids = container.children;
      if (kids.length < 3) continue;
      const rows = [];
      for (const child of kids) {
        const cells = [...child.children].filter((c) => clean(c.textContent).length > 0);
        if (cells.length >= 2) {
          const front = clean(cells[0].textContent);
          const back = clean(cells[1].textContent);
          if (front || back) rows.push({ front, back });
        }
      }
      if (rows.length >= 3 && rows.length > bestCount && rows.length >= kids.length * 0.5) {
        best = rows;
        bestCount = rows.length;
      }
    }
    return best || [];
  }

  function dedupeClean(pairs) {
    const seen = new Set();
    const out = [];
    for (const p of pairs || []) {
      const front = clean(p.front);
      const back = clean(p.back);
      if (!front && !back) continue;
      if (/create an account|sign in to access|log ?in to see/i.test(front + " " + back)) continue;
      const key = front + " " + back;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ front, back });
    }
    return out;
  }

  function extractCards() {
    let pairs = null;
    if (SITE === "quizlet") pairs = extractQuizletFromNextData();
    if (!pairs || pairs.length === 0) pairs = scrapeDom();
    return dedupeClean(pairs);
  }

  function setName() {
    return clean(document.title).replace(/\s*[|\-–]\s*(quizlet|knowt).*$/i, "") || "Imported set";
  }

  // ---- Scan on load; report the count so the icon can badge it -----------------
  let lastScan = { name: setName(), pairs: [] };

  function report() {
    try {
      chrome.runtime.sendMessage({ type: "quizanki-scanned", count: lastScan.pairs.length });
    } catch {
      /* worker asleep — the popup can still pull cards on demand */
    }
  }

  function runScan() {
    lastScan = { name: setName(), pairs: extractCards() };
    report();
  }

  // Quizlet data is in the initial HTML → ready now. Knowt renders cards async →
  // poll a few times until some appear (or give up), updating the badge as it goes.
  runScan();
  if (lastScan.pairs.length === 0 && SITE !== "quizlet") {
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      const pairs = extractCards();
      if (pairs.length > lastScan.pairs.length) {
        lastScan = { name: setName(), pairs };
        report();
      }
      if (pairs.length > 0 || tries >= 8) clearInterval(timer);
    }, 800);
  }

  // The popup asks for the current cards when the user clicks the icon.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "quizanki-get-cards") {
      // Re-scan on demand too, in case the page finished loading after the initial pass.
      const pairs = extractCards();
      if (pairs.length >= lastScan.pairs.length) lastScan = { name: setName(), pairs };
      sendResponse({ site: SITE, name: lastScan.name, pairs: lastScan.pairs });
      return true;
    }
  });
})();
