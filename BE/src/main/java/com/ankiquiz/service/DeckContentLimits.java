package com.ankiquiz.service;

import com.ankiquiz.exception.ApkgParseException;

import java.util.Collection;
import java.util.Map;

/**
 * What a deck write may contain. Shared so the editor save and the import/clone path cannot drift.
 *
 * <p><b>Why these exist.</b> {@code replaceDeckContents} capped the note COUNT; {@code persistImport}
 * computed {@code totalNotes} and never compared it to anything, so {@code POST /decks} would take
 * as many notes as a caller cared to send. And neither path bounded a note's CONTENT, while
 * {@code ApkgParserService.MAX_NOTES} justifies 5,000 on the basis that "each parsed note is ~1–3 KB
 * of JSON" — an assumption nothing enforced.
 *
 * <p><b>What actually defends the heap is {@code RequestSizeLimitFilter}</b>, which caps the request
 * body itself. These limits are not a second memory bound and should not be read as one: 5,000 notes
 * at {@link #MAX_NOTE_CHARS} would be far more than the instance could hold, and it is the byte cap
 * that makes that unreachable. What these add is sanity — one card with a megabyte in a single field
 * is not a flashcard, it is something that will not render — and a count bound on the import path
 * that was simply missing.
 *
 * <p><b>The numbers are set from production data, not from taste</b> (measured 2026-10-05 over
 * 18,670 live notes): the longest single field in use is 6,582 characters, the largest note totals
 * 6,816, the most fields on one note is 21, and the biggest deck is 3,787 cards. Every limit below
 * sits several times above its observed maximum, because these run on SAVE — a ceiling close to real
 * content would start refusing decks that already exist the next time somebody edited one.
 */
final class DeckContentLimits {

    private DeckContentLimits() {
    }

    /** Matches {@code ApkgParserService.MAX_NOTES} — the parse step and the save step agree. */
    static final int MAX_NOTES = 5_000;

    /** One field's value. Observed max 6,582. */
    static final int MAX_FIELD_CHARS = 32_000;

    /** All of one note's values together. Observed max 6,816. */
    static final int MAX_NOTE_CHARS = 64_000;

    /** Fields on a single note. Observed max 21 (an Anki note type can be wide). */
    static final int MAX_FIELDS_PER_NOTE = 100;

    /**
     * Bounds the number of notes in one write.
     *
     * @throws ApkgParseException (a 400) when there are too many
     */
    static void checkNoteCount(int notes) {
        if (notes > MAX_NOTES) {
            throw new ApkgParseException(
                    "Too many cards (max " + MAX_NOTES + "). Split this into smaller decks.");
        }
    }

    /**
     * Bounds every note's field map. Reports the card's 1-based position, because "card 2,841 is
     * too long" is actionable and "a card is too long" is not.
     *
     * @param fieldMaps one entry per note, in the order the caller sent them
     */
    static void checkFields(Collection<Map<String, String>> fieldMaps) {
        int position = 0;
        for (Map<String, String> fields : fieldMaps) {
            position++;
            if (fields == null) {
                continue;
            }
            if (fields.size() > MAX_FIELDS_PER_NOTE) {
                throw new ApkgParseException("Card " + position + " has too many fields (max "
                        + MAX_FIELDS_PER_NOTE + ").");
            }
            long total = 0;
            for (Map.Entry<String, String> field : fields.entrySet()) {
                String value = field.getValue();
                if (value == null) {
                    continue;
                }
                if (value.length() > MAX_FIELD_CHARS) {
                    throw new ApkgParseException("Card " + position + ", field \"" + field.getKey()
                            + "\" is too long (max " + MAX_FIELD_CHARS + " characters).");
                }
                total += value.length();
            }
            if (total > MAX_NOTE_CHARS) {
                throw new ApkgParseException("Card " + position + " is too long (max "
                        + MAX_NOTE_CHARS + " characters across all its fields).");
            }
        }
    }
}
