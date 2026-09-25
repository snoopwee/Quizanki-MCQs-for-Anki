package com.ankiquiz.service.ai;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AiTextChunkerTest {

    @Test
    void shortMaterialIsOnePiece() {
        assertThat(AiTextChunker.split("a short note", 100, 4)).containsExactly("a short note");
    }

    @Test
    void splitsOnParagraphBreaks_soNoDefinitionIsCutInHalf() {
        String text = "para one is here\n\npara two is here\n\npara three is here";

        List<String> chunks = AiTextChunker.split(text, 35, 4);

        assertThat(chunks).hasSize(2);
        assertThat(chunks.get(0)).isEqualTo("para one is here\n\npara two is here");
        assertThat(chunks.get(1)).isEqualTo("para three is here");
        // Nothing was lost in the split.
        assertThat(String.join("\n\n", chunks)).isEqualTo(text);
    }

    @Test
    void aParagraphBiggerThanTheLimitIsCutRatherThanDropped() {
        String wall = "x".repeat(250);

        List<String> chunks = AiTextChunker.split(wall, 100, 4);

        assertThat(chunks).hasSize(3);
        assertThat(String.join("", chunks)).isEqualTo(wall);
    }

    @Test
    void neverSpendsMorePiecesThanAllowed() {
        String text = "x".repeat(100_000);

        assertThat(AiTextChunker.split(text, 1_000, 3)).hasSize(3);
        assertThat(AiTextChunker.split(text, 1_000, 1)).hasSize(1);
    }

    @Test
    void saysWhenMaterialIsBiggerThanWhatWillBeSent() {
        assertThat(AiTextChunker.wouldTruncate("x".repeat(400), 100, 4)).isFalse();
        assertThat(AiTextChunker.wouldTruncate("x".repeat(401), 100, 4)).isTrue();
    }

    @Test
    void emptyMaterialIsNoPieces() {
        assertThat(AiTextChunker.split("   ", 100, 4)).isEmpty();
        assertThat(AiTextChunker.split(null, 100, 4)).isEmpty();
        assertThat(AiTextChunker.split("text", 0, 4)).isEmpty();
    }
}
