// A single shared <audio> element so at most one stored card-audio clip plays at
// a time — mirroring the one-at-a-time Web Speech model (see lib/tts). The
// SpeakButton subscribes to know whether *its* clip is the one playing, so it can
// swap its icon between play and stop; the flashcard player calls stopClip() at
// the same points it calls cancelSpeech (flip / nav / advance), so speech and a
// stored clip never overlap.

let el: HTMLAudioElement | null = null;
let activeUrl: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

function element(): HTMLAudioElement {
  if (!el) {
    // Created lazily so this module is import-safe during SSR.
    el = new Audio();
    el.addEventListener("ended", () => {
      activeUrl = null;
      notify();
    });
    el.addEventListener("pause", () => {
      // A pause we didn't initiate (e.g. the browser) still means "not playing".
      if (el && el.paused && activeUrl !== null) {
        activeUrl = null;
        notify();
      }
    });
  }
  return el;
}

// Start playing `url`, replacing whatever was playing. A second call with the URL
// that's already playing stops it (toggle), so one button both starts and stops.
export function playClip(url: string): void {
  const audio = element();
  if (activeUrl === url && !audio.paused) {
    stopClip();
    return;
  }
  audio.src = url;
  activeUrl = url;
  notify();
  void audio.play().catch(() => {
    // Autoplay/permission or a bad URL — clear the playing state so the button
    // doesn't get stuck on "stop".
    if (activeUrl === url) {
      activeUrl = null;
      notify();
    }
  });
}

export function stopClip(): void {
  if (el) {
    el.pause();
  }
  if (activeUrl !== null) {
    activeUrl = null;
    notify();
  }
}

export function isClipPlaying(url: string): boolean {
  return activeUrl === url;
}

export function subscribeClip(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
