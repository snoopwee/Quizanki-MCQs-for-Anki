package com.ankiquiz.service.ai;

import com.ankiquiz.dto.request.AiDraftRequest;
import com.ankiquiz.dto.response.AiDeckDraftResponse;
import com.ankiquiz.dto.response.ApkgNotesResponse;
import com.ankiquiz.exception.AiInputException;
import com.ankiquiz.exception.AiKeyInvalidException;
import com.ankiquiz.exception.AiUnavailableException;
import com.ankiquiz.exception.RateLimitExceededException;
import com.ankiquiz.service.ai.AiQuotaService.AiAccess;
import com.ankiquiz.service.ai.PdfTextExtractor.ExtractedPdf;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Turns pasted material or an uploaded PDF into a draft deck.
 *
 * The draft comes back in the {@code .apkg} parser's shape on purpose: the frontend then opens it
 * in the review editor it already has, so every generated card is read and editable by a human
 * before anything is saved. The model drafts; it never publishes.
 *
 * Nothing here is stored. The material, the prompt and the cards exist for the length of the
 * request; only sizes and outcomes reach {@link AiUsageLogger}.
 */
@Service
public class AiDeckDraftService {

    private static final Logger log = LoggerFactory.getLogger(AiDeckDraftService.class);

    /** Below this there isn't enough material to make a card from. */
    private static final int MIN_INPUT_CHARS = 40;
    private static final int MIN_CARDS_PER_CHUNK = 5;
    static final String SOURCE_TEXT = "text";
    static final String SOURCE_PDF = "pdf";

    private static final String SYSTEM_INSTRUCTION = """
            You turn a student's own study material into flashcards.

            Rules:
            - Work ONLY from the material given. Never add facts that are not in it.
            - Write in the SAME language as the material. If it is Vietnamese, write Vietnamese; \
            if Japanese, Japanese. Do not translate unless the material itself is a translation list.
            - "term" is the prompt side: a word, phrase, or short question. Keep it short.
            - "definition" is the answer side: self-contained, one or two sentences.
            - One card per idea worth remembering. Skip headings, page numbers, and filler.
            - Never produce two cards with the same term.
            - At most %d cards.

            Return ONLY a JSON array, no prose and no markdown fence:
            [{"term": "...", "definition": "..."}]
            """;

    private final AiProvider provider;
    private final AiQuotaService quota;
    private final AiUsageLogger usage;
    private final AiCardParser parser;
    private final PdfTextExtractor pdfExtractor;

    private final int maxInputChars;
    private final int maxChunks;
    private final int maxOutputTokens;
    private final int defaultMaxCards;
    private final int maxPdfPages;

    public AiDeckDraftService(
            AiProvider provider,
            AiQuotaService quota,
            AiUsageLogger usage,
            AiCardParser parser,
            PdfTextExtractor pdfExtractor,
            @Value("${ai.request.max-input-chars:24000}") int maxInputChars,
            @Value("${ai.request.max-chunks:4}") int maxChunks,
            @Value("${ai.request.max-output-tokens:4096}") int maxOutputTokens,
            @Value("${ai.request.max-cards:60}") int defaultMaxCards,
            @Value("${ai.request.max-pdf-pages:80}") int maxPdfPages
    ) {
        this.provider = provider;
        this.quota = quota;
        this.usage = usage;
        this.parser = parser;
        this.pdfExtractor = pdfExtractor;
        this.maxInputChars = maxInputChars;
        this.maxChunks = maxChunks;
        this.maxOutputTokens = maxOutputTokens;
        this.defaultMaxCards = defaultMaxCards;
        this.maxPdfPages = maxPdfPages;
    }

    public AiDeckDraftResponse fromText(String userId, ZoneId zone, AiDraftRequest request) {
        String text = request.text() == null ? "" : request.text().strip();
        if (text.length() < MIN_INPUT_CHARS) {
            rejectInput(userId, SOURCE_TEXT, text.length(), "too_short");
            throw new AiInputException("Paste a bit more material — there isn't enough here to make cards from.");
        }
        return draft(userId, zone, text, deckName(request.deckName(), text), request.maxCards(),
                SOURCE_TEXT, false);
    }

    /**
     * @param filename the upload's own name, used for the deck name when none is given — the same
     *                 instinct a person has naming a deck after the file
     */
    public AiDeckDraftResponse fromPdf(String userId, ZoneId zone, byte[] bytes, String filename,
                                       String deckName, Integer maxCards) {
        ExtractedPdf extracted;
        try {
            // Never keep more text than we would be willing to send anyway.
            extracted = pdfExtractor.extract(bytes, maxPdfPages, maxInputChars * maxChunks);
        } catch (AiInputException ex) {
            rejectInput(userId, SOURCE_PDF, bytes == null ? 0 : bytes.length, "pdf_unreadable");
            throw ex;
        }
        if (extracted.text().length() < MIN_INPUT_CHARS) {
            rejectInput(userId, SOURCE_PDF, extracted.text().length(), "too_short");
            throw new AiInputException("There's very little text in that PDF — not enough to make cards from.");
        }
        log.debug("PDF extracted: {} of {} pages, {} chars",
                extracted.pagesRead(), extracted.pages(), extracted.text().length());

        String name = deckName != null && !deckName.isBlank()
                ? deckName.strip()
                : deckName(nameFromFilename(filename), extracted.text());
        return draft(userId, zone, extracted.text(), name, maxCards, SOURCE_PDF, extracted.truncated());
    }

    private AiDeckDraftResponse draft(String userId, ZoneId zone, String text, String deckName,
                                      Integer requestedCards, String sourceKind, boolean sourceTruncated) {
        List<String> chunks = AiTextChunker.split(text, maxInputChars, maxChunks);
        boolean truncated = sourceTruncated || AiTextChunker.wouldTruncate(text, maxInputChars, maxChunks);

        // Authorize once, but a chunk is a provider call, so the day's allowance must cover all of
        // them — otherwise we would spend the pool and then fail halfway with a half-built deck.
        AiAccess access = quota.authorize(userId, zone);
        if (access.remainingToday() < chunks.size()) {
            throw new RateLimitExceededException("That's a lot of material — it needs " + chunks.size()
                    + " generations and you have " + access.remainingToday()
                    + " left today. Use a smaller section, or add your own API key in Settings.");
        }

        int cardBudget = requestedCards == null ? defaultMaxCards : requestedCards;
        int perChunk = Math.max(MIN_CARDS_PER_CHUNK, cardBudget / Math.max(1, chunks.size()));

        List<AiCard> collected = new ArrayList<>();
        boolean partial = false;
        int chunksRun = 0;

        for (String chunk : chunks) {
            try {
                AiCompletion completion = provider.complete(
                        new AiPrompt(SYSTEM_INSTRUCTION.formatted(perChunk), chunk, maxOutputTokens, true),
                        access.apiKey());
                List<AiCard> cards = parser.parse(completion.text());
                collected.addAll(cards);
                chunksRun++;
                usage.record(userId, sourceKind, provider.name(), provider.model(), access.keyOwner(),
                        chunk.length(), cards.size(), AiUsageLogger.OUTCOME_OK, null);
            } catch (RuntimeException ex) {
                usage.record(userId, sourceKind, provider.name(), provider.model(), access.keyOwner(),
                        chunk.length(), 0, outcomeFor(ex), ex.getClass().getSimpleName());
                // Nothing salvageable yet: let the caller see the real reason.
                if (collected.isEmpty()) {
                    throw ex;
                }
                // Some cards already exist — keep them rather than throwing the work away.
                log.warn("AI draft stopped early after {} of {} chunks: {}",
                        chunksRun, chunks.size(), ex.getClass().getSimpleName());
                partial = true;
                break;
            }
        }

        List<AiCard> cards = AiCardParser.dedupe(collected);
        if (cards.size() > cardBudget) {
            cards = cards.subList(0, cardBudget);
        }
        if (cards.isEmpty()) {
            throw new AiUnavailableException("The AI couldn't find anything to make cards from in that material.");
        }

        return new AiDeckDraftResponse(
                toDraft(deckName, cards),
                new AiDeckDraftResponse.Meta(
                        provider.name(),
                        provider.model(),
                        access.keyOwner(),
                        Math.max(0, access.remainingToday() - chunksRun),
                        cards.size(),
                        chunksRun,
                        truncated,
                        partial));
    }

    /**
     * Records an attempt that never reached the provider. It costs the user nothing — the quota
     * only charges for {@code ok} / {@code provider_error} — but the ledger shows what was tried.
     */
    private void rejectInput(String userId, String sourceKind, int size, String reason) {
        usage.record(userId, sourceKind, provider.name(), provider.model(), AiAccess.SHARED,
                size, 0, AiUsageLogger.OUTCOME_INVALID_INPUT, reason);
    }

    private static String outcomeFor(RuntimeException ex) {
        if (ex instanceof AiKeyInvalidException) {
            return AiUsageLogger.OUTCOME_INVALID_KEY;
        }
        if (ex instanceof RateLimitExceededException) {
            return AiUsageLogger.OUTCOME_QUOTA;
        }
        return AiUsageLogger.OUTCOME_PROVIDER_ERROR;
    }

    /** The material's first line, trimmed — the same instinct a person has naming a deck. */
    private static String deckName(String requested, String text) {
        if (requested != null && !requested.isBlank()) {
            return requested.strip();
        }
        String firstLine = text.lines().map(String::strip).filter(line -> !line.isEmpty())
                .findFirst().orElse("AI deck");
        return firstLine.length() > 60 ? firstLine.substring(0, 60).strip() : firstLine;
    }

    private static String nameFromFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return null;
        }
        String name = filename.strip().replaceAll("(?i)\\.pdf$", "");
        return name.isBlank() ? null : name;
    }

    /**
     * Wraps the cards as a single Basic (Front/Back) note type — the parser's shape, so the
     * existing review editor and save path need no special case for AI decks.
     */
    private static ApkgNotesResponse toDraft(String deckName, List<AiCard> cards) {
        List<ApkgNotesResponse.ParsedNote> notes = new ArrayList<>(cards.size());
        for (AiCard card : cards) {
            // LinkedHashMap: field ORDER is what the editor shows as column order.
            Map<String, String> fields = new LinkedHashMap<>();
            fields.put("Front", card.term());
            fields.put("Back", card.definition());
            notes.add(new ApkgNotesResponse.ParsedNote(null, fields, List.of(), null, null, null, null));
        }

        ApkgNotesResponse.NoteTypeNotes noteType = new ApkgNotesResponse.NoteTypeNotes(
                1L, "Basic", false,
                List.of("Front", "Back"),
                List.of("Front"),
                List.of("Back"),
                List.of("Front", "Back"),
                notes.size(),
                notes);

        return new ApkgNotesResponse(deckName, "ai", "ai", notes.size(), 0, 0, 0, List.of(noteType));
    }
}
