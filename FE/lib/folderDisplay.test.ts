import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { deckCountLabel, folderErrorMessage, normalizeFolderName } from "./folderDisplay";

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

describe("folderErrorMessage", () => {
  it("prefers the backend's message, which names the folder that clashed", () => {
    const err = axiosError(409, { message: 'You already have a folder called "Japanese".' });
    expect(folderErrorMessage(err, "Couldn't create that folder.")).toBe(
      'You already have a folder called "Japanese".',
    );
  });

  it("falls back to the caller's wording when the response carries no message", () => {
    expect(folderErrorMessage(axiosError(500, {}), "Couldn't rename it.")).toBe("Couldn't rename it.");
  });

  it("says the server was unreachable when there is no response at all", () => {
    const err = new AxiosError("Network Error");
    expect(folderErrorMessage(err, "Couldn't create that folder.")).toMatch(/connection/i);
  });

  it("uses the fallback for anything that isn't an axios error", () => {
    expect(folderErrorMessage(new Error("boom"), "Couldn't delete it.")).toBe("Couldn't delete it.");
    expect(folderErrorMessage(null, "Couldn't delete it.")).toBe("Couldn't delete it.");
  });
});

describe("deckCountLabel", () => {
  it("singularises one deck and pluralises the rest, empty folders included", () => {
    expect(deckCountLabel(0)).toBe("0 decks");
    expect(deckCountLabel(1)).toBe("1 deck");
    expect(deckCountLabel(12)).toBe("12 decks");
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
