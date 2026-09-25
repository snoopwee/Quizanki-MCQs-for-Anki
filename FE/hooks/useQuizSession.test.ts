import { describe, expect, it } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateAfterAnswer } from "@/hooks/useQuizSession";

// What a recorded answer refreshes. The `refetchType` matters as much as the key: Learn records
// answers while the deck's own queries are still mounted, so a plain invalidate would refetch the
// whole deck after every card (megabytes each, on a big deck). Mark stale, refetch on next mount.
function collectInvalidations() {
  const calls: { queryKey: unknown[]; refetchType?: string }[] = [];
  const queryClient = {
    invalidateQueries: (options: { queryKey: unknown[]; refetchType?: string }) => {
      calls.push(options);
    },
  } as unknown as QueryClient;
  invalidateAfterAnswer(queryClient);
  return calls;
}

const refetchTypeOf = (key: string) =>
  collectInvalidations().find((c) => c.queryKey[0] === key)?.refetchType;

describe("invalidateAfterAnswer", () => {
  it("refreshes everything an answer changes", () => {
    const keys = collectInvalidations().map((c) => c.queryKey[0]);
    expect(keys).toEqual(
      expect.arrayContaining(["notes", "decks", "deck-contents", "deck-stats", "deck-stats-history", "streak"]),
    );
  });

  it("never refetches the big deck payloads while a study screen holds them", () => {
    expect(refetchTypeOf("deck-contents")).toBe("none");
    expect(refetchTypeOf("notes")).toBe("none");
  });

  it("does refetch the cheap screens a learner sees next", () => {
    // Undefined = the default, which refetches whatever is mounted.
    expect(refetchTypeOf("streak")).toBeUndefined();
    expect(refetchTypeOf("deck-stats")).toBeUndefined();
    expect(refetchTypeOf("deck-stats-history")).toBeUndefined();
  });
});
