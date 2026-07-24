package com.ankiquiz.service;

import com.ankiquiz.dto.response.NoteResponse;
import com.ankiquiz.entity.CardStats;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Note;
import com.ankiquiz.entity.NoteType;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.CardStatsRepository;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import com.ankiquiz.repository.NoteTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NoteServiceTest {

    private static final String USER = "user-1";
    private static final Caller CALLER = new Caller(USER, "Alice");

    @Mock private DeckRepository deckRepository;
    @Mock private NoteRepository noteRepository;
    @Mock private NoteTypeRepository noteTypeRepository;
    @Mock private CardStatsRepository cardStatsRepository;

    private NoteService service;

    private final UUID deckId = UUID.randomUUID();
    private final UUID noteId = UUID.randomUUID();
    private final UUID typeId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new NoteService(deckRepository, noteRepository, noteTypeRepository, cardStatsRepository);
    }

    private Note existingNote(Map<String, String> fields) {
        Note note = new Note();
        note.setId(noteId);
        note.setDeckId(deckId);
        note.setNoteTypeId(typeId);
        note.setFields(new LinkedHashMap<>(fields));
        return note;
    }

    private void stubOwnedNote(Note note, String... fieldNames) {
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.of(new Deck()));
        when(noteRepository.findByIdAndDeckId(noteId, deckId)).thenReturn(Optional.of(note));
        NoteType type = new NoteType();
        type.setFieldNames(fieldNames);
        when(noteTypeRepository.findById(typeId)).thenReturn(Optional.of(type));
        when(noteRepository.save(any(Note.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(cardStatsRepository.findByUserIdAndNoteId(USER, noteId)).thenReturn(Optional.empty());
    }

    @Test
    void updateNote_appliesNewValues_andDropsUnknownKeys() {
        Note note = existingNote(Map.of("Front", "a", "Back", "b"));
        stubOwnedNote(note, "Front", "Back");

        Map<String, String> incoming = new HashMap<>();
        incoming.put("Front", "a-edited");
        incoming.put("Bogus", "junk");

        NoteResponse res = service.updateNote(CALLER, deckId, noteId, incoming, null, null);

        assertThat(res.fields()).containsEntry("Front", "a-edited");
        assertThat(res.fields()).containsEntry("Back", "b");
        assertThat(res.fields()).doesNotContainKey("Bogus");
    }

    @Test
    void updateNote_keepsUntouchedFields_whenFormIsPartial() {
        Note note = existingNote(Map.of("Front", "a", "Back", "b"));
        stubOwnedNote(note, "Front", "Back");

        NoteResponse res = service.updateNote(CALLER, deckId, noteId, Map.of("Back", "b-edited"), null, null);

        assertThat(res.fields()).containsEntry("Front", "a");
        assertThat(res.fields()).containsEntry("Back", "b-edited");
    }

    @Test
    void updateNote_storesClozeMarkupVerbatim() {
        Note note = existingNote(Map.of("Text", "old"));
        stubOwnedNote(note, "Text");

        NoteResponse res = service.updateNote(CALLER, deckId, noteId,
                Map.of("Text", "The capital is {{c1::Paris}}."), null, null);

        assertThat(res.fields()).containsEntry("Text", "The capital is {{c1::Paris}}.");
    }

    @Test
    void updateNote_setsAndClearsFaceLanguageOverride() {
        Note note = existingNote(Map.of("Front", "a", "Back", "b"));
        stubOwnedNote(note, "Front", "Back");

        // Set an override on the front face; a null back leaves that face unchanged.
        service.updateNote(CALLER, deckId, noteId, Map.of("Front", "a"), "ja", null);
        assertThat(note.getFrontLang()).isEqualTo("ja");
        assertThat(note.getBackLang()).isNull();

        // A present-but-blank value clears the override back to auto-detect.
        service.updateNote(CALLER, deckId, noteId, Map.of("Front", "a"), "  ", "en");
        assertThat(note.getFrontLang()).isNull();
        assertThat(note.getBackLang()).isEqualTo("en");
    }

    @Test
    void updateNote_throwsNotFound_whenDeckNotOwned() {
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateNote(CALLER, deckId, noteId, Map.of("Front", "x"), null, null))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void updateNote_throwsNotFound_whenNoteNotInDeck() {
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.of(new Deck()));
        when(noteRepository.findByIdAndDeckId(noteId, deckId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateNote(CALLER, deckId, noteId, Map.of("Front", "x"), null, null))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void setStarred_createsDefaultStatsRow_whenNoneExists() {
        Note note = existingNote(Map.of("Front", "a", "Back", "b"));
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.of(new Deck()));
        when(noteRepository.findByIdAndDeckId(noteId, deckId)).thenReturn(Optional.of(note));
        when(cardStatsRepository.findByUserIdAndNoteId(USER, noteId)).thenReturn(Optional.empty());
        when(cardStatsRepository.save(any(CardStats.class))).thenAnswer(inv -> inv.getArgument(0));

        NoteResponse res = service.setStarred(USER, deckId, noteId, true);

        assertThat(res.cardStats()).isNotNull();
        assertThat(res.cardStats().starred()).isTrue();
        // A never-answered card starts at zeroed counters, not nulls.
        assertThat(res.cardStats().timesSeen()).isZero();
        assertThat(res.cardStats().mastery()).isZero();
    }

    @Test
    void setStarred_updatesExistingRow_andKeepsOtherStats() {
        Note note = existingNote(Map.of("Front", "a", "Back", "b"));
        CardStats existing = new CardStats();
        existing.setNoteId(noteId);
        existing.setTimesSeen(4);
        existing.setMastery(50.0);
        existing.setStarred(false);
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.of(new Deck()));
        when(noteRepository.findByIdAndDeckId(noteId, deckId)).thenReturn(Optional.of(note));
        when(cardStatsRepository.findByUserIdAndNoteId(USER, noteId)).thenReturn(Optional.of(existing));
        when(cardStatsRepository.save(any(CardStats.class))).thenAnswer(inv -> inv.getArgument(0));

        NoteResponse res = service.setStarred(USER, deckId, noteId, true);

        assertThat(res.cardStats().starred()).isTrue();
        assertThat(res.cardStats().mastery()).isEqualTo(50.0);
        assertThat(res.cardStats().timesSeen()).isEqualTo(4);
    }

    @Test
    void setStarred_throwsNotFound_whenDeckNotStudiable() {
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.setStarred(USER, deckId, noteId, true))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void setStarred_throwsNotFound_whenNoteNotInDeck() {
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.of(new Deck()));
        when(noteRepository.findByIdAndDeckId(noteId, deckId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.setStarred(USER, deckId, noteId, true))
                .isInstanceOf(NotFoundException.class);
    }
}
