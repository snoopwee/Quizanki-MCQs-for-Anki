import { describe, expect, it } from "vitest";
import { parsePlainText } from "@/lib/parsePlainText";

describe("parsePlainText", () => {
  it("splits tab-separated lines into front/back", () => {
    const pairs = parsePlainText("食べる\tto eat\n飲む\tto drink", {
      termDelimiter: "\t",
      rowDelimiter: "\n",
    });
    expect(pairs).toEqual([
      { front: "食べる", back: "to eat" },
      { front: "飲む", back: "to drink" },
    ]);
  });

  it("supports comma term + semicolon row delimiters", () => {
    const pairs = parsePlainText("a,1;b,2", { termDelimiter: ",", rowDelimiter: ";" });
    expect(pairs).toEqual([
      { front: "a", back: "1" },
      { front: "b", back: "2" },
    ]);
  });

  it("interprets escape sequences typed in custom boxes", () => {
    // The pasted text has real blank lines; the user typed "\n\n" in the row box.
    const pairs = parsePlainText("a-1\n\nb-2", { termDelimiter: "-", rowDelimiter: "\\n\\n" });
    expect(pairs).toEqual([
      { front: "a", back: "1" },
      { front: "b", back: "2" },
    ]);
  });

  it("keeps only the first term delimiter as the split point", () => {
    const pairs = parsePlainText("term\tdef, with, commas", { termDelimiter: "\t", rowDelimiter: "\n" });
    expect(pairs).toEqual([{ front: "term", back: "def, with, commas" }]);
  });

  it("skips blank rows and tolerates a missing definition", () => {
    const pairs = parsePlainText("solo\n\n  \nfront\tback", { termDelimiter: "\t", rowDelimiter: "\n" });
    expect(pairs).toEqual([
      { front: "solo", back: "" },
      { front: "front", back: "back" },
    ]);
  });
});
