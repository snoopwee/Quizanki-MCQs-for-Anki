import { describe, expect, it } from "vitest";
import { parseDeck } from "@/lib/parseDeck";

describe("parseDeck", () => {
  it("parses basic tab-separated rows into positional fields", () => {
    const result = parseDeck("食べる\tto eat\n飲む\tto drink");
    expect(result.fieldNames).toEqual(["Field 1", "Field 2"]);
    expect(result.notes).toHaveLength(2);
    expect(result.notes[0].fields).toEqual({ "Field 1": "食べる", "Field 2": "to eat" });
  });

  it("strips a leading BOM", () => {
    const result = parseDeck("﻿hello\tworld");
    expect(result.notes[0].fields["Field 1"]).toBe("hello");
  });

  it("normalizes Windows CRLF line endings", () => {
    const result = parseDeck("a\tb\r\nc\td");
    expect(result.notes).toHaveLength(2);
    expect(result.notes[1].fields).toEqual({ "Field 1": "c", "Field 2": "d" });
  });

  it("keeps separators inside quoted fields", () => {
    const result = parseDeck('"hello\tworld"\tback');
    expect(result.notes[0].fields["Field 1"]).toBe("hello\tworld");
    expect(result.notes[0].fields["Field 2"]).toBe("back");
  });

  it("unescapes doubled quotes inside quoted fields", () => {
    const result = parseDeck('"she said ""hi"""\tanswer');
    expect(result.notes[0].fields["Field 1"]).toBe('she said "hi"');
  });

  it("strips [sound:] tags and HTML, and decodes entities", () => {
    const result = parseDeck("<b>食べる</b>[sound:eat.mp3]\tto eat &amp; drink");
    expect(result.notes[0].fields["Field 1"]).toBe("食べる");
    expect(result.notes[0].fields["Field 2"]).toBe("to eat & drink");
  });

  it("honors a #separator header word", () => {
    const result = parseDeck("#separator:comma\napple,fruit");
    expect(result.notes[0].fields).toEqual({ "Field 1": "apple", "Field 2": "fruit" });
  });

  it("extracts tags from the declared tags column", () => {
    const result = parseDeck("#separator:tab\n#tags column:3\n食べる\tto eat\tn4 verb");
    expect(result.fieldNames).toEqual(["Field 1", "Field 2"]);
    expect(result.notes[0].fields).toEqual({ "Field 1": "食べる", "Field 2": "to eat" });
    expect(result.notes[0].tags).toEqual(["n4", "verb"]);
  });

  it("drops rows with fewer than two non-empty fields", () => {
    const result = parseDeck("only-one-field\n\nreal\trow");
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].fields["Field 1"]).toBe("real");
  });
});
