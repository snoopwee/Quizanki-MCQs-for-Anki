// Heuristic detector that guesses which field is the question and which is the
// answer for a parsed deck. Returns a confidence in [0, 1]; callers should show a
// manual field picker when confidence < 0.7.

import type { ParsedNote } from "@/lib/parseDeck";

export interface FieldDetection {
  questionField: string;
  answerField: string;
  confidence: number;
}

// Scripts that strongly signal a "foreign" prompt for language decks.
const FOREIGN_RANGES = [
  /[一-鿿]/, // CJK ideographs
  /[぀-ゟ]/, // Hiragana
  /[゠-ヿ]/, // Katakana
  /[가-힯]/, // Hangul
  /[؀-ۿ]/, // Arabic
  /[Ѐ-ӿ]/, // Cyrillic
];

function foreignRatio(value: string): number {
  const chars = value.replace(/\s/g, "");
  if (chars.length === 0) return 0;
  let foreign = 0;
  for (const ch of chars) {
    if (FOREIGN_RANGES.some((re) => re.test(ch))) foreign++;
  }
  return foreign / chars.length;
}

interface FieldSignals {
  avgForeignRatio: number;
  uniqueness: number;
  avgLength: number;
  lengthStdDev: number;
  emptyRatio: number;
}

function computeSignals(values: string[]): FieldSignals {
  const total = values.length;
  const nonEmpty = values.filter((v) => v.length > 0);
  const distinct = new Set(nonEmpty).size;

  const lengths = nonEmpty.map((v) => v.length);
  const avgLength = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const variance = lengths.length
    ? lengths.reduce((a, b) => a + (b - avgLength) ** 2, 0) / lengths.length
    : 0;

  const avgForeignRatio = nonEmpty.length
    ? nonEmpty.reduce((a, v) => a + foreignRatio(v), 0) / nonEmpty.length
    : 0;

  return {
    avgForeignRatio,
    uniqueness: nonEmpty.length ? distinct / nonEmpty.length : 0,
    avgLength,
    lengthStdDev: Math.sqrt(variance),
    emptyRatio: total ? (total - nonEmpty.length) / total : 1,
  };
}

interface FieldScore {
  name: string;
  questionScore: number;
  answerScore: number;
}

function scoreField(name: string, index: number, signals: FieldSignals): FieldScore {
  let questionScore = 0;
  let answerScore = 0;

  // Mostly-empty fields (e.g. media-only) are poor for both roles.
  if (signals.emptyRatio > 0.5) {
    return { name, questionScore: -999, answerScore: -999 };
  }

  if (signals.avgForeignRatio > 0.8) {
    questionScore += 4;
    answerScore -= 2;
  }
  if (signals.uniqueness > 0.95) {
    answerScore += 3;
  }
  if (signals.avgLength < 40 && signals.lengthStdDev < 25) {
    answerScore += 2;
  }
  // Position bias: first field tends to be the prompt, second the answer.
  if (index === 0) questionScore += 1;
  if (index === 1) answerScore += 1;

  return { name, questionScore, answerScore };
}

// Fields worth offering as a quiz question/answer. Hides "metadata" fields that
// make poor multiple-choice material: mostly-empty fields, single-value fields,
// and low-cardinality categorical fields (e.g. "JLPT Level", "Jouyou Grade").
// Picking those would pair an irrelevant prompt with an answer and collapse the
// distractor pool to a few repeated values.
export function selectableFields(notes: ParsedNote[], fieldNames: string[]): string[] {
  return fieldNames.filter((name) => {
    const values = notes.map((n) => n.fields[name] ?? "");
    const nonEmpty = values.filter((v) => v.length > 0);
    if (nonEmpty.length === 0) return false;
    if ((values.length - nonEmpty.length) / values.length > 0.5) return false;

    const distinct = new Set(nonEmpty).size;
    if (distinct < 2) return false;
    // With enough data, very few distinct values means categorical metadata,
    // not quiz content (e.g. 3787 notes but only 5 distinct "JLPT Level"s).
    if (nonEmpty.length >= 20 && distinct <= 10) return false;
    return true;
  });
}

export function detectFields(notes: ParsedNote[], fieldNames: string[]): FieldDetection {
  if (fieldNames.length === 0) {
    return { questionField: "", answerField: "", confidence: 0 };
  }
  if (fieldNames.length === 1) {
    return { questionField: fieldNames[0], answerField: fieldNames[0], confidence: 0 };
  }

  const scores = fieldNames.map((name, index) =>
    scoreField(name, index, computeSignals(notes.map((n) => n.fields[name] ?? ""))),
  );

  const byQuestion = [...scores].sort((a, b) => b.questionScore - a.questionScore);
  const questionField = byQuestion[0].name;

  const byAnswer = [...scores]
    .filter((s) => s.name !== questionField)
    .sort((a, b) => b.answerScore - a.answerScore);
  const answerField = byAnswer[0].name;

  const qWinner = byQuestion[0].questionScore;
  const aWinner = byAnswer[0].answerScore;
  const qConf = qWinner <= 0 ? 0.3 : Math.min(1, qWinner / 6);
  const aConf = aWinner <= 0 ? 0.3 : Math.min(1, aWinner / 6);
  const confidence = Math.round(((qConf + aConf) / 2) * 100) / 100;

  return { questionField, answerField, confidence };
}
