package com.ankiquiz.service.ai;

import com.ankiquiz.dto.request.AiDraftRequest;
import com.ankiquiz.dto.response.AiDeckDraftResponse;
import com.ankiquiz.dto.response.ApkgNotesResponse;
import com.ankiquiz.exception.AiInputException;
import com.ankiquiz.exception.AiUnavailableException;
import com.ankiquiz.exception.RateLimitExceededException;
import com.ankiquiz.service.ai.AiQuotaService.AiAccess;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Drafting a deck from text. The draft deliberately comes back in the .apkg parser's shape, so the
 * important assertions are about that contract, about what a shared free-tier pool is allowed to
 * spend, and about not throwing away cards we already paid for.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiDeckDraftServiceTest {

    private static final String USER = "user-1";
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Mock private AiProvider provider;
    @Mock private AiQuotaService quota;
    @Mock private AiUsageLogger usage;
    @Mock private PdfTextExtractor pdfExtractor;

    private AiDeckDraftService service;

    @BeforeEach
    void setUp() {
        when(provider.name()).thenReturn("gemini");
        when(provider.model()).thenReturn("test-model");
        access(10);
        // 100-char chunks, at most 3 of them.
        service = new AiDeckDraftService(provider, quota, usage, new AiCardParser(new ObjectMapper()),
                pdfExtractor, 100, 3, 1024, 60, 80);
    }

    private void access(int remaining) {
        when(quota.authorize(eq(USER), any())).thenReturn(new AiAccess(AiAccess.SHARED, "pool-key", remaining));
    }

    private void providerReturns(String... jsonPerCall) {
        List<AiCompletion> answers = new ArrayList<>();
        for (String json : jsonPerCall) {
            answers.add(new AiCompletion(json, 10, 20));
        }
        when(provider.complete(any(), anyString())).thenAnswer(new org.mockito.stubbing.Answer<>() {
            private int call = 0;

            @Override
            public AiCompletion answer(org.mockito.invocation.InvocationOnMock invocation) {
                return answers.get(Math.min(call++, answers.size() - 1));
            }
        });
    }

    private AiDraftRequest request(String text) {
        return new AiDraftRequest(text, null, null, "Asia/Ho_Chi_Minh");
    }

    @Test
    void returnsADraftInTheParsersShape_soTheReviewEditorOpensIt() {
        providerReturns("""
                [{"term":"犬","definition":"dog"},{"term":"猫","definition":"cat"}]
                """);

        AiDeckDraftResponse response = service.fromText(USER, ZONE,
                new AiDraftRequest("Kanji for animals\n\n犬 means dog. 猫 means cat.", "Animals", null, null));

        ApkgNotesResponse draft = response.draft();
        assertThat(draft.filename()).isEqualTo("Animals");
        assertThat(draft.totalNotes()).isEqualTo(2);
        assertThat(draft.noteTypes()).hasSize(1);

        ApkgNotesResponse.NoteTypeNotes type = draft.noteTypes().get(0);
        assertThat(type.fieldNames()).containsExactly("Front", "Back");
        assertThat(type.frontFields()).containsExactly("Front");
        assertThat(type.backFields()).containsExactly("Back");
        // Field ORDER is the editor's column order, so it must survive.
        assertThat(type.notes().get(0).fields().keySet()).containsExactly("Front", "Back");
        assertThat(type.notes().get(0).fields()).containsEntry("Front", "犬").containsEntry("Back", "dog");
        assertThat(type.notes().get(0).ankiNoteId()).isNull();
    }

    @Test
    void namesTheDeckAfterTheMaterialsFirstLineWhenNoNameIsGiven() {
        providerReturns("[{\"term\":\"a\",\"definition\":\"b\"}]");

        AiDeckDraftResponse response = service.fromText(USER, ZONE,
                request("JLPT N3 grammar\n\nsome material that is long enough to pass the minimum"));

        assertThat(response.draft().filename()).isEqualTo("JLPT N3 grammar");
    }

    @Test
    void tooLittleMaterialIsRejectedBeforeAnyProviderCall() {
        assertThatThrownBy(() -> service.fromText(USER, ZONE, request("too short")))
                .isInstanceOf(AiInputException.class);

        verify(provider, never()).complete(any(), anyString());
        // Logged as invalid_input, which the quota deliberately does not charge for.
        verify(usage).record(eq(USER), eq("text"), anyString(), anyString(), anyString(), anyInt(), eq(0),
                eq(AiUsageLogger.OUTCOME_INVALID_INPUT), anyString());
    }

    @Test
    void longMaterialIsChunked_andEachChunkIsOneProviderCall() {
        providerReturns("[{\"term\":\"one\",\"definition\":\"1\"}]", "[{\"term\":\"two\",\"definition\":\"2\"}]");
        String text = "a".repeat(100) + "\n\n" + "b".repeat(100);

        AiDeckDraftResponse response = service.fromText(USER, ZONE, request(text));

        verify(provider, times(2)).complete(any(), eq("pool-key"));
        assertThat(response.meta().chunks()).isEqualTo(2);
        assertThat(response.meta().cards()).isEqualTo(2);
        assertThat(response.meta().remainingToday()).isEqualTo(8);
    }

    @Test
    void refusesWhenTheDaysAllowanceCannotCoverEveryChunk() {
        access(1);
        String text = "a".repeat(100) + "\n\n" + "b".repeat(100);

        assertThatThrownBy(() -> service.fromText(USER, ZONE, request(text)))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessageContaining("2 generations");

        // Nothing was spent: we refuse before the first call rather than half-build a deck.
        verify(provider, never()).complete(any(), anyString());
    }

    @Test
    void saysSoWhenTheMaterialWasBiggerThanWeWereWillingToSend() {
        providerReturns("[{\"term\":\"a\",\"definition\":\"b\"}]");

        AiDeckDraftResponse response = service.fromText(USER, ZONE, request("x".repeat(5_000)));

        assertThat(response.meta().inputTruncated()).isTrue();
        assertThat(response.meta().chunks()).isEqualTo(3); // capped at maxChunks
    }

    @Test
    void theSameTermFromTwoChunksBecomesOneCard() {
        providerReturns("[{\"term\":\"Kanji\",\"definition\":\"first\"}]",
                "[{\"term\":\"kanji\",\"definition\":\"repeat\"}]");
        String text = "a".repeat(100) + "\n\n" + "b".repeat(100);

        AiDeckDraftResponse response = service.fromText(USER, ZONE, request(text));

        assertThat(response.meta().cards()).isEqualTo(1);
        assertThat(response.draft().noteTypes().get(0).notes().get(0).fields())
                .containsEntry("Back", "first");
    }

    @Test
    void aFailureOnTheFirstChunkSurfacesTheRealReason() {
        when(provider.complete(any(), anyString())).thenThrow(new AiUnavailableException("provider down"));

        assertThatThrownBy(() -> service.fromText(USER, ZONE, request("material long enough to be accepted here")))
                .isInstanceOf(AiUnavailableException.class);

        verify(usage).record(eq(USER), eq("text"), anyString(), anyString(), eq(AiAccess.SHARED), anyInt(), eq(0),
                eq(AiUsageLogger.OUTCOME_PROVIDER_ERROR), anyString());
    }

    @Test
    void aFailureOnALaterChunkKeepsTheCardsAlreadyPaidFor() {
        when(provider.complete(any(), anyString()))
                .thenReturn(new AiCompletion("[{\"term\":\"kept\",\"definition\":\"card\"}]", 1, 1))
                .thenThrow(new AiUnavailableException("provider died mid-way"));
        String text = "a".repeat(100) + "\n\n" + "b".repeat(100);

        AiDeckDraftResponse response = service.fromText(USER, ZONE, request(text));

        assertThat(response.meta().partial()).isTrue();
        assertThat(response.meta().cards()).isEqualTo(1);
        assertThat(response.meta().chunks()).isEqualTo(1);
    }

    @Test
    void anAnswerWithNoUsableCardsIsAFailure_notAnEmptyDeck() {
        providerReturns("I'm sorry, I can't help with that.");

        assertThatThrownBy(() -> service.fromText(USER, ZONE, request("material long enough to be accepted here")))
                .isInstanceOf(AiUnavailableException.class)
                .hasMessageContaining("couldn't find anything");
    }

    // ── PDFs (S3) ───────────────────────────────────────────────────────────
    // The PDF only changes where the text comes from; everything after extraction is the text path,
    // so these cover the handover rather than re-testing chunking.

    private static final byte[] PDF_BYTES = "%PDF-1.4 pretend".getBytes(java.nio.charset.StandardCharsets.UTF_8);

    private void pdfExtractsTo(String text, boolean truncated) {
        when(pdfExtractor.extract(any(), anyInt(), anyInt()))
                .thenReturn(new PdfTextExtractor.ExtractedPdf(text, 3, 3, truncated));
    }

    @Test
    void aPdfIsDraftedLikeText_andLoggedAsAPdf() {
        pdfExtractsTo("Chapter 1: kanji for animals. 犬 means dog and 猫 means cat.", false);
        providerReturns("[{\"term\":\"犬\",\"definition\":\"dog\"}]");

        AiDeckDraftResponse response = service.fromPdf(USER, ZONE, PDF_BYTES, "kanji-chapter-1.pdf", null, null);

        assertThat(response.meta().cards()).isEqualTo(1);
        verify(usage).record(eq(USER), eq("pdf"), anyString(), anyString(), eq(AiAccess.SHARED),
                anyInt(), eq(1), eq(AiUsageLogger.OUTCOME_OK), any());
    }

    @Test
    void namesThePdfDeckAfterTheFile() {
        pdfExtractsTo("Chapter 1: kanji for animals, with plenty of material to work from.", false);
        providerReturns("[{\"term\":\"a\",\"definition\":\"b\"}]");

        AiDeckDraftResponse response = service.fromPdf(USER, ZONE, PDF_BYTES, "JLPT N3 grammar.pdf", null, null);

        assertThat(response.draft().filename()).isEqualTo("JLPT N3 grammar");
    }

    @Test
    void anExplicitDeckNameBeatsTheFilename() {
        pdfExtractsTo("Chapter 1: kanji for animals, with plenty of material to work from.", false);
        providerReturns("[{\"term\":\"a\",\"definition\":\"b\"}]");

        AiDeckDraftResponse response =
                service.fromPdf(USER, ZONE, PDF_BYTES, "scan-2026-09-21.pdf", "Kanji N3", null);

        assertThat(response.draft().filename()).isEqualTo("Kanji N3");
    }

    @Test
    void aPdfWeCouldNotReadNeverReachesTheProvider() {
        when(pdfExtractor.extract(any(), anyInt(), anyInt()))
                .thenThrow(new AiInputException("That PDF has no text in it — it looks like a scan."));

        assertThatThrownBy(() -> service.fromPdf(USER, ZONE, PDF_BYTES, "scan.pdf", null, null))
                .isInstanceOf(AiInputException.class)
                .hasMessageContaining("scan");

        verify(provider, never()).complete(any(), anyString());
        verify(usage).record(eq(USER), eq("pdf"), anyString(), anyString(), anyString(), anyInt(), eq(0),
                eq(AiUsageLogger.OUTCOME_INVALID_INPUT), anyString());
    }

    @Test
    void aPdfWithAlmostNoTextIsRejected() {
        pdfExtractsTo("page 1", false);

        assertThatThrownBy(() -> service.fromPdf(USER, ZONE, PDF_BYTES, "mostly-images.pdf", null, null))
                .isInstanceOf(AiInputException.class)
                .hasMessageContaining("very little text");

        verify(provider, never()).complete(any(), anyString());
    }

    @Test
    void aPdfCutShortByAPageCapSaysSoInTheMeta() {
        pdfExtractsTo("Chapter 1: kanji for animals, with plenty of material to work from.", true);
        providerReturns("[{\"term\":\"a\",\"definition\":\"b\"}]");

        AiDeckDraftResponse response = service.fromPdf(USER, ZONE, PDF_BYTES, "textbook.pdf", null, null);

        assertThat(response.meta().inputTruncated()).isTrue();
    }

    @Test
    void respectsTheCardCeilingTheCallerAsksFor() {
        StringBuilder json = new StringBuilder("[");
        for (int i = 0; i < 30; i++) {
            json.append(i > 0 ? "," : "").append("{\"term\":\"t").append(i).append("\",\"definition\":\"d\"}");
        }
        providerReturns(json.append("]").toString());

        AiDeckDraftResponse response = service.fromText(USER, ZONE,
                new AiDraftRequest("material long enough to be accepted here", null, 5, null));

        assertThat(response.meta().cards()).isEqualTo(5);
        assertThat(response.draft().totalNotes()).isEqualTo(5);
    }
}
