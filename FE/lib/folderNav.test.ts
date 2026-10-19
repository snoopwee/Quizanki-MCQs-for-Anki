import { describe, expect, it } from "vitest";
import { folderHref, navMatches, railFolders, RAIL_FOLDER_LIMIT } from "./folderNav";
import type { FolderResponse } from "@/types/api";

function folder(name: string, updatedAt: string, id = name.toLowerCase()): FolderResponse {
  return { id, name, deckCount: 0, updatedAt, containsDeck: false };
}

describe("folderHref", () => {
  it("addresses a folder by id, because names change and ids don't", () => {
    expect(folderHref("8b1f-c0de")).toBe("/folders/8b1f-c0de");
  });
});

describe("railFolders", () => {
  it("puts the most recently touched folder first", () => {
    const { shown } = railFolders([
      folder("Old", "2026-01-01T00:00:00Z"),
      folder("New", "2026-10-09T00:00:00Z"),
      folder("Middle", "2026-06-01T00:00:00Z"),
    ]);
    expect(shown.map((f) => f.name)).toEqual(["New", "Middle", "Old"]);
  });

  it("breaks ties on name so the order never jitters between renders", () => {
    const same = "2026-10-09T00:00:00Z";
    const { shown } = railFolders([folder("Beta", same), folder("Alpha", same)]);
    expect(shown.map((f) => f.name)).toEqual(["Alpha", "Beta"]);
  });

  it("caps the list and reports how many it left out", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      folder(`F${i}`, `2026-10-0${(9 - i) % 10}T00:00:00Z`, `id-${i}`),
    );
    const { shown, overflow } = railFolders(many, 4);
    expect(shown).toHaveLength(4);
    expect(overflow).toBe(6);
  });

  it("reports no overflow when everything fits", () => {
    const { shown, overflow } = railFolders([folder("One", "2026-10-09T00:00:00Z")]);
    expect(shown).toHaveLength(1);
    expect(overflow).toBe(0);
  });

  it("does not mutate the array it was handed", () => {
    const input = [folder("Old", "2026-01-01T00:00:00Z"), folder("New", "2026-10-09T00:00:00Z")];
    railFolders(input);
    expect(input.map((f) => f.name)).toEqual(["Old", "New"]);
  });

  it("treats a missing list as empty — the query has not resolved yet", () => {
    expect(railFolders(undefined)).toEqual({ shown: [], overflow: 0 });
  });

  it("survives a folder with no timestamp rather than throwing", () => {
    const undated = { ...folder("Undated", ""), updatedAt: undefined as unknown as string };
    const { shown } = railFolders([undated, folder("Dated", "2026-10-09T00:00:00Z")]);
    expect(shown.map((f) => f.name)).toEqual(["Dated", "Undated"]);
  });

  it("shows nothing but counts everything when the limit is zero", () => {
    expect(railFolders([folder("A", "2026-10-09T00:00:00Z")], 0)).toEqual({ shown: [], overflow: 1 });
  });

  it("defaults to a limit small enough to leave room for the account menu", () => {
    expect(RAIL_FOLDER_LIMIT).toBeLessThanOrEqual(8);
  });
});

describe("navMatches", () => {
  it("matches a link's own URL", () => {
    expect(navMatches("/folders", "/folders")).toBe(true);
    expect(navMatches("/home", "/folders")).toBe(false);
  });

  it("does NOT claim sub-routes unless the entry owns the section", () => {
    expect(navMatches("/folders/abc", "/folders")).toBe(false);
    expect(navMatches("/folders/abc", "/folders", true)).toBe(true);
  });

  it("keeps a section highlighted several levels deep", () => {
    expect(navMatches("/folders/abc/edit", "/folders", true)).toBe(true);
  });

  it("does not let a section swallow a sibling route with the same prefix", () => {
    // The trailing slash is the whole reason this is a helper and not an inline startsWith.
    expect(navMatches("/folders-archive", "/folders", true)).toBe(false);
  });
});
