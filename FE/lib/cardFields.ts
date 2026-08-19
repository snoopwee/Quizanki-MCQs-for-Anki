// Pure helpers for the "show / hide extra fields" control (deck + edit pages).
//
// A card's Term (front) and Definition (back) primary fields are kept as detected;
// every OTHER imported field can be toggled on/off. A shown extra rides on the
// definition (back) side as supporting context — the Anki / Quizlet convention and
// exactly how buildFlashcards bundles multiple back fields. The term is left as-is.

// The primary definition field — the first back field. Undefined only for the odd
// deck that imported with no back fields at all.
export function primaryDefinition(backFields: string[]): string | undefined {
  return backFields[0];
}

// Fields that aren't the term or the primary definition — each is toggleable.
export function extraFields(
  fieldNames: string[],
  frontFields: string[],
  backFields: string[],
): string[] {
  const front = new Set(frontFields);
  const primaryDef = primaryDefinition(backFields);
  return fieldNames.filter((f) => !front.has(f) && f !== primaryDef);
}

// Whether an extra field is currently shown (i.e. present on the back side).
export function isFieldShown(field: string, backFields: string[]): boolean {
  return backFields.includes(field);
}

// True when at least one (non-cloze) note type has a field the user could toggle —
// lets callers hide the whole control for single-field / cloze-only decks.
export function hasExtraFields(
  noteTypes: {
    fieldNames: string[];
    frontFields: string[];
    backFields: string[];
    cloze?: boolean;
  }[],
): boolean {
  return noteTypes.some(
    (nt) => !nt.cloze && extraFields(nt.fieldNames, nt.frontFields, nt.backFields).length > 0,
  );
}

// The new front/back selection after toggling one extra field on or off. Front is
// untouched; back is rebuilt as [primaryDefinition, ...shown extras] in fieldNames
// order so the card reads consistently regardless of toggle order.
export function withExtraField(
  field: string,
  fieldNames: string[],
  frontFields: string[],
  backFields: string[],
  show: boolean,
): { frontFields: string[]; backFields: string[] } {
  const front = new Set(frontFields);
  const primaryDef = primaryDefinition(backFields);
  // Extras currently shown = back fields after the primary definition.
  const shown = new Set(backFields.filter((f) => f !== primaryDef));
  if (show) shown.add(field);
  else shown.delete(field);
  const orderedExtras = fieldNames.filter(
    (f) => !front.has(f) && f !== primaryDef && shown.has(f),
  );
  const nextBack = primaryDef ? [primaryDef, ...orderedExtras] : orderedExtras;
  return { frontFields, backFields: nextBack };
}
