package com.ankiquiz.service.ai;

import java.util.ArrayList;
import java.util.List;

/**
 * Splits source material into provider-sized pieces.
 *
 * Two rules, both there to protect the learner's cards rather than the code: split on paragraph
 * breaks (a chunk that ends mid-definition produces a card missing its answer), and never split
 * into more pieces than allowed — each piece is a separate provider call, and on a shared free
 * tier one person's textbook would otherwise drain the day's pool.
 */
public final class AiTextChunker {

    private AiTextChunker() {
    }

    /**
     * @param maxChars  the largest piece to hand the provider
     * @param maxChunks how many pieces we are willing to spend
     * @return pieces in order; {@code text} beyond {@code maxChars * maxChunks} is left out and
     *         the caller is expected to tell the user (see {@link #wouldTruncate})
     */
    public static List<String> split(String text, int maxChars, int maxChunks) {
        String source = text == null ? "" : text.strip();
        if (source.isEmpty() || maxChars <= 0 || maxChunks <= 0) {
            return List.of();
        }
        if (source.length() <= maxChars) {
            return List.of(source);
        }

        List<String> chunks = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String paragraph : source.split("\\n\\s*\\n")) {
            String block = paragraph.strip();
            if (block.isEmpty()) {
                continue;
            }
            // A single paragraph longer than the limit has to be cut somewhere; take it whole up
            // to the limit rather than dropping it.
            if (block.length() > maxChars) {
                flush(chunks, current);
                for (int i = 0; i < block.length() && chunks.size() < maxChunks; i += maxChars) {
                    chunks.add(block.substring(i, Math.min(block.length(), i + maxChars)));
                }
                if (chunks.size() >= maxChunks) {
                    return List.copyOf(chunks);
                }
                continue;
            }
            if (current.length() + block.length() + 2 > maxChars) {
                flush(chunks, current);
                if (chunks.size() >= maxChunks) {
                    return List.copyOf(chunks);
                }
            }
            if (current.length() > 0) {
                current.append("\n\n");
            }
            current.append(block);
        }
        flush(chunks, current);
        return chunks.size() > maxChunks ? List.copyOf(chunks.subList(0, maxChunks)) : List.copyOf(chunks);
    }

    /** True when the material is bigger than what {@link #split} will actually send. */
    public static boolean wouldTruncate(String text, int maxChars, int maxChunks) {
        String source = text == null ? "" : text.strip();
        return source.length() > (long) maxChars * maxChunks;
    }

    private static void flush(List<String> chunks, StringBuilder current) {
        if (current.length() > 0) {
            chunks.add(current.toString());
            current.setLength(0);
        }
    }
}
