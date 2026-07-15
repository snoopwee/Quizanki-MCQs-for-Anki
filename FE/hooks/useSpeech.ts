"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  cancelSpeech,
  getActiveKey,
  getActiveStatus,
  getVoices,
  isSpeechSupported,
  speak,
  subscribe,
} from "@/lib/tts";

const EMPTY_VOICES: SpeechSynthesisVoice[] = [];

// True only after mount, so a server render (no speechSynthesis) and the first
// client render agree — without this gate the speaker UI would hydrate-mismatch
// (absent on the server, present on the client).
export function useSpeechSupported(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && isSpeechSupported();
}

// React glue over the tts.ts singleton. Every SpeakButton shares one active key,
// its status (loading → speaking), and one voice list (all module-level), so
// starting a new speaker visibly stops the previous one everywhere. `toggle`
// plays a key, or stops it if it's already the active one.
export function useSpeech() {
  const supported = useSpeechSupported();
  const activeKey = useSyncExternalStore(subscribe, getActiveKey, () => null);
  const activeStatus = useSyncExternalStore(subscribe, getActiveStatus, () => null);
  const voices = useSyncExternalStore(subscribe, getVoices, () => EMPTY_VOICES);

  // `lang` is the optional per-face primary-language hint (BCP-47 primary subtag)
  // passed through to the speech layer to disambiguate same-script detection.
  const toggle = useCallback((key: string, text: string, lang = "") => {
    if (getActiveKey() === key) cancelSpeech();
    else speak(key, text, lang);
  }, []);

  return { supported, activeKey, activeStatus, voices, toggle, cancel: cancelSpeech };
}
