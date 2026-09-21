package com.ankiquiz.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Turns whatever the model actually returned into cards. Pure and defensive: a model is asked for
 * a JSON array of {@code {term, definition}} and mostly complies, but "mostly" is not a contract.
 * Everything here exists because some model, somewhere, does it:
 *
 * <ul>
 *   <li>wraps the JSON in a ```json fence despite being asked for raw JSON</li>
 *   <li>wraps the array in an object ({@code {"cards": [...]}})</li>
 *   <li>renames the keys (front/back, question/answer)</li>
 *   <li>emits an entry with an empty side, or a stray string in the array</li>
 * </ul>
 *
 * A card that survives all that is still only a draft — the learner reviews every one before save.
 */
@Component
public class AiCardParser {

    /** Long enough for a sentence-style prompt, short enough to stay a flashcard. */
    static final int MAX_TERM_CHARS = 300;
    static final int MAX_DEFINITION_CHARS = 1500;

    private static final List<String> TERM_KEYS = List.of("term", "front", "question", "q", "word");
    private static final List<String> DEFINITION_KEYS = List.of("definition", "back", "answer", "a", "meaning");

    private final ObjectMapper mapper;

    public AiCardParser(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    /** Parsed cards, in model order, with junk dropped. Never null; may be empty. */
    public List<AiCard> parse(String raw) {
        JsonNode root = readTree(stripFence(raw));
        JsonNode array = asArray(root);
        if (array == null) {
            return List.of();
        }

        List<AiCard> cards = new ArrayList<>();
        for (JsonNode node : array) {
            if (!node.isObject()) {
                continue;
            }
            String term = clean(firstOf(node, TERM_KEYS), MAX_TERM_CHARS);
            String definition = clean(firstOf(node, DEFINITION_KEYS), MAX_DEFINITION_CHARS);
            // A card needs both sides; a one-sided entry can't be studied or graded.
            if (!term.isEmpty() && !definition.isEmpty()) {
                cards.add(new AiCard(term, definition));
            }
        }
        return cards;
    }

    /**
     * Drops cards whose term repeats one already kept — chunked input often restates the same
     * heading. Case- and whitespace-insensitive; the first occurrence wins.
     */
    public static List<AiCard> dedupe(List<AiCard> cards) {
        Map<String, AiCard> byTerm = new LinkedHashMap<>();
        for (AiCard card : cards) {
            byTerm.putIfAbsent(normalize(card.term()), card);
        }
        return List.copyOf(byTerm.values());
    }

    private JsonNode readTree(String text) {
        try {
            return mapper.readTree(text);
        } catch (Exception ex) {
            return null;
        }
    }

    private static JsonNode asArray(JsonNode root) {
        if (root == null) {
            return null;
        }
        if (root.isArray()) {
            return root;
        }
        if (root.isObject()) {
            // {"cards": [...]} / {"flashcards": [...]} / any single array-valued field.
            for (JsonNode child : root) {
                if (child.isArray()) {
                    return child;
                }
            }
        }
        return null;
    }

    // Models sometimes answer with ```json ... ``` even when told to return raw JSON.
    private static String stripFence(String raw) {
        if (raw == null) {
            return "";
        }
        String text = raw.trim();
        if (!text.startsWith("```")) {
            return text;
        }
        int firstNewline = text.indexOf('\n');
        int closing = text.lastIndexOf("```");
        if (firstNewline < 0 || closing <= firstNewline) {
            return text;
        }
        return text.substring(firstNewline + 1, closing).trim();
    }

    private static String firstOf(JsonNode node, List<String> keys) {
        for (String key : keys) {
            JsonNode value = node.get(key);
            if (value != null && value.isTextual()) {
                return value.asText();
            }
        }
        return "";
    }

    private static String clean(String value, int maxChars) {
        String text = value.replace(' ', ' ').trim();
        // Collapse runs of whitespace but keep single newlines: a definition may be two lines.
        text = text.replaceAll("[ \\t]+", " ").replaceAll("\\n{3,}", "\n\n");
        return text.length() > maxChars ? text.substring(0, maxChars).trim() : text;
    }

    private static String normalize(String term) {
        return term.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }
}
