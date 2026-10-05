package com.ankiquiz.service;

import com.ankiquiz.exception.ApkgParseException;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The limits on a deck write.
 *
 * <p>These cover the two gaps found 2026-10-05: {@code persistImport} counted its notes and never
 * checked the total, and neither write path bounded a note's content at all.
 */
class DeckContentLimitsTest {

    private static Map<String, String> note(String... values) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i++) {
            fields.put("Field" + i, values[i]);
        }
        return fields;
    }

    // ── count ────────────────────────────────────────────────────────────────

    @Test
    void theNoteCountCeilingIsInclusive() {
        assertThatCode(() -> DeckContentLimits.checkNoteCount(DeckContentLimits.MAX_NOTES))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> DeckContentLimits.checkNoteCount(DeckContentLimits.MAX_NOTES + 1))
                .isInstanceOf(ApkgParseException.class)
                .hasMessageContaining("Too many cards");
    }

    @Test
    void theCeilingMatchesTheParserSoBothStepsAgree() {
        // A deck the parse endpoint accepts must not then be refused on save.
        assertThat(DeckContentLimits.MAX_NOTES).isEqualTo(ApkgParserService.MAX_NOTES);
    }

    // ── content ──────────────────────────────────────────────────────────────

    @Test
    void aFieldLongerThanTheCapIsRefusedAndNamesTheCardAndField() {
        String tooLong = "x".repeat(DeckContentLimits.MAX_FIELD_CHARS + 1);
        List<Map<String, String>> notes = List.of(note("fine"), note("also fine"), note(tooLong));

        assertThatThrownBy(() -> DeckContentLimits.checkFields(notes))
                .isInstanceOf(ApkgParseException.class)
                // 1-based, so the message matches what the editor shows the user.
                .hasMessageContaining("Card 3")
                .hasMessageContaining("Field0")
                .hasMessageContaining("too long");
    }

    @Test
    void manyFieldsThatAreEachFineCanStillBeTooMuchForOneNote() {
        // Each value is inside MAX_FIELD_CHARS; the note's total is not.
        int per = DeckContentLimits.MAX_FIELD_CHARS;
        int count = (DeckContentLimits.MAX_NOTE_CHARS / per) + 2;
        String[] values = IntStream.range(0, count).mapToObj(i -> "y".repeat(per)).toArray(String[]::new);

        assertThatThrownBy(() -> DeckContentLimits.checkFields(List.of(note(values))))
                .isInstanceOf(ApkgParseException.class)
                .hasMessageContaining("Card 1")
                .hasMessageContaining("across all its fields");
    }

    @Test
    void tooManyFieldsOnOneNoteIsRefused() {
        String[] values = IntStream.range(0, DeckContentLimits.MAX_FIELDS_PER_NOTE + 1)
                .mapToObj(i -> "v").toArray(String[]::new);

        assertThatThrownBy(() -> DeckContentLimits.checkFields(List.of(note(values))))
                .isInstanceOf(ApkgParseException.class)
                .hasMessageContaining("too many fields");
    }

    @Test
    void aNullFieldValueIsNotCountedAndDoesNotBlowUp() {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("Front", null);
        fields.put("Back", "present");

        assertThatCode(() -> DeckContentLimits.checkFields(List.of(fields)))
                .doesNotThrowAnyException();
    }

    @Test
    void aNullFieldMapIsSkippedRatherThanRefused() {
        // Bean Validation already requires @NotEmpty fields; this must not be the thing that 500s.
        assertThatCode(() -> DeckContentLimits.checkFields(java.util.Collections.singletonList(null)))
                .doesNotThrowAnyException();
    }

    // ── the limits must not refuse decks that already exist ──────────────────

    @Test
    void theLargestContentMeasuredInProductionPassesComfortably() {
        // Measured 2026-10-05 over 18,670 live notes: longest single field 6,582 characters,
        // largest note 6,816 across 21 fields. These limits run on SAVE, so anything at or near
        // real content would start refusing decks on their next edit.
        String longestReal = "z".repeat(6_582);
        Map<String, String> widestReal = new LinkedHashMap<>();
        for (int i = 0; i < 21; i++) {
            widestReal.put("Field" + i, "z".repeat(6_816 / 21));
        }

        assertThatCode(() -> DeckContentLimits.checkFields(List.of(note(longestReal), widestReal)))
                .doesNotThrowAnyException();

        assertThat(DeckContentLimits.MAX_FIELD_CHARS).isGreaterThan(4 * 6_582);
        assertThat(DeckContentLimits.MAX_NOTE_CHARS).isGreaterThan(4 * 6_816);
        assertThat(DeckContentLimits.MAX_FIELDS_PER_NOTE).isGreaterThan(4 * 21);
    }

    @Test
    void anOrdinaryDeckOfRealisticCardsIsAccepted() {
        List<Map<String, String>> deck = IntStream.range(0, 1_000)
                .mapToObj(i -> note("Term " + i, "A definition of roughly the usual length for card " + i))
                .collect(Collectors.toList());

        assertThatCode(() -> {
            DeckContentLimits.checkNoteCount(deck.size());
            DeckContentLimits.checkFields(deck);
        }).doesNotThrowAnyException();
    }
}
