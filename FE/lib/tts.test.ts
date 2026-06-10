import { describe, expect, it } from "vitest";
import { hasVoiceFor, pickVoice } from "@/lib/tts";

// Minimal stand-ins for SpeechSynthesisVoice — pickVoice only reads `.lang`.
function voice(lang: string, name = lang): SpeechSynthesisVoice {
  return { lang, name, default: false, localService: true, voiceURI: name } as SpeechSynthesisVoice;
}

const VOICES = [voice("en-US", "Samantha"), voice("ja-JP", "Kyoko"), voice("fr-FR", "Thomas")];

describe("pickVoice", () => {
  it("matches an exact BCP-47 tag", () => {
    expect(pickVoice(VOICES, "ja-JP")?.name).toBe("Kyoko");
  });

  it("falls back to the primary subtag", () => {
    expect(pickVoice(VOICES, "ja")?.name).toBe("Kyoko");
    expect(pickVoice(VOICES, "en")?.name).toBe("Samantha");
    expect(pickVoice(VOICES, "fr-CA")?.name).toBe("Thomas"); // fr-CA → fr-FR
  });

  it("is case-insensitive", () => {
    expect(pickVoice(VOICES, "JA-jp")?.name).toBe("Kyoko");
  });

  it("returns null when nothing matches or lang is empty", () => {
    expect(pickVoice(VOICES, "ko")).toBeNull();
    expect(pickVoice(VOICES, "")).toBeNull();
  });
});

describe("hasVoiceFor", () => {
  it("is always true for an empty lang (browser default voice)", () => {
    expect(hasVoiceFor(VOICES, "")).toBe(true);
    expect(hasVoiceFor([], "")).toBe(true);
  });

  it("stays optimistic while voices haven't loaded yet (empty list)", () => {
    // Voices populate asynchronously; disabling during the load window would
    // wrongly block a machine that does have the voice.
    expect(hasVoiceFor([], "ja")).toBe(true);
  });

  it("disables only once voices are known and none match", () => {
    expect(hasVoiceFor(VOICES, "ja")).toBe(true);
    expect(hasVoiceFor(VOICES, "ko")).toBe(false);
  });
});
