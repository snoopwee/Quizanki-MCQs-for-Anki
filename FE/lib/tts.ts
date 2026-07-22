// Hybrid text-to-speech orchestration. A card is split into per-language segments
// (lib/ttsLang) and each is played in order, choosing per segment:
//   - the free browser Web Speech voice when the device has one for that language
//   - otherwise the backend cloud fallback (lib/ttsClient), played as an <audio>
// So a Japanese-then-Vietnamese card reads each part in the right voice even on a
// device that only has, say, an English and Japanese voice installed.
//
// The subscribe / getVoices / getActiveKey / getActiveStatus surface is shaped for
// React's useSyncExternalStore (see hooks/useSpeech.ts). One "active key" + status
// (loading → speaking) is shared across every SpeakButton.

import { segmentByLang } from "@/lib/ttsLang";
import { fetchTtsUrl } from "@/lib/ttsClient";

export type SpeechStatus = "loading" | "speaking";

export interface PlaybackStep {
  text: string;
  lang: string;
  source: "device" | "cloud";
}

export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

let voices: SpeechSynthesisVoice[] = [];
let activeKey: string | null = null;
let activeStatus: SpeechStatus | null = null;
// Monotonic token for the current playback run. Bumping it (a new speak, or a
// stop) makes the in-flight async loop and any late callbacks no-op.
let currentGen = 0;
// Held only while playing — keeps the utterance reachable so Chrome can't GC it
// mid-playback (the classic "no sound" bug). Write-only by design: the reference
// itself is the point, so it's never read back.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeAudio: HTMLAudioElement | null = null;
// Resolves/aborts the in-flight segment so Stop interrupts cleanly.
let abortStep: (() => void) | null = null;
let voicesInit = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function ensureVoicesLoaded(): void {
  if (voicesInit || !isSpeechSupported()) return;
  voicesInit = true;
  const load = () => {
    const next = window.speechSynthesis.getVoices();
    if (next.length) {
      voices = next;
      notify();
    }
  };
  load();
  window.speechSynthesis.addEventListener?.("voiceschanged", load);
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  ensureVoicesLoaded();
  return () => {
    listeners.delete(cb);
  };
}

export function getVoices(): SpeechSynthesisVoice[] {
  return voices;
}

export function getActiveKey(): string | null {
  return activeKey;
}

export function getActiveStatus(): SpeechStatus | null {
  return activeStatus;
}

// Pure: pick the best installed voice for `lang` (exact tag, then primary subtag).
// Null when nothing fits or lang is empty.
export function pickVoice(
  available: SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | null {
  if (!lang) return null;
  const want = lang.toLowerCase();
  const primary = want.split("-")[0];
  const exact = available.find((v) => v.lang.toLowerCase() === want);
  if (exact) return exact;
  const byPrimary = available.find((v) => v.lang.toLowerCase().split("-")[0] === primary);
  return byPrimary ?? null;
}

// Pure: is `lang` speakable on this device? Empty lang → yes (browser default);
// empty voice list → optimistically yes (voices load async).
export function hasVoiceFor(available: SpeechSynthesisVoice[], lang: string): boolean {
  if (!lang) return true;
  if (available.length === 0) return true;
  return pickVoice(available, lang) !== null;
}

// Pure: decide, per segment, whether the device can speak it or it needs the cloud
// fallback. lang "" always uses the device default voice.
export function planPlayback(
  segments: Array<{ text: string; lang: string }>,
  hasDeviceVoice: (lang: string) => boolean,
): PlaybackStep[] {
  return segments.map((s) => ({
    text: s.text,
    lang: s.lang,
    source: s.lang === "" || hasDeviceVoice(s.lang) ? "device" : "cloud",
  }));
}

function markSpeaking(gen: number): void {
  if (gen === currentGen && activeStatus === "loading") {
    activeStatus = "speaking";
    notify();
  }
}

function clearState(): void {
  activeKey = null;
  activeStatus = null;
}

// Stops whatever is playing and invalidates the current run.
function stopPlayback(): void {
  currentGen++;
  if (isSpeechSupported()) window.speechSynthesis.cancel();
  if (activeAudio) {
    try {
      activeAudio.pause();
    } catch {
      // ignore
    }
    activeAudio = null;
  }
  if (abortStep) {
    const abort = abortStep;
    abortStep = null;
    abort();
  }
  activeUtterance = null;
}

function playDevice(step: PlaybackStep, gen: number): Promise<void> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(step.text);
    if (step.lang) utterance.lang = step.lang;
    const voice = pickVoice(voices, step.lang);
    if (voice) utterance.voice = voice;
    activeUtterance = utterance;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    // Failsafe: some engines stay silent without firing end — never hang the chain.
    const timer = setTimeout(finish, 15000);
    abortStep = finish;
    utterance.onstart = () => markSpeaking(gen);
    utterance.onend = finish;
    utterance.onerror = finish;

    window.speechSynthesis.speak(utterance);
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  });
}

async function playCloud(step: PlaybackStep, gen: number): Promise<void> {
  let url: string;
  try {
    url = await fetchTtsUrl(step.text, step.lang);
  } catch {
    // Cloud unavailable (feature off / rate limited / offline) — skip this
    // segment so the rest of the card still plays. The device-only experience
    // is never worse than before.
    return;
  }
  if (gen !== currentGen) return;

  await new Promise<void>((resolve) => {
    const audio = new Audio(url);
    activeAudio = audio;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, 20000);
    abortStep = () => {
      try {
        audio.pause();
      } catch {
        // ignore
      }
      finish();
    };
    audio.onplay = () => markSpeaking(gen);
    audio.onended = finish;
    audio.onerror = finish;
    void audio.play().catch(finish);
  });
}

async function run(plan: PlaybackStep[], gen: number): Promise<void> {
  for (const step of plan) {
    if (gen !== currentGen) return;
    if (step.source === "device") await playDevice(step, gen);
    else await playCloud(step, gen);
  }
  if (gen === currentGen) {
    clearState();
    notify();
  }
}

// Speak `text` under `key`: stop anything playing, split into per-language
// segments, and play them in order (device voice or cloud fallback per segment).
// `hint` is the face's primary language (BCP-47 primary subtag) — it disambiguates
// same-script runs (e.g. bare kanji → Japanese, not Chinese); "" = pure auto.
export function speak(key: string, text: string, hint = ""): void {
  if (!isSpeechSupported() || text.trim().length === 0) return;
  ensureVoicesLoaded();
  stopPlayback();

  const detected = segmentByLang(text, hint);
  const segments = detected.length > 0 ? detected : [{ text, lang: "" }];
  const plan = planPlayback(segments, (lang) => pickVoice(voices, lang) !== null);

  const gen = currentGen;
  activeKey = key;
  activeStatus = "loading";
  notify();
  void run(plan, gen);
}

export function cancelSpeech(): void {
  if (!isSpeechSupported()) return;
  const wasActive = activeKey !== null;
  stopPlayback();
  if (wasActive) {
    clearState();
    notify();
  }
}
