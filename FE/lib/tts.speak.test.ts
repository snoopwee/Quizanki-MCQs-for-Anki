import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the cloud client so no axios/network is loaded; we assert it's called with
// the right segment and that the returned URL is played.
vi.mock("@/lib/ttsClient", () => ({ fetchTtsUrl: vi.fn() }));

import { fetchTtsUrl } from "@/lib/ttsClient";
import { cancelSpeech, getActiveKey, getActiveStatus, planPlayback, speak } from "@/lib/tts";

const fetchMock = fetchTtsUrl as unknown as ReturnType<typeof vi.fn>;

// Let queued microtasks (the async play loop) settle.
const flush = () => new Promise((r) => setTimeout(r, 0));

class FakeUtterance {
  text: string;
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

class FakeAudio {
  src: string;
  paused = false;
  onplay: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  static instances: FakeAudio[] = [];
  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
  play() {
    this.onplay?.();
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

function makeSynth() {
  return {
    speaking: false,
    pending: false,
    paused: false,
    spoken: [] as FakeUtterance[],
    cancels: 0,
    speak(u: FakeUtterance) {
      this.spoken.push(u);
      this.speaking = true;
    },
    cancel() {
      this.cancels++;
      this.speaking = false;
    },
    resume() {},
    getVoices() {
      return [] as SpeechSynthesisVoice[];
    },
    addEventListener() {},
  };
}

let synth: ReturnType<typeof makeSynth>;

beforeEach(() => {
  synth = makeSynth();
  FakeAudio.instances = [];
  fetchMock.mockReset();
  vi.stubGlobal("window", { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance });
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.stubGlobal("Audio", FakeAudio);
});

afterEach(() => {
  cancelSpeech();
  vi.unstubAllGlobals();
});

describe("planPlayback", () => {
  it("uses the device for empty-lang and for languages the device has", () => {
    const plan = planPlayback(
      [
        { text: "a", lang: "" },
        { text: "b", lang: "ja" },
      ],
      (lang) => lang === "ja",
    );
    expect(plan).toEqual([
      { text: "a", lang: "", source: "device" },
      { text: "b", lang: "ja", source: "device" },
    ]);
  });

  it("routes to the cloud when the device has no voice for the language", () => {
    expect(planPlayback([{ text: "Tôi", lang: "vi" }], () => false)).toEqual([
      { text: "Tôi", lang: "vi", source: "cloud" },
    ]);
  });
});

describe("speak (hybrid playback)", () => {
  it("plays an English segment on the device, with no cloud call", async () => {
    speak("card", "hello");
    expect(getActiveKey()).toBe("card");
    expect(getActiveStatus()).toBe("loading");
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    const u = synth.spoken.at(-1)!;
    expect(u.text).toBe("hello");

    u.onstart!();
    expect(getActiveStatus()).toBe("speaking");
    u.onend!();
    await flush();
    expect(getActiveKey()).toBeNull();
    expect(getActiveStatus()).toBeNull();
  });

  it("routes a Vietnamese segment (no device voice) to the cloud and plays the URL", async () => {
    fetchMock.mockResolvedValue("https://cdn/vi.mp3");

    speak("card", "Tôi đi học");
    expect(getActiveStatus()).toBe("loading");
    await flush();

    expect(fetchMock).toHaveBeenCalledWith("Tôi đi học", "vi");
    const audio = FakeAudio.instances.at(-1)!;
    expect(audio.src).toBe("https://cdn/vi.mp3");
    // play() fires onplay synchronously → loading flips to speaking
    expect(getActiveStatus()).toBe("speaking");

    audio.onended!();
    await flush();
    expect(getActiveKey()).toBeNull();
  });

  it("skips a segment gracefully when the cloud is unavailable", async () => {
    fetchMock.mockRejectedValue(new Error("503"));

    speak("card", "Tôi đi");
    await flush();

    expect(fetchMock).toHaveBeenCalled();
    expect(FakeAudio.instances).toHaveLength(0); // nothing to play
    expect(getActiveKey()).toBeNull(); // chain finished without hanging
  });
});
