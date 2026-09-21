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
// and polls until they render.
//
// Images/GIFs: extraction records the image URL per face (cheap — no download), so
// the popup can preview them. Only when the user actually clicks Import do we
// download the bytes and inline them as `data:` URLs ("materializing"), because
// that is exactly what the app's save path already understands: a data URL in the
// draft gets compressed, content-hashed, deduped and uploaded by
// FE/lib/cardImageUpload.ts. Animated GIFs survive — that path deliberately skips
// re-encoding GIF so the animation isn't flattened.
//
// Why the download happens HERE and not in the app or the service worker: a
// content script's fetch is evaluated against the PAGE's origin, and Quizlet's
// image CDN (o.quizlet.com) allows that — verified 2026-09-11, a real cross-origin
// fetch from a quizlet.com page returns a readable `type:"cors"` response while
// control fetches to non-CORS hosts fail. Downloading here therefore needs NO
// extra host permission, so the extension keeps the narrow permission set from the
// 2026-09 security fix. A CDN that refuses simply yields a card without its
// picture — never a broken import.

(() => {
  "use strict";
  if (window.__quizankiScanner) return;
  window.__quizankiScanner = true;

  const SITE = location.hostname.includes("quizlet")
    ? "quizlet"
    : location.hostname.includes("knowt")
      ? "knowt"
      : "generic";

  // Per-image and whole-set ceilings. Quizlet's embedded variant is ~15-80 KB, so
  // these sit far above anything normal and exist only to stop one pathological
  // set from building a message big enough to wedge the popup or the target tab.
  const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
  const MAX_TOTAL_IMAGE_CHARS = 24 * 1024 * 1024;
  const IMAGE_CONCURRENCY = 6;

  const clean = (s) =>
    (s || "").replace(/\s+/g, " ").replace(/^\s*(get a hint|hint)\s*/i, "").trim();

  const httpUrl = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : "");

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

    // A side's `media` array mixes text (type 1, carries plainText) with images
    // (type 2, carries url/width/height) — verified against a live set 2026-09-11.
    const mediaOf = (side) => (side && Array.isArray(side.media) ? side.media : []);
    const textOfSide = (side) =>
      mediaOf(side)
        .filter((m) => m && m.type === 1 && typeof m.plainText === "string")
        .map((m) => m.plainText)
        .join(" ")
        .trim();
    const imageOfSide = (side) => {
      for (const m of mediaOf(side)) {
        if (m && m.type === 2) {
          const url = httpUrl(m.url);
          if (url) return url;
        }
      }
      return "";
    };
    const pickSide = (sides, label, idx) =>
      sides.find((s) => s && s.label === label) || sides[idx] || null;

    return cards.map((c) => {
      const sides = Array.isArray(c.cardSides) ? c.cardSides : [];
      const front = pickSide(sides, "word", 0);
      const back = pickSide(sides, "definition", 1);
      return {
        front: textOfSide(front),
        back: textOfSide(back),
        frontImage: imageOfSide(front),
        backImage: imageOfSide(back),
      };
    });
  }

  // ---- Generic / Knowt fallback: off-screen structural DOM read ----------------
  function cellImage(cell) {
    const img = cell.querySelector("img");
    if (!img) return "";
    return httpUrl(img.currentSrc || img.getAttribute("src") || "");
  }

  function scrapeDom() {
    let best = null;
    let bestCount = 0;
    for (const container of document.querySelectorAll("ul, ol, div, section")) {
      const kids = container.children;
      if (kids.length < 3) continue;
      const rows = [];
      for (const child of kids) {
        // A cell counts as content if it has text OR an image, so an image-only
        // face (common on picture decks) no longer hides the row from the scraper.
        const cells = [...child.children].filter(
          (c) => clean(c.textContent).length > 0 || cellImage(c) !== "",
        );
        if (cells.length >= 2) {
          const front = clean(cells[0].textContent);
          const back = clean(cells[1].textContent);
          const frontImage = cellImage(cells[0]);
          const backImage = cellImage(cells[1]);
          if (front || back || frontImage || backImage) {
            rows.push({ front, back, frontImage, backImage });
          }
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
      const frontImage = httpUrl(p.frontImage);
      const backImage = httpUrl(p.backImage);
      // Keep an image-only card — dropping it would silently lose a picture deck.
      if (!front && !back && !frontImage && !backImage) continue;
      if (/create an account|sign in to access|log ?in to see/i.test(front + " " + back)) continue;
      const key = [front, back, frontImage, backImage].join("\n");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ front, back, frontImage, backImage });
    }
    return out;
  }

  function extractCards() {
    let pairs = null;
    if (SITE === "quizlet") pairs = extractQuizletFromNextData();
    if (!pairs || pairs.length === 0) pairs = scrapeDom();
    return dedupeClean(pairs);
  }

  function countImages(pairs) {
    let n = 0;
    for (const p of pairs) {
      if (p.frontImage) n++;
      if (p.backImage) n++;
    }
    return n;
  }

  // ---- Materializing images: URL -> data: URL ---------------------------------
  // `credentials: "omit"` keeps the user's CDN cookies out of the request; we only
  // ever want the public bytes.
  async function urlToDataUrl(url) {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const blob = await res.blob();
    if (!/^image\//i.test(blob.type)) throw new Error("not an image: " + blob.type);
    if (blob.size > MAX_IMAGE_BYTES) throw new Error("image too large");
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error || new Error("read failed"));
      fr.readAsDataURL(blob);
    });
  }

  async function mapWithConcurrency(items, limit, fn) {
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  }

  const stripToText = (p) => ({ front: p.front, back: p.back, frontImage: "", backImage: "" });

  // Download each distinct image once and swap the URLs for data URLs. A failed or
  // oversized image is left out (that face just imports without a picture) and
  // counted, so the popup can say so instead of failing the whole import.
  async function materialize(pairs) {
    const urls = [...new Set(pairs.flatMap((p) => [p.frontImage, p.backImage]).filter(Boolean))];
    if (urls.length === 0) {
      return { pairs: pairs.map(stripToText), fetched: 0, failed: 0 };
    }

    const dataByUrl = new Map();
    let failed = 0;
    let totalChars = 0;
    let done = 0;

    await mapWithConcurrency(urls, IMAGE_CONCURRENCY, async (url) => {
      try {
        if (totalChars >= MAX_TOTAL_IMAGE_CHARS) throw new Error("set image budget reached");
        const dataUrl = await urlToDataUrl(url);
        totalChars += dataUrl.length;
        dataByUrl.set(url, dataUrl);
      } catch (e) {
        failed++;
        console.warn("[Quizanki] image skipped:", url, String((e && e.message) || e));
      }
      done++;
      try {
        chrome.runtime.sendMessage({ type: "quizanki-image-progress", done, total: urls.length });
      } catch {
        /* popup closed — progress is cosmetic */
      }
    });

    const swapped = pairs.map((p) => ({
      front: p.front,
      back: p.back,
      frontImage: dataByUrl.get(p.frontImage) || "",
      backImage: dataByUrl.get(p.backImage) || "",
    }));
    return { pairs: swapped, fetched: dataByUrl.size, failed };
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

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    // The popup asks for the current cards when the user clicks the icon. Images
    // are still plain URLs here — cheap to produce and enough to preview.
    if (msg && msg.type === "quizanki-get-cards") {
      // Re-scan on demand too, in case the page finished loading after the initial pass.
      const pairs = extractCards();
      if (pairs.length >= lastScan.pairs.length) lastScan = { name: setName(), pairs };
      sendResponse({
        site: SITE,
        name: lastScan.name,
        pairs: lastScan.pairs,
        imageCount: countImages(lastScan.pairs),
      });
      return true;
    }

    // The user pressed Import: download the pictures and inline them, so the app
    // receives self-contained cards and never has to reach back out to the CDN.
    if (msg && msg.type === "quizanki-materialize-images") {
      materialize(lastScan.pairs)
        .then((r) => sendResponse({ ok: true, name: lastScan.name, ...r }))
        .catch((e) => {
          console.error("[Quizanki] materialize failed", e);
          // Fall back to text-only rather than losing the whole import.
          sendResponse({
            ok: true,
            name: lastScan.name,
            pairs: lastScan.pairs.map(stripToText),
            fetched: 0,
            failed: countImages(lastScan.pairs),
          });
        });
      return true; // async sendResponse
    }
  });
})();
