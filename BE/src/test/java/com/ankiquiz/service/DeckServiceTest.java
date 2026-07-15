package com.ankiquiz.service;

import com.ankiquiz.dto.request.UpdateDeckContentsRequest;
import com.ankiquiz.dto.request.UpdateDeckContentsRequest.NoteEntry;
import com.ankiquiz.dto.request.UpdateDeckContentsRequest.NoteTypeLayout;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Note;
import com.ankiquiz.entity.NoteType;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import com.ankiquiz.repository.NoteTypeRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DeckServiceTest {

    private static final String USER = "user-1";

    @Mock private DeckRepository deckRepository;
    @Mock private NoteTypeRepository noteTypeRepository;
    @Mock private NoteRepository noteRepository;
    @Mock private EntityManager entityManager;
    @Mock private Query query;

    private DeckService service;

    private final UUID deckId = UUID.randomUUID();
    private final UUID typeId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new DeckService(deckRepository, noteTypeRepository, noteRepository, entityManager);
        // saveAll / save echo their argument; save assigns an id to new note types
        // so ensureBasicType can route new cards to it.
        when(noteRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        when(noteTypeRepository.save(any(NoteType.class))).thenAnswer(inv -> {
            NoteType t = inv.getArgument(0);
            if (t.getId() == null) {
                t.setId(UUID.randomUUID());
            }
            return t;
        });
        // The trailing getDeckContents() completion query.
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        when(query.setParameter(eq("deckId"), any())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(0.0);
    }

    private Deck deck() {
        Deck d = new Deck();
        d.setId(deckId);
        d.setUserId(USER);
        d.setName("Old name");
        return d;
    }

    private NoteType basicType() {
        NoteType t = new NoteType();
        t.setId(typeId);
        t.setDeckId(deckId);
        t.setName("Basic");
        t.setCloze(false);
        t.setFieldNames(new String[]{"Front", "Back"});
        t.setFrontFields(new String[]{"Front"});
        t.setBackFields(new String[]{"Back"});
        return t;
    }

    private Note existingNote(UUID id, int position) {
        Note n = new Note();
        n.setId(id);
        n.setDeckId(deckId);
        n.setNoteTypeId(typeId);
        n.setFields(Map.of("Front", "f" + position, "Back", "b" + position));
        n.setPosition(position);
        return n;
    }

    @SuppressWarnings("unchecked")
    private List<Note> captureSaveAll() {
        ArgumentCaptor<List<Note>> captor = ArgumentCaptor.forClass(List.class);
        verify(noteRepository).saveAll(captor.capture());
        return captor.getValue();
    }

    @Test
    void replace_updatesKeptInsertsNew_deletesMissing_andReindexes() {
        UUID keepId = UUID.randomUUID();
        UUID dropId = UUID.randomUUID();
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.of(deck()));
        when(noteTypeRepository.findAllByDeckId(deckId)).thenReturn(List.of(basicType()));
        when(noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId))
                .thenReturn(new ArrayList<>(List.of(existingNote(keepId, 0), existingNote(dropId, 1))));

        UpdateDeckContentsRequest req = new UpdateDeckContentsRequest(
                "New name",
                List.of(),
                List.of(
                        new NoteEntry(keepId, typeId, Map.of("Front", "kept", "Back", "b"), List.of(), null, null),
                        new NoteEntry(null, typeId, Map.of("Front", "new", "Back", "b2"), List.of("tag"), null, null)
                ));

        service.replaceDeckContents(USER, deckId, req);

        List<Note> saved = captureSaveAll();
        assertThat(saved).hasSize(2);
        assertThat(saved.get(0).getId()).isEqualTo(keepId);          // kept (updated)
        assertThat(saved.get(0).getFields()).containsEntry("Front", "kept");
        assertThat(saved.get(0).getPosition()).isZero();
        assertThat(saved.get(1).getId()).isNull();                   // newly inserted
        assertThat(saved.get(1).getPosition()).isEqualTo(1);

        // The dropped note (absent from payload) is deleted.
        ArgumentCaptor<List<Note>> delCaptor = ArgumentCaptor.forClass(List.class);
        verify(noteRepository).deleteAll(delCaptor.capture());
        assertThat(delCaptor.getValue()).extracting(Note::getId).containsExactly(dropId);
    }

    @Test
    void replace_persistsPerCardLanguageOverride() {
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.of(deck()));
        when(noteTypeRepository.findAllByDeckId(deckId)).thenReturn(List.of(basicType()));
        when(noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId)).thenReturn(new ArrayList<>());

        UpdateDeckContentsRequest req = new UpdateDeckContentsRequest(
                "Deck",
                List.of(),
                // Front override "ja"; a blank back normalises to null (auto).
                List.of(new NoteEntry(null, typeId, Map.of("Front", "水", "Back", "water"),
                        List.of(), "ja", "  ")));

        service.replaceDeckContents(USER, deckId, req);

        Note saved = captureSaveAll().get(0);
        assertThat(saved.getFrontLang()).isEqualTo("ja");
        assertThat(saved.getBackLang()).isNull();
    }

    @Test
    void replace_routesNewCardWithoutType_toCreatedBasicType() {
        UUID clozeTypeId = UUID.randomUUID();
        NoteType cloze = new NoteType();
        cloze.setId(clozeTypeId);
        cloze.setDeckId(deckId);
        cloze.setName("Cloze");
        cloze.setCloze(true);
        cloze.setFieldNames(new String[]{"Text"});
        cloze.setFrontFields(new String[]{"Text"});
        cloze.setBackFields(new String[0]);

        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.of(deck()));
        when(noteTypeRepository.findAllByDeckId(deckId)).thenReturn(new ArrayList<>(List.of(cloze)));
        when(noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId)).thenReturn(new ArrayList<>());

        UpdateDeckContentsRequest req = new UpdateDeckContentsRequest(
                "Deck",
                List.of(),
                List.of(new NoteEntry(null, null, Map.of("Front", "q", "Back", "a"), List.of(), null, null)));

        service.replaceDeckContents(USER, deckId, req);

        // A Basic Front/Back type was created for the orphan card.
        ArgumentCaptor<NoteType> typeCaptor = ArgumentCaptor.forClass(NoteType.class);
        verify(noteTypeRepository).save(typeCaptor.capture());
        NoteType created = typeCaptor.getValue();
        assertThat(created.getName()).isEqualTo("Basic");
        assertThat(created.getFieldNames()).containsExactly("Front", "Back");

        List<Note> saved = captureSaveAll();
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getNoteTypeId()).isEqualTo(created.getId());
    }

    @Test
    void replace_appliesFrontBackLayoutSwap() {
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.of(deck()));
        when(noteTypeRepository.findAllByDeckId(deckId)).thenReturn(new ArrayList<>(List.of(basicType())));
        when(noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId)).thenReturn(new ArrayList<>());

        UpdateDeckContentsRequest req = new UpdateDeckContentsRequest(
                "Deck",
                List.of(new NoteTypeLayout(typeId, List.of("Back"), List.of("Front"))),
                List.of());

        service.replaceDeckContents(USER, deckId, req);

        ArgumentCaptor<NoteType> typeCaptor = ArgumentCaptor.forClass(NoteType.class);
        verify(noteTypeRepository).save(typeCaptor.capture());
        NoteType swapped = typeCaptor.getValue();
        assertThat(swapped.getFrontFields()).containsExactly("Back");
        assertThat(swapped.getBackFields()).containsExactly("Front");
        verify(noteRepository, never()).deleteAll(any());
    }

    @Test
    void replace_throwsNotFound_whenDeckNotOwned() {
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.empty());

        UpdateDeckContentsRequest req = new UpdateDeckContentsRequest("x", List.of(), List.of());
        assertThatThrownBy(() -> service.replaceDeckContents(USER, deckId, req))
                .isInstanceOf(NotFoundException.class);
    }
}
