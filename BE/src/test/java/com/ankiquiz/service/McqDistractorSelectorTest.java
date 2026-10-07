package com.ankiquiz.service;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * W3 — distractor selection.
 *
 * <p>These assert the things that make an exported card worth answering, not just that it comes back
 * populated. A card with three wrong answers is easy to produce; a card whose wrong answers are
 * genuinely confusable is the whole point.
 */
class McqDistractorSelectorTest {

    private static final String Q = "Mitochondria";
    private static final String CORRECT = "The organelle that performs aerobic respiration";

    private static List<String> pool(String... values) {
        return List.of(values);
    }

    private static McqDistractorSelector.Result select(String correct, List<String> sameType) {
        return McqDistractorSelector.select(Q, correct, sameType, List.of(), "seed-1");
    }

    // ── the basics ───────────────────────────────────────────────────────────

    @Test
    void picksWrongAnswersFromTheDeckAndNeverTheRightOne() {
        var result = select(CORRECT, pool(CORRECT,
                "The process converting CO2 and water into glucose",
                "A reactant in photosynthesis used by the plant",
                "The site where gas exchange takes place in leaves",
                "The pigment that absorbs light for photosynthesis"));

        assertThat(result.usable()).isTrue();
        assertThat(result.distractors()).hasSize(4).doesNotContain(CORRECT);
    }

    @Test
    void bakesMoreDistractorsThanThereAreOptionSlots() {
        // Four slots, seven baked: the template draws a fresh subset per review, which is what
        // keeps a written-once package from feeling static.
        List<String> many = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            many.add("A plausible answer of roughly similar length number " + i);
        }

        var result = select(CORRECT, many);

        assertThat(result.distractors()).hasSize(McqDistractorSelector.BAKED_DISTRACTORS);
        assertThat(McqDistractorSelector.BAKED_DISTRACTORS).isGreaterThan(3);
    }

    @Test
    void theSameTypePoolIsPreferredAndTheDeckOnlyPadsIt() {
        List<String> sameType = pool("Same-type answer one", "Same-type answer two");
        List<String> global = pool("Global answer one", "Global answer two", "Global answer three");

        var result = McqDistractorSelector.select(Q, CORRECT, sameType, global, "seed-1");

        // Both same-type answers are present; the global pool only fills what is left.
        assertThat(result.distractors()).contains("Same-type answer one", "Same-type answer two");
        assertThat(result.distractors()).hasSize(5);
    }

    // ── the rules that stop a card giving itself away ────────────────────────

    @Test
    void anAnswerThatContainsTheCorrectOneIsNotOffered() {
        // "…aerobic respiration" vs "…aerobic respiration in the mitochondria" is not a choice
        // between right and wrong, it is two readings of the same answer.
        var result = select(CORRECT, pool(
                CORRECT + " in the mitochondria",
                "The process converting CO2 and water into glucose",
                "A reactant in photosynthesis used by the plant",
                "The site where gas exchange takes place in leaves"));

        assertThat(result.distractors()).noneMatch(d -> d.contains(CORRECT));
        assertThat(result.distractors()).hasSize(3);
    }

    @Test
    void anAnswerContainedInTheCorrectOneIsNotOfferedEither() {
        var result = select("aerobic respiration in the mitochondria", pool(
                "aerobic respiration",
                "The process converting CO2 and water into glucose",
                "A reactant in photosynthesis used by the plant",
                "The site where gas exchange takes place in leaves"));

        assertThat(result.distractors()).doesNotContain("aerobic respiration");
    }

    @Test
    void theSameAnswerInDifferentMarkupIsOnlyOfferedOnce() {
        // Otherwise the learner sees the answer twice and neither showing is wrong.
        var result = select("Paris", pool(
                "<b>Paris</b>", "Paris", "PARIS",
                "Lyon", "Marseille", "Toulouse", "Bordeaux"));

        List<String> normalised = result.distractors().stream()
                .map(McqDistractorSelector::normalise).toList();
        assertThat(normalised).doesNotHaveDuplicates();
        assertThat(normalised).doesNotContain("paris");
    }

    @Test
    void candidatesClosestInLengthToTheAnswerArePreferred() {
        // The oldest multiple-choice tell: the long detailed option is the correct one.
        String correct = "A medium length answer here";
        var result = select(correct, pool(
                "x",
                "An answer of a very similar length",
                "Another answer about this long!!",
                "A spectacularly long-winded answer that rambles on well beyond anything else "
                        + "offered on this card and is therefore obviously not the one"));

        // The two comparable answers outrank the one-character and the essay.
        assertThat(result.distractors().get(0).length())
                .isCloseTo(correct.length(), org.assertj.core.data.Offset.offset(10));
        assertThat(result.distractors().indexOf("x")).isGreaterThan(0);
    }

    @Test
    void aLengthOutlierIsRankedLastRatherThanDiscarded() {
        // Ranking, not filtering: a hard length rule would skip cards in decks whose answers are
        // naturally uneven, and a skipped card helps nobody.
        var result = select("A medium length answer here", pool(
                "x", "yy", "zzz"));

        assertThat(result.usable()).isTrue();
        assertThat(result.distractors()).containsExactlyInAnyOrder("x", "yy", "zzz");
    }

    // ── skipping, and saying why ─────────────────────────────────────────────

    @Test
    void aNoteWithTooFewUsableWrongAnswersIsSkippedWithAReason() {
        var result = select(CORRECT, pool(CORRECT, "Only one other answer"));

        assertThat(result.usable()).isFalse();
        assertThat(result.rejection())
                .isEqualTo(McqDistractorSelector.Rejection.TOO_FEW_DISTRACTORS);
        assertThat(result.distractors()).isEmpty();
    }

    @Test
    void twoWrongAnswersIsNotEnoughBecauseThatIsNearlyACoinFlip() {
        var result = select(CORRECT, pool("Wrong one here", "Wrong two here"));

        assertThat(result.usable()).isFalse();
        assertThat(McqDistractorSelector.MIN_DISTRACTORS).isEqualTo(3);
    }

    @Test
    void aNoteWithNothingToAskIsSkipped() {
        var blankQuestion = McqDistractorSelector.select(
                "  ", CORRECT, pool("a", "b", "c", "d"), List.of(), "s");
        assertThat(blankQuestion.rejection()).isEqualTo(McqDistractorSelector.Rejection.NO_QUESTION);

        var blankAnswer = McqDistractorSelector.select(
                Q, "", pool("a", "b", "c", "d"), List.of(), "s");
        assertThat(blankAnswer.rejection()).isEqualTo(McqDistractorSelector.Rejection.NO_ANSWER);
    }

    @Test
    void markupOnlyContentCountsAsBlankNotAsAnAnswer() {
        // An empty rich-text field arrives as tags, not as an empty string.
        var result = McqDistractorSelector.select(Q, "<br>", pool("a", "b", "c"), List.of(), "s");

        assertThat(result.rejection()).isEqualTo(McqDistractorSelector.Rejection.NO_ANSWER);
    }

    // ── determinism: what makes a re-export a no-op ──────────────────────────

    @Test
    void theSameNoteAlwaysGetsTheSameDistractors() {
        // Paired with the stable note guid, this is what makes re-exporting an unchanged deck
        // update nothing. Random selection would rewrite every card in the user's collection.
        List<String> deck = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            deck.add("Answer number " + i + " of similar length");
        }

        var first = McqDistractorSelector.select(Q, CORRECT, deck, List.of(), "note-guid-1");
        var second = McqDistractorSelector.select(Q, CORRECT, deck, List.of(), "note-guid-1");

        assertThat(second.distractors()).isEqualTo(first.distractors());
    }

    @Test
    void differentNotesDrawDifferentSetsFromTheSamePool() {
        // Determinism must not collapse into every card showing the same wrong answers.
        List<String> deck = new ArrayList<>();
        for (int i = 0; i < 40; i++) {
            deck.add("Answer " + i);
        }

        var a = McqDistractorSelector.select(Q, "Answer 0", deck, List.of(), "guid-a");
        var b = McqDistractorSelector.select(Q, "Answer 0", deck, List.of(), "guid-b");

        assertThat(b.distractors()).isNotEqualTo(a.distractors());
    }

    // ── normalisation ────────────────────────────────────────────────────────

    @Test
    void normalisationStripsWhatAnkiWouldRender() {
        assertThat(McqDistractorSelector.normalise("<b>Hello</b>  world")).isEqualTo("hello world");
        assertThat(McqDistractorSelector.normalise("cat[sound:cat.mp3]")).isEqualTo("cat");
        assertThat(McqDistractorSelector.normalise("<img src=x.png> dog")).isEqualTo("dog");
        assertThat(McqDistractorSelector.normalise("a&nbsp;b")).isEqualTo("a b");
        assertThat(McqDistractorSelector.normalise(null)).isEmpty();
    }

    @Test
    void anImageOnlyAnswerIsNotAUsableTextOption() {
        // It would render as an empty button. W4 handles media properly; until then it is skipped.
        var result = McqDistractorSelector.select(Q, "<img src='answer.png'>",
                pool("a", "b", "c"), List.of(), "s");

        assertThat(result.rejection()).isEqualTo(McqDistractorSelector.Rejection.NO_ANSWER);
    }

    // ── real production content ──────────────────────────────────────────────

    /**
     * Fourteen real cards from the production "Cell Biology" deck.
     *
     * <p>Synthetic cases prove the rules fire; only real content shows whether the result is a card
     * worth answering. This deck is deliberately awkward: answers run from two words ("Requires
     * Oxygen") to a full sentence, and several genuinely overlap in subject matter.
     */
    private static final String[][] CELL_BIOLOGY = {
            {"Ribosome", "The organelle that assembles proteins from amino acids."},
            {"Photosynthesis", "The process in which light energy is used to convert Carbon dioxide and Water into Glucose and Oxygen."},
            {"Respiration", "The process in which sugar and oxygen react to produce Carbon dioxide, Water, and ATP (energy)."},
            {"Golgi apparatus", "Packages and sorts proteins for transport out of the cell."},
            {"Lysosome", "Contains digestive enzymes that break down waste and worn-out organelles."},
            {"Aerobic", "Requires Oxygen"},
            {"Anaerobic", "Without Oxygen"},
            {"Nucleolus", "The region inside the nucleus where ribosomes are assembled."},
            {"Cytoskeleton", "A network of protein filaments that gives the cell shape and enables movement."},
            {"Lactic Acid", "A waste product of anaerobic respiration that builds up and causes fatigue."},
            {"Water", "A reactant in photosynthesis. Also, a waste product of aerobic respiration."},
            {"Glucose", "A product of photosynthesis containing the stored chemical energy. A reactant of all types of respiration."},
            {"Oxygen", "A waste product of photosynthesis. A reactant of aerobic respiration."},
            {"Light", "The energy source for photosynthesis."},
    };

    @Test
    void everyCardInARealDeckBecomesAnAnswerableQuestion() {
        List<String> answers = new ArrayList<>();
        for (String[] row : CELL_BIOLOGY) {
            answers.add(row[1]);
        }

        for (String[] row : CELL_BIOLOGY) {
            var result = McqDistractorSelector.select(row[0], row[1], answers, List.of(), row[0]);

            assertThat(result.usable())
                    .withFailMessage("'%s' could not be exported", row[0]).isTrue();
            assertThat(result.distractors())
                    .withFailMessage("'%s' got too few options", row[0])
                    .hasSizeGreaterThanOrEqualTo(McqDistractorSelector.MIN_DISTRACTORS);
            // The answer must never appear among the wrong answers, in any form.
            assertThat(result.distractors().stream().map(McqDistractorSelector::normalise))
                    .doesNotContain(McqDistractorSelector.normalise(row[1]));
        }
    }

    @Test
    void aShortAnswerDrawsTheOtherShortAnswersInTheDeck() {
        // "Requires Oxygen" sits in a deck of long definitions. Its best distractor is the other
        // short one — pairing it with a 100-character sentence would give the game away.
        List<String> answers = new ArrayList<>();
        for (String[] row : CELL_BIOLOGY) {
            answers.add(row[1]);
        }

        var result = McqDistractorSelector.select("Aerobic", "Requires Oxygen", answers, List.of(), "Aerobic");

        assertThat(result.distractors().get(0)).isEqualTo("Without Oxygen");
    }
}
