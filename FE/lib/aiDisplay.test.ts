import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import {
  aiErrorKey,
  draftNotes,
  pdfFileError,
  remainingCaption,
} from "@/lib/aiDisplay";
import type { AiDeckDraftMeta } from "@/types/api";
import { en } from "@/lib/i18n/messages/en";
import { vi as viMessages } from "@/lib/i18n/messages/vi";

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

describe("remainingCaption", () => {
  it("distinguishes the free pool from the user's own key", () => {
    // Two separate keys rather than one template with a spliced "free": English puts the
    // adjective before the noun and Vietnamese does not.
    expect(remainingCaption(4, "shared")).toEqual({
      key: "aiGen.remainingShared",
      vars: { count: 4 },
    });
    expect(remainingCaption(4, "user")).toEqual({
      key: "aiGen.remainingOwnKey",
      vars: { count: 4 },
    });
  });

  it("passes the count through for the catalogue to pluralise", () => {
    // The singular/plural split moved into the catalogue, so the helper only carries the number.
    expect(remainingCaption(1, "shared").vars).toEqual({ count: 1 });
    expect(remainingCaption(0, "shared").vars).toEqual({ count: 0 });
  });
});

describe("draftNotes", () => {
  it("says nothing when the run was clean", () => {
    expect(draftNotes(meta())).toEqual([]);
  });

  it("explains a truncated source and a partial run", () => {
    expect(draftNotes(meta({ inputTruncated: true }))).toEqual(["aiGen.inputTruncated"]);
    expect(draftNotes(meta({ partial: true }))).toEqual(["aiGen.partialRun"]);
    expect(draftNotes(meta({ inputTruncated: true, partial: true }))).toEqual([
      "aiGen.inputTruncated",
      "aiGen.partialRun",
    ]);
  });

  it("points only at keys that exist in both catalogues", () => {
    // The whole point of returning keys: a typo would render the key itself on screen.
    for (const key of draftNotes(meta({ inputTruncated: true, partial: true }))) {
      expect(en[key], key).toBeDefined();
      expect(viMessages[key], key).toBeDefined();
    }
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
    expect(pdfFileError(file("notes.txt", "text/plain", 1000))).toEqual({ key: "aiGen.notAPdf" });
    expect(pdfFileError(file("a.pdf", "application/pdf", 0))).toEqual({ key: "aiGen.emptyFile" });
  });

  it("carries the limit as a variable so the prose cannot drift from the constant", () => {
    expect(pdfFileError(file("a.pdf", "application/pdf", 21 * 1024 * 1024))).toEqual({
      key: "aiGen.pdfTooLarge",
      vars: { limit: 20 },
    });
  });
});

describe("aiErrorKey", () => {
  it("passes the backend's own message through as untranslatable text", () => {
    // ⚠ Deliberate: the server's sentence is more specific than anything we could substitute,
    // and the server has no locale. A Vietnamese reader sees English here until the API learns
    // Accept-Language. The `text` shape is what makes that visible in the type.
    expect(aiErrorKey(axiosError(429, { message: "You've used today's 5 free generations." })))
      .toEqual({ text: "You've used today's 5 free generations." });
  });

  it("falls back to a key when the response carries no message", () => {
    expect(aiErrorKey(axiosError(429, {}))).toEqual({ key: "aiError.quota" });
    expect(aiErrorKey(axiosError(503, {}))).toEqual({ key: "aiError.unavailable" });
    expect(aiErrorKey(axiosError(413, {}))).toEqual({ key: "aiError.tooLarge" });
  });

  it("keys a request that never reached the server separately from one that failed there", () => {
    // No response at all is a connection problem, which needs different advice from a 500.
    expect(aiErrorKey(new AxiosError("Network Error"))).toEqual({ key: "aiError.offline" });
  });

  it("keys a non-axios throw generically", () => {
    expect(aiErrorKey(new Error("boom"))).toEqual({ key: "aiError.generic" });
    expect(aiErrorKey(null)).toEqual({ key: "aiError.generic" });
  });
});
