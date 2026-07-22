import { Fragment } from "react";
import { parseFurigana } from "@/lib/furigana";
import { stripLatex } from "@/lib/displayText";

// Renders a deck field value for display: inline furigana (`漢字[かな]`) becomes real
// <ruby>, and LaTeX spans collapse to a [math] placeholder. Display-only — speech,
// grading, and search use the plain-text helpers (stripFurigana / stripLatex), so
// this never affects which answer counts as correct.
export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseFurigana(text).map((seg, i) =>
        seg.reading ? (
          <ruby key={i}>
            {stripLatex(seg.base)}
            <rt>{seg.reading}</rt>
          </ruby>
        ) : (
          <Fragment key={i}>{stripLatex(seg.base)}</Fragment>
        ),
      )}
    </>
  );
}
