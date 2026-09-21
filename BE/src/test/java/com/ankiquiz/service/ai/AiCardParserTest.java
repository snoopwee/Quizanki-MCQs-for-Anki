package com.ankiquiz.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Reading the model's answer. Every case here is something a model actually does despite being
 * told not to — the parser's job is to salvage the cards anyway, or return none rather than
 * half-formed ones.
 */
class AiCardParserTest {

    private final AiCardParser parser = new AiCardParser(new ObjectMapper());

    @Test
    void readsThePlainJsonArrayItWasAskedFor() {
        List<AiCard> cards = parser.parse("""
                [{"term":"犬","definition":"dog"},{"term":"猫","definition":"cat"}]
                """);

        assertThat(cards).containsExactly(new AiCard("犬", "dog"), new AiCard("猫", "cat"));
    }

    @Test
    void survivesAMarkdownFence() {
        List<AiCard> cards = parser.parse("""
                ```json
                [{"term":"hello","definition":"xin chào"}]
                ```
                """);

        assertThat(cards).containsExactly(new AiCard("hello", "xin chào"));
    }

    @Test
    void survivesTheArrayBeingWrappedInAnObject() {
        assertThat(parser.parse("""
                {"cards":[{"term":"a","definition":"b"}]}
                """)).containsExactly(new AiCard("a", "b"));
    }

    @Test
    void acceptsTheOtherNamesModelsUseForTheTwoSides() {
        assertThat(parser.parse("""
                [{"front":"a","back":"b"},{"question":"c","answer":"d"}]
                """)).containsExactly(new AiCard("a", "b"), new AiCard("c", "d"));
    }

    @Test
    void dropsEntriesThatCannotBeStudied() {
        List<AiCard> cards = parser.parse("""
                [{"term":"keep","definition":"this"},
                 {"term":"","definition":"no prompt"},
                 {"term":"no answer","definition":"   "},
                 "a bare string",
                 {"unrelated":"shape"}]
                """);

        assertThat(cards).containsExactly(new AiCard("keep", "this"));
    }

    @Test
    void tidiesWhitespaceButKeepsAParagraphBreak() {
        List<AiCard> cards = parser.parse("""
                [{"term":"  spaced   out  ","definition":"line one\\n\\n\\n\\nline two"}]
                """);

        assertThat(cards.get(0).term()).isEqualTo("spaced out");
        assertThat(cards.get(0).definition()).isEqualTo("line one\n\nline two");
    }

    @Test
    void capsRunawayFields() {
        String huge = "x".repeat(5000);
        List<AiCard> cards = parser.parse("[{\"term\":\"" + huge + "\",\"definition\":\"" + huge + "\"}]");

        assertThat(cards.get(0).term()).hasSize(AiCardParser.MAX_TERM_CHARS);
        assertThat(cards.get(0).definition()).hasSize(AiCardParser.MAX_DEFINITION_CHARS);
    }

    @Test
    void unreadableOutputYieldsNoCards_notAnException() {
        assertThat(parser.parse("I'm sorry, I can't help with that.")).isEmpty();
        assertThat(parser.parse("")).isEmpty();
        assertThat(parser.parse(null)).isEmpty();
    }

    @Test
    void dedupeKeepsTheFirstOfEachTerm_ignoringCaseAndSpacing() {
        List<AiCard> cards = AiCardParser.dedupe(List.of(
                new AiCard("Kanji", "first"),
                new AiCard("kanji", "second"),
                new AiCard("  KANJI  ", "third"),
                new AiCard("other", "kept")));

        assertThat(cards).containsExactly(new AiCard("Kanji", "first"), new AiCard("other", "kept"));
    }
}
