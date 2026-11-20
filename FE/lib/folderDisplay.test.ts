import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import {
  folderErrorMessage,
  isMissingFolderError,
  normalizeFolderName,
} from "./folderDisplay";

function axiosError(status: number, data: unknown): AxiosError {
  const err = new AxiosError("Request failed");
  err.response = {
    status,
    statusText: "",
    data,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return err;
}

// Both fallbacks are the CALLER'S translated wording now -- this module has no translator.
const OFFLINE = "<offline>";

describe("folderErrorMessage", () => {
  it("prefers the backend's message, which names the folder that clashed", () => {
    const err = axiosError(409, { message: 'You already have a folder called "Japanese".' });
    expect(folderErrorMessage(err, "Couldn't create that folder.", OFFLINE)).toBe(
      'You already have a folder called "Japanese".',
    );
  });

  it("falls back to the caller's wording when the response carries no message", () => {
    expect(folderErrorMessage(axiosError(500, {}), "Couldn't rename it.", OFFLINE)).toBe(
      "Couldn't rename it.",
    );
  });

  it("says the server was unreachable when there is no response at all", () => {
    const err = new AxiosError("Network Error");
    expect(folderErrorMessage(err, "Couldn't create that folder.", OFFLINE)).toBe(OFFLINE);
  });

  it("uses the fallback for anything that isn't an axios error", () => {
    expect(folderErrorMessage(new Error("boom"), "Couldn't delete it.", OFFLINE)).toBe(
      "Couldn't delete it.",
    );
    expect(folderErrorMessage(null, "Couldn't delete it.", OFFLINE)).toBe("Couldn't delete it.");
  });
});

describe("isMissingFolderError", () => {
  it("recognises the 404 a deleted or bookmarked-away folder returns", () => {
    expect(isMissingFolderError(axiosError(404, { message: "Folder not found" }))).toBe(true);
  });

  it("does not mistake other failures for a missing folder", () => {
    expect(isMissingFolderError(axiosError(500, {}))).toBe(false);
    expect(isMissingFolderError(axiosError(401, {}))).toBe(false);
    // No response at all is an unreachable server, which must not read as "deleted".
    expect(isMissingFolderError(new AxiosError("Network Error"))).toBe(false);
    expect(isMissingFolderError(new Error("boom"))).toBe(false);
    expect(isMissingFolderError(null)).toBe(false);
  });
});


describe("normalizeFolderName", () => {
  it("trims what the user typed so a stray space doesn't create a second folder", () => {
    expect(normalizeFolderName("  Japanese  ")).toBe("Japanese");
  });

  it("reduces a whitespace-only name to empty, which callers treat as 'don't submit'", () => {
    expect(normalizeFolderName("   ")).toBe("");
  });
});
