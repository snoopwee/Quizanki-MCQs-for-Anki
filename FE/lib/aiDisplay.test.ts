import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { aiErrorMessage, draftNotes, pdfFileError, remainingCaption } from "@/lib/aiDisplay";
import type { AiDeckDraftMeta } from "@/types/api";

function axiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError("request failed");
  error.response = {
    status,
    statusText: "",
    data,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

const meta = (overrides: Partial<AiDeckDraftMeta> = {}): AiDeckDraftMeta => ({
  provider: "gemini",
  model: "test",
  keyOwner: "shared",
  remainingToday: 4,
  cards: 12,
  chunks: 1,
  inputTruncated: false,
  partial: false,
  ...overrides,
});

describe("aiErrorMessage", () => {
  it("prefers the backend's own message — it already says the useful thing", () => {
    const err = axiosError(429, { message: "You've used today's 5 free generations." });

    expect(aiErrorMessage(err)).toBe("You've used today's 5 free generations.");
  });

  it("falls back per status when the body carries no message", () => {
    expect(aiErrorMessage(axiosError(429, {}))).toContain("today's AI generations");
    expect(aiErrorMessage(axiosError(503, {}))).toContain("isn't available");
    expect(aiErrorMessage(axiosError(413, {}))).toContain("too large");
  });

  it("says so when the request never reached the server", () => {
    expect(aiErrorMessage(new AxiosError("Network Error"))).toContain("Couldn't reach the server");
  });

  it("has a plain fallback for anything else", () => {
    expect(aiErrorMessage(new Error("boom"))).toContain("Couldn't generate cards");
  });
});

describe("remainingCaption", () => {
  it("distinguishes the free pool from the user's own key", () => {
    expect(remainingCaption(4, "shared")).toBe("4 free generations left today");
    expect(remainingCaption(4, "user")).toBe("4 generations left today on your key");
  });

  it("gets the singular right", () => {
    expect(remainingCaption(1, "shared")).toBe("1 free generation left today");
    expect(remainingCaption(0, "shared")).toBe("0 free generations left today");
  });
});

describe("draftNotes", () => {
  it("says nothing when the run was clean", () => {
    expect(draftNotes(meta())).toEqual([]);
  });

  it("explains a truncated source and a partial run", () => {
    expect(draftNotes(meta({ inputTruncated: true }))[0]).toContain("only the first part");
    expect(draftNotes(meta({ partial: true }))[0]).toContain("stopped partway");
    expect(draftNotes(meta({ inputTruncated: true, partial: true }))).toHaveLength(2);
  });
});

describe("pdfFileError", () => {
  const file = (name: string, type: string, size: number) =>
    ({ name, type, size }) as File;

  it("accepts a PDF by type or by name", () => {
    expect(pdfFileError(file("a.pdf", "application/pdf", 1000))).toBeNull();
    // Browsers sometimes send octet-stream.
    expect(pdfFileError(file("chapter.PDF", "application/octet-stream", 1000))).toBeNull();
  });

  it("rejects the obvious mistakes before an upload is spent", () => {
    expect(pdfFileError(file("notes.txt", "text/plain", 1000))).toContain("doesn't look like a PDF");
    expect(pdfFileError(file("a.pdf", "application/pdf", 0))).toContain("empty");
    expect(pdfFileError(file("a.pdf", "application/pdf", 21 * 1024 * 1024))).toContain("larger than 20 MB");
  });
});
