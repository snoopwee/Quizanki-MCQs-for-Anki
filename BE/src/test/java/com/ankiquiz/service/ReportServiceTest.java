package com.ankiquiz.service;

import com.ankiquiz.dto.response.AdminReportResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.DeckReport;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckReportRepository;
import com.ankiquiz.repository.DeckRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock private DeckReportRepository reportRepository;
    @Mock private DeckRepository deckRepository;

    private static final String USER = "user-1";
    private final UUID deckId = UUID.randomUUID();

    private ReportService service() {
        return new ReportService(reportRepository, deckRepository);
    }

    @Test
    void report_createsAnOpenReport_forAStudiableDeck() {
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.of(new Deck()));
        when(reportRepository.findByDeckIdAndReporterId(deckId, USER)).thenReturn(Optional.empty());

        service().report(USER, deckId, "  Spam  ", "   ");

        ArgumentCaptor<DeckReport> captor = ArgumentCaptor.forClass(DeckReport.class);
        verify(reportRepository).save(captor.capture());
        DeckReport saved = captor.getValue();
        assertThat(saved.getDeckId()).isEqualTo(deckId);
        assertThat(saved.getReporterId()).isEqualTo(USER);
        assertThat(saved.getReason()).isEqualTo("Spam");  // trimmed
        assertThat(saved.getDetails()).isNull();           // blank → null
        assertThat(saved.getStatus()).isEqualTo("open");
    }

    @Test
    void report_isIdempotent_whenAlreadyReportedByThatUser() {
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.of(new Deck()));
        when(reportRepository.findByDeckIdAndReporterId(deckId, USER))
                .thenReturn(Optional.of(new DeckReport()));

        service().report(USER, deckId, "Spam", null);

        verify(reportRepository, never()).save(any());
    }

    @Test
    void report_404sForADeckTheReporterCannotSee() {
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().report(USER, deckId, "Spam", null))
                .isInstanceOf(NotFoundException.class);
        verify(reportRepository, never()).save(any());
    }

    @Test
    void listReports_joinsDeckName_andToleratesAMissingDeck() {
        UUID otherDeck = UUID.randomUUID();
        DeckReport r1 = report(deckId, "spam");
        DeckReport r2 = report(otherDeck, "copyright");
        when(reportRepository.findByStatusOrderByCreatedAtDesc("open")).thenReturn(List.of(r1, r2));

        Deck deck = new Deck();
        deck.setId(deckId);
        deck.setName("JLPT N4");
        deck.setAuthorName("Alice");
        when(deckRepository.findAllById(any())).thenReturn(List.of(deck)); // otherDeck missing

        List<AdminReportResponse> out = service().listReports("open");

        assertThat(out).hasSize(2);
        assertThat(out.get(0).deckName()).isEqualTo("JLPT N4");
        assertThat(out.get(0).authorName()).isEqualTo("Alice");
        assertThat(out.get(1).deckName()).isNull(); // deck gone
    }

    @Test
    void updateStatus_setsResolved_andWhoResolvedIt() {
        UUID reportId = UUID.randomUUID();
        DeckReport r = report(deckId, "spam");
        when(reportRepository.findById(reportId)).thenReturn(Optional.of(r));

        service().updateStatus(reportId, "Resolved", "admin-1"); // case-insensitive

        assertThat(r.getStatus()).isEqualTo("resolved");
        assertThat(r.getResolvedBy()).isEqualTo("admin-1");
        assertThat(r.getResolvedAt()).isNotNull();
        verify(reportRepository).save(r);
    }

    @Test
    void updateStatus_rejectsAnythingButResolvedOrDismissed() {
        assertThatThrownBy(() -> service().updateStatus(UUID.randomUUID(), "open", "admin-1"))
                .isInstanceOf(ResponseStatusException.class);
        verify(reportRepository, never()).save(any());
    }

    private static DeckReport report(UUID deckId, String reason) {
        DeckReport r = new DeckReport();
        r.setId(UUID.randomUUID());
        r.setDeckId(deckId);
        r.setReporterId("user-x");
        r.setReason(reason);
        r.setStatus("open");
        return r;
    }
}
