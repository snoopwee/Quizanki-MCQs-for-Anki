package com.ankiquiz.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.Set;

/**
 * Chooses the wrong answers for an exported multiple-choice card.
 *
 * <p><b>This is the feature.</b> A deck of MCQs whose distractors give themselves away is worse than
 * no export at all — the learner drills pattern-spotting instead of recall, and does it inside their
 * real Anki collection where the damage persists.
 *
 * <h2>Relationship to the web quiz</h2>
 *
 * <p>The sibling is {@code FE/lib/buildQuestions.ts:pickDistractors}, and its rules are reproduced
 * here: prefer answers from the same note type (semantically closer to the correct one), pad from the
 * whole deck when that pool is too small, deduplicate, and never offer the correct answer twice.
 *
 * <p>It is a <b>port, not a shared implementation</b>, because that one is TypeScript running in the
 * browser and this is Java running at export time. Two copies of a rule can drift, so the intent is
 * recorded here rather than left to be inferred: <i>if the selection rule changes on either side,
 * change it on both.</i>
 *
 * <h2>Where it deliberately goes further</h2>
 *
 * <p>The web quiz reshuffles on every attempt, so a weak distractor is gone next time. An export is
 * written once and reviewed for months, so the same options come back repeatedly — which justifies
 * being choosier here than the live quiz is:
 *
 * <ul>
 *   <li><b>Containment is rejected.</b> If the correct answer and a candidate contain one another,
 *       the candidate is often defensible as correct too. The web version does not do this yet (the
 *       roadmap has it as an open item for the quiz).</li>
 *   <li><b>Plausibility is ranked, not filtered.</b> The oldest multiple-choice tell is that the
 *       correct answer is the long, detailed one. Candidates closest in length to the correct answer
 *       are preferred — but ranked rather than excluded, because a hard length filter would discard
 *       notes in a deck with naturally varied answers, and a skipped card helps nobody.</li>
 *   <li><b>Selection is deterministic per note.</b> Seeded from the note's own guid, so re-exporting
 *       an unchanged deck produces byte-identical choices. Paired with the stable guid in
 *       {@link ApkgWriterService}, that means a re-export updates nothing the user did not change.
 *       Random selection would rewrite every card in their collection on every export.</li>
 * </ul>
 *
 * <p><b>No AI.</b> Standing decision (2026-05-12, Decisions Log). A sibling answer from the same deck
 * is wrong in a way the learner must actually discriminate; a generated one is plausible-looking and
 * unverifiable, and would be charged per card.
 */
final class McqDistractorSelector {

    /**
     * How many wrong answers to bake per card.
     *
     * <p>More than the four option slots on purpose: the card template draws a fresh subset on every
     * review, so a bigger baked pool is what stops a static package feeling static.
     */
    static final int BAKED_DISTRACTORS = 7;

    /**
     * Below this a note is skipped rather than exported.
     *
     * <p>Three fills a four-option card. A card offering one wrong answer is a coin flip, and it
     * would sit in the learner's collection forever being easy — worse than the card not existing.
     */
    static final int MIN_DISTRACTORS = 3;

    private McqDistractorSelector() {
    }

    /** Why a note could not become a multiple-choice card. */
    enum Rejection {
        /** No question text to ask. */
        NO_QUESTION,
        /** No answer to be right. */
        NO_ANSWER,
        /** The deck could not supply {@link #MIN_DISTRACTORS} usable wrong answers. */
        TOO_FEW_DISTRACTORS
    }

    /**
     * The outcome for one note: either the chosen distractors, or the reason it was skipped.
     *
     * <p>A reason rather than a bare empty list, because the export screen has to tell the user what
     * did not make it and why — a silent partial export is the kind of thing that quietly erodes
     * trust in the whole feature.
     */
    record Result(List<String> distractors, Rejection rejection) {

        static Result of(List<String> distractors) {
            return new Result(List.copyOf(distractors), null);
        }

        static Result rejected(Rejection reason) {
            return new Result(List.of(), reason);
        }

        boolean usable() {
            return rejection == null;
        }
    }

    /**
     * Picks distractors for one card.
     *
     * @param correct      the right answer, as it will be shown
     * @param sameTypePool every answer from notes sharing this note's type, correct one included
     * @param globalPool   every answer in the deck, used only when the same-type pool runs short
     * @param seed         stable per note (its guid) so the result is reproducible
     */
    static Result select(String question, String correct,
                         List<String> sameTypePool, List<String> globalPool, String seed) {
        if (isBlank(question)) {
            return Result.rejected(Rejection.NO_QUESTION);
        }
        if (isBlank(correct)) {
            return Result.rejected(Rejection.NO_ANSWER);
        }

        String correctKey = normalise(correct);
        Set<String> taken = new LinkedHashSet<>();
        taken.add(correctKey);

        // Same-type answers first: they are about the same kind of thing, which is what makes a
        // wrong answer worth considering rather than obviously absurd.
        List<String> chosen = new ArrayList<>(
                rank(correct, correctKey, sameTypePool, taken, seed));

        if (chosen.size() < BAKED_DISTRACTORS) {
            chosen.addAll(rank(correct, correctKey, globalPool, taken, seed));
        }

        if (chosen.size() < MIN_DISTRACTORS) {
            return Result.rejected(Rejection.TOO_FEW_DISTRACTORS);
        }
        return Result.of(chosen.subList(0, Math.min(BAKED_DISTRACTORS, chosen.size())));
    }

    /**
     * Filters a pool down to usable candidates and orders them by plausibility.
     *
     * <p>{@code taken} is carried across calls so the global pool cannot re-offer something the
     * same-type pool already contributed.
     */
    private static List<String> rank(String correct, String correctKey, List<String> pool,
                                     Set<String> taken, String seed) {
        if (pool == null || pool.isEmpty()) {
            return List.of();
        }

        List<String> candidates = new ArrayList<>();
        for (String candidate : pool) {
            if (isBlank(candidate)) {
                continue;
            }
            String key = normalise(candidate);
            if (key.isEmpty() || taken.contains(key)) {
                continue;
            }
            if (givesItAway(key, correctKey)) {
                continue;
            }
            taken.add(key);
            candidates.add(candidate);
        }

        // Shuffle first so that answers of equal plausibility are not ordered by their position in
        // the deck — otherwise every card would draw its distractors from its own neighbourhood.
        // Seeded, so the same note always lands on the same set.
        Collections.shuffle(candidates, new Random(seed == null ? 0 : seed.hashCode()));
        candidates.sort(Comparator.comparingInt(c -> lengthDistance(c, correct)));
        return candidates;
    }

    /**
     * Whether offering this candidate would hand the learner the answer.
     *
     * <p>Containment in either direction: "aerobic respiration" beside "aerobic respiration in the
     * mitochondria" is not a choice between a right and a wrong answer, it is a choice between two
     * readings of the same one.
     */
    private static boolean givesItAway(String candidateKey, String correctKey) {
        return candidateKey.contains(correctKey) || correctKey.contains(candidateKey);
    }

    /**
     * How far apart two answers are in length. Lower sorts first.
     *
     * <p>A one-word option next to a one-sentence option tells the learner which is which without
     * their knowing anything. This is a ranking signal only — see the class comment for why it is
     * not a filter.
     */
    private static int lengthDistance(String candidate, String correct) {
        return Math.abs(candidate.strip().length() - correct.strip().length());
    }

    /**
     * Comparison form: markup and media removed, whitespace collapsed, case folded.
     *
     * <p>Without this, {@code <b>Paris</b>} and {@code Paris} are two different options on the same
     * card — the learner sees the answer twice and neither is wrong.
     */
    static String normalise(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replaceAll("(?i)\\[sound:[^]]*]", " ")
                .replaceAll("(?i)<img[^>]*>", " ")
                .replaceAll("<[^>]+>", " ")
                .replaceAll("&nbsp;", " ")
                .replaceAll("\\s+", " ")
                .strip()
                .toLowerCase(Locale.ROOT);
    }

    private static boolean isBlank(String value) {
        return normalise(value).isEmpty();
    }
}
