package com.ankiquiz.service;

import com.ankiquiz.dto.request.UpdateDeckContentsRequest;
import com.ankiquiz.dto.request.UpdateDeckContentsRequest.NoteEntry;
import com.ankiquiz.dto.request.UpdateDeckContentsRequest.NoteTypeLayout;
import com.ankiquiz.dto.response.DeckContentsResponse;
import com.ankiquiz.dto.response.DeckResponse;
import com.ankiquiz.dto.response.PublicDeckPage;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Note;
import com.ankiquiz.entity.NoteType;
import com.ankiquiz.entity.UserDeck;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import com.ankiquiz.repository.NoteTypeRepository;
import com.ankiquiz.repository.UserDeckRepository;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.OffsetDateTime;
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
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DeckServiceTest {

    private static final String USER = "user-1";
    private static final String OTHER_USER = "user-2";
    private static final Caller CALLER = new Caller(USER, "Alice", null);
    private static final Caller OTHER_CALLER = new Caller(OTHER_USER, "Bob", null);

    @Mock private DeckRepository deckRepository;
    @Mock private NoteTypeRepository noteTypeRepository;
    @Mock private NoteRepository noteRepository;
    @Mock private UserDeckRepository userDeckRepository;
    @Mock private EntityManager entityManager;
    @Mock private Query query;

    private DeckService service;

    private final UUID deckId = UUID.randomUUID();
    private final UUID typeId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new DeckService(deckRepository, noteTypeRepository, noteRepository,
                userDeckRepository, entityManager);
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
        // The trailing getDeckContents() completion query (now bound with both
        // deckId and the viewer's userId).
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(0.0);
    }

    // A deck USER both owns and is credited for — the ordinary case.
    private Deck deck() {
        Deck d = new Deck();
        d.setId(deckId);
        d.setUserId(USER);
        d.setName("Old name");
        d.setAuthorId(USER);
        d.setAuthorName("Alice");
        return d;
    }

    // A deck OTHER_USER owns but hasn't made their own yet: taken from USER, so
    // it still credits USER. This is what the share gate and the authorship
    // hand-over are about.
    private Deck untouchedCopy() {
        Deck d = new Deck();
        d.setId(deckId);
        d.setUserId(OTHER_USER);
        d.setName("Old name");
        d.setAuthorId(USER);
        d.setAuthorName("Alice");
        d.setSourceAuthorName("Alice");
        d.setCloneSourceDeckId(UUID.randomUUID());
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

        service.replaceDeckContents(CALLER, deckId, req);

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

        service.replaceDeckContents(CALLER, deckId, req);

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

        service.replaceDeckContents(CALLER, deckId, req);

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

        service.replaceDeckContents(CALLER, deckId, req);

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
        assertThatThrownBy(() -> service.replaceDeckContents(CALLER, deckId, req))
                .isInstanceOf(NotFoundException.class);
    }

    // ── sharing ──────────────────────────────────────────────────────────────

    @Test
    void setDeckSharing_on_setsIsPublicAndStampsSharedAt() {
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.of(deck()));
        when(deckRepository.save(any(Deck.class))).thenAnswer(inv -> inv.getArgument(0));

        DeckResponse response = service.setDeckSharing(USER, deckId, true);

        assertThat(response.isPublic()).isTrue();
        ArgumentCaptor<Deck> captor = ArgumentCaptor.forClass(Deck.class);
        verify(deckRepository).save(captor.capture());
        assertThat(captor.getValue().isPublic()).isTrue();
        assertThat(captor.getValue().getSharedAt()).isNotNull();
    }

    @Test
    void setDeckSharing_off_clearsSharedAt() {
        Deck shared = deck();
        shared.setPublic(true);
        shared.setSharedAt(OffsetDateTime.now());
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.of(shared));
        when(deckRepository.save(any(Deck.class))).thenAnswer(inv -> inv.getArgument(0));

        DeckResponse response = service.setDeckSharing(USER, deckId, false);

        assertThat(response.isPublic()).isFalse();
        assertThat(shared.getSharedAt()).isNull();
    }

    @Test
    void setDeckSharing_throwsNotFound_whenDeckNotOwned() {
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.setDeckSharing(USER, deckId, true))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void getPublicDeckContents_returnsContents_whenShared() {
        Deck shared = deck();
        shared.setPublic(true);
        when(deckRepository.findById(deckId)).thenReturn(Optional.of(shared));
        when(noteTypeRepository.findAllByDeckId(deckId)).thenReturn(List.of(basicType()));
        when(noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId))
                .thenReturn(List.of(existingNote(UUID.randomUUID(), 0)));

        DeckContentsResponse contents = service.getPublicDeckContents(deckId);

        assertThat(contents.id()).isEqualTo(deckId);
        assertThat(contents.isPublic()).isTrue();
        assertThat(contents.noteTypes()).hasSize(1);
        assertThat(contents.noteTypes().get(0).notes()).hasSize(1);
    }

    @Test
    void getPublicDeckContents_throwsNotFound_whenDeckIsPrivate() {
        when(deckRepository.findById(deckId)).thenReturn(Optional.of(deck())); // isPublic = false

        assertThatThrownBy(() -> service.getPublicDeckContents(deckId))
                .isInstanceOf(NotFoundException.class);
    }

    // ── cloning ──────────────────────────────────────────────────────────────

    @Test
    void cloneDeck_copiesSharedDeckToCaller_withoutTouchingTheSource() {
        Deck source = deck();
        source.setPublic(true);
        source.setSourceFilename("n4.apkg");
        source.setFrontLang("ja");
        source.setBackLang("en");
        when(deckRepository.findStudiable(deckId, OTHER_USER)).thenReturn(Optional.of(source));
        when(noteTypeRepository.findAllByDeckId(deckId)).thenReturn(List.of(basicType()));
        when(noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId))
                .thenReturn(List.of(existingNote(UUID.randomUUID(), 0), existingNote(UUID.randomUUID(), 1)));
        when(deckRepository.save(any(Deck.class))).thenAnswer(inv -> {
            Deck d = inv.getArgument(0);
            if (d.getId() == null) {
                d.setId(UUID.randomUUID());
            }
            return d;
        });

        DeckResponse clone = service.cloneDeck(OTHER_CALLER, deckId);

        ArgumentCaptor<Deck> deckCaptor = ArgumentCaptor.forClass(Deck.class);
        verify(deckRepository).save(deckCaptor.capture());
        Deck saved = deckCaptor.getValue();
        assertThat(saved).isNotSameAs(source);
        assertThat(saved.getUserId()).isEqualTo(OTHER_USER);
        assertThat(saved.getName()).isEqualTo(source.getName());
        assertThat(saved.getCardCount()).isEqualTo(2);
        assertThat(saved.getFrontLang()).isEqualTo("ja");
        assertThat(saved.getCloneSourceDeckId()).isEqualTo(deckId);
        // A copy is private until its new owner shares it, and starts at zero
        // progress (no card_stats are carried over).
        assertThat(saved.isPublic()).isFalse();
        assertThat(clone.completion()).isZero();

        // Notes were re-created under the clone, not re-pointed.
        List<Note> clonedNotes = captureSaveAll();
        assertThat(clonedNotes).hasSize(2);
        assertThat(clonedNotes).allSatisfy(n -> {
            assertThat(n.getId()).isNull();
            assertThat(n.getDeckId()).isEqualTo(saved.getId());
        });

        // The source deck itself is never written.
        assertThat(source.isPublic()).isTrue();
        assertThat(source.getUserId()).isEqualTo(USER);
    }

    @Test
    void cloneDeck_allowsOwnerToDuplicateTheirOwnPrivateDeck() {
        Deck source = deck(); // private, owned by USER
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.of(source));
        when(noteTypeRepository.findAllByDeckId(deckId)).thenReturn(List.of(basicType()));
        when(noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId))
                .thenReturn(List.of(existingNote(UUID.randomUUID(), 0)));
        when(deckRepository.save(any(Deck.class))).thenAnswer(inv -> {
            Deck d = inv.getArgument(0);
            if (d.getId() == null) {
                d.setId(UUID.randomUUID());
            }
            return d;
        });

        DeckResponse clone = service.cloneDeck(CALLER, deckId);

        assertThat(clone.id()).isNotEqualTo(deckId);
        assertThat(clone.cardCount()).isEqualTo(1);
    }

    @Test
    void cloneDeck_throwsNotFound_whenSourceIsPrivateAndNotTheCallers() {
        when(deckRepository.findById(deckId)).thenReturn(Optional.of(deck())); // private, USER's

        assertThatThrownBy(() -> service.cloneDeck(OTHER_CALLER, deckId))
                .isInstanceOf(NotFoundException.class);
        verify(deckRepository, never()).save(any(Deck.class));
    }

    @Test
    void cloneDeck_keepsCreditingTheSourcesAuthor() {
        Deck source = deck();
        source.setPublic(true);
        when(deckRepository.findStudiable(deckId, OTHER_USER)).thenReturn(Optional.of(source));
        when(noteTypeRepository.findAllByDeckId(deckId)).thenReturn(List.of(basicType()));
        when(noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId))
                .thenReturn(List.of(existingNote(UUID.randomUUID(), 0)));
        when(deckRepository.save(any(Deck.class))).thenAnswer(inv -> {
            Deck d = inv.getArgument(0);
            if (d.getId() == null) {
                d.setId(UUID.randomUUID());
            }
            return d;
        });

        DeckResponse clone = service.cloneDeck(OTHER_CALLER, deckId);

        // Taking a deck isn't authorship: Bob owns the copy, Alice keeps the credit.
        assertThat(clone.authorId()).isEqualTo(USER);
        assertThat(clone.authorName()).isEqualTo("Alice");
        assertThat(clone.sourceAuthorName()).isEqualTo("Alice");
        assertThat(clone.isPublic()).isFalse();
    }

    // ── authorship hand-over ─────────────────────────────────────────────────

    private UpdateDeckContentsRequest keepAllUnchanged(UUID noteId, String name) {
        return new UpdateDeckContentsRequest(
                name, List.of(),
                List.of(new NoteEntry(noteId, typeId, Map.of("Front", "f0", "Back", "b0"),
                        List.of(), null, null)));
    }

    private void stubUntouchedCopyWithOneNote(UUID noteId) {
        when(deckRepository.findByIdAndUserId(deckId, OTHER_USER)).thenReturn(Optional.of(untouchedCopy()));
        when(noteTypeRepository.findAllByDeckId(deckId)).thenReturn(List.of(basicType()));
        when(noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId))
                .thenReturn(new ArrayList<>(List.of(existingNote(noteId, 0))));
        when(deckRepository.save(any(Deck.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private Deck captureSavedDeck() {
        ArgumentCaptor<Deck> captor = ArgumentCaptor.forClass(Deck.class);
        verify(deckRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void replace_transfersAuthorship_whenACopiesCardIsEdited() {
        UUID noteId = UUID.randomUUID();
        stubUntouchedCopyWithOneNote(noteId);

        UpdateDeckContentsRequest req = new UpdateDeckContentsRequest(
                "Old name", List.of(),
                List.of(new NoteEntry(noteId, typeId, Map.of("Front", "EDITED", "Back", "b0"),
                        List.of(), null, null)));
        service.replaceDeckContents(OTHER_CALLER, deckId, req);

        Deck saved = captureSavedDeck();
        assertThat(saved.getAuthorId()).isEqualTo(OTHER_USER);
        assertThat(saved.getAuthorName()).isEqualTo("Bob");
        // The lineage stays visible — "by Bob · Original deck by Alice".
        assertThat(saved.getSourceAuthorName()).isEqualTo("Alice");
    }

    @Test
    void replace_transfersAuthorship_whenACardIsAdded() {
        UUID noteId = UUID.randomUUID();
        stubUntouchedCopyWithOneNote(noteId);

        UpdateDeckContentsRequest req = new UpdateDeckContentsRequest(
                "Old name", List.of(),
                List.of(new NoteEntry(noteId, typeId, Map.of("Front", "f0", "Back", "b0"), List.of(), null, null),
                        new NoteEntry(null, typeId, Map.of("Front", "new", "Back", "card"), List.of(), null, null)));
        service.replaceDeckContents(OTHER_CALLER, deckId, req);

        assertThat(captureSavedDeck().getAuthorId()).isEqualTo(OTHER_USER);
    }

    @Test
    void replace_transfersAuthorship_whenACardIsDeleted() {
        UUID noteId = UUID.randomUUID();
        stubUntouchedCopyWithOneNote(noteId);

        // Empty payload = the one card was removed.
        service.replaceDeckContents(OTHER_CALLER, deckId,
                new UpdateDeckContentsRequest("Old name", List.of(), List.of()));

        assertThat(captureSavedDeck().getAuthorId()).isEqualTo(OTHER_USER);
    }

    @Test
    void replace_doesNotTransferAuthorship_whenNothingChanged() {
        UUID noteId = UUID.randomUUID();
        stubUntouchedCopyWithOneNote(noteId);

        service.replaceDeckContents(OTHER_CALLER, deckId, keepAllUnchanged(noteId, "Old name"));

        assertThat(captureSavedDeck().getAuthorId()).isEqualTo(USER);
    }

    @Test
    void replace_doesNotTransferAuthorship_onARenameAlone() {
        UUID noteId = UUID.randomUUID();
        stubUntouchedCopyWithOneNote(noteId);

        // Renaming isn't new work — the cards are untouched, so Alice keeps credit.
        service.replaceDeckContents(OTHER_CALLER, deckId, keepAllUnchanged(noteId, "My version"));

        Deck saved = captureSavedDeck();
        assertThat(saved.getName()).isEqualTo("My version");
        assertThat(saved.getAuthorId()).isEqualTo(USER);
        assertThat(saved.getAuthorName()).isEqualTo("Alice");
    }

    @Test
    void replace_refreshesTheAuthorsOwnDisplayName() {
        UUID noteId = UUID.randomUUID();
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.of(deck()));
        when(noteTypeRepository.findAllByDeckId(deckId)).thenReturn(List.of(basicType()));
        when(noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId))
                .thenReturn(new ArrayList<>(List.of(existingNote(noteId, 0))));
        when(deckRepository.save(any(Deck.class))).thenAnswer(inv -> inv.getArgument(0));

        // Same author, but they've since renamed themselves in their profile.
        service.replaceDeckContents(new Caller(USER, "Alice Renamed", null), deckId,
                new UpdateDeckContentsRequest("Old name", List.of(),
                        List.of(new NoteEntry(noteId, typeId, Map.of("Front", "EDITED", "Back", "b0"),
                                List.of(), null, null))));

        assertThat(captureSavedDeck().getAuthorName()).isEqualTo("Alice Renamed");
    }

    @Test
    void setDeckSharing_rejectsPublishingAnUntouchedCopy() {
        when(deckRepository.findByIdAndUserId(deckId, OTHER_USER)).thenReturn(Optional.of(untouchedCopy()));

        assertThatThrownBy(() -> service.setDeckSharing(OTHER_USER, deckId, true))
                .isInstanceOf(ConflictException.class);
        verify(deckRepository, never()).save(any(Deck.class));
    }

    @Test
    void setDeckSharing_allowsUnsharingEvenWhenNotTheAuthor() {
        Deck copy = untouchedCopy();
        copy.setPublic(true);
        when(deckRepository.findByIdAndUserId(deckId, OTHER_USER)).thenReturn(Optional.of(copy));
        when(deckRepository.save(any(Deck.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThat(service.setDeckSharing(OTHER_USER, deckId, false).isPublic()).isFalse();
    }

    // ── discover ─────────────────────────────────────────────────────────────

    private Page<Deck> pageOf(List<Deck> decks, int pageSize, long total) {
        return new PageImpl<>(decks, PageRequest.of(0, pageSize), total);
    }

    @Test
    void getPublicDecks_mapsRows_capsThePageSize_andReportsTheTotal() {
        Deck shared = deck();
        shared.setPublic(true);
        shared.setCardCount(12);
        shared.setSharedAt(OffsetDateTime.now());
        when(deckRepository.findPublicDecks(eq("jlpt"), eq(20), eq(50), any(Pageable.class)))
                .thenReturn(pageOf(List.of(shared), 60, 130));

        PublicDeckPage result = service.getPublicDecks("  jlpt  ", 20, 50, 500, 0);

        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).name()).isEqualTo("Old name");
        assertThat(result.total()).isEqualTo(130);

        // The query is trimmed, the card-count filter is passed through, and a
        // hand-crafted ?limit= can't ask for the whole directory.
        ArgumentCaptor<Pageable> pageCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(deckRepository).findPublicDecks(eq("jlpt"), eq(20), eq(50), pageCaptor.capture());
        assertThat(pageCaptor.getValue().getPageSize()).isLessThanOrEqualTo(60);
        assertThat(result.pageSize()).isLessThanOrEqualTo(60);
    }

    @Test
    void getPublicDecks_translatesRowOffsetToAPageIndex() {
        when(deckRepository.findPublicDecks(eq(""), isNull(), isNull(), any(Pageable.class)))
                .thenReturn(pageOf(List.of(), 12, 0));

        // offset 24 at page size 12 is the third page (index 2).
        service.getPublicDecks(null, null, null, 12, 24);

        ArgumentCaptor<Pageable> pageCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(deckRepository).findPublicDecks(eq(""), isNull(), isNull(), pageCaptor.capture());
        assertThat(pageCaptor.getValue().getPageNumber()).isEqualTo(2);
    }

    @Test
    void getAuthorPage_listsPublicDecks_andTakesTheNameFromThem() {
        Deck a = deck();
        a.setPublic(true);
        a.setSharedAt(OffsetDateTime.now());
        when(deckRepository.findPublicByAuthor("alice")).thenReturn(List.of(a));

        var page = service.getAuthorPage("alice");

        assertThat(page.authorId()).isEqualTo("alice");
        assertThat(page.authorName()).isEqualTo("Alice"); // from the deck's author_name
        assertThat(page.deckCount()).isEqualTo(1);
        assertThat(page.decks().get(0).authorId()).isEqualTo(USER); // deck()'s authorId
    }

    @Test
    void getAuthorPage_isEmpty_whenTheAuthorHasNoPublicDecks() {
        when(deckRepository.findPublicByAuthor("nobody")).thenReturn(List.of());

        var page = service.getAuthorPage("nobody");

        assertThat(page.authorName()).isNull();
        assertThat(page.deckCount()).isZero();
        assertThat(page.decks()).isEmpty();
    }

    @Test
    void getPublicDecks_treatsANullQueryAsMatchEverything() {
        when(deckRepository.findPublicDecks(eq(""), isNull(), isNull(), any(Pageable.class)))
                .thenReturn(pageOf(List.of(), 12, 0));

        assertThat(service.getPublicDecks(null, null, null, 24, 0).items()).isEmpty();
        verify(deckRepository).findPublicDecks(eq(""), isNull(), isNull(), any(Pageable.class));
    }

    // ── library: open (Recent) + save (bookmark) ─────────────────────────────

    @Test
    void openDeck_stampsLastOpened_onAStudiableDeck() {
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.of(deck()));
        when(userDeckRepository.findByUserIdAndDeckId(USER, deckId)).thenReturn(Optional.empty());
        when(userDeckRepository.save(any(UserDeck.class))).thenAnswer(inv -> inv.getArgument(0));

        service.openDeck(USER, deckId);

        ArgumentCaptor<UserDeck> captor = ArgumentCaptor.forClass(UserDeck.class);
        verify(userDeckRepository).save(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo(USER);
        assertThat(captor.getValue().getDeckId()).isEqualTo(deckId);
        assertThat(captor.getValue().getLastOpenedAt()).isNotNull();
    }

    @Test
    void openDeck_throwsNotFound_whenNotStudiable_andRecordsNothing() {
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.openDeck(USER, deckId)).isInstanceOf(NotFoundException.class);
        verify(userDeckRepository, never()).save(any());
    }

    @Test
    void setSaved_bookmarksAStudiableDeck() {
        // A visitor saving someone else's public deck.
        when(deckRepository.findStudiable(deckId, OTHER_USER)).thenReturn(Optional.of(deck()));
        when(userDeckRepository.findByUserIdAndDeckId(OTHER_USER, deckId)).thenReturn(Optional.empty());
        when(userDeckRepository.save(any(UserDeck.class))).thenAnswer(inv -> inv.getArgument(0));

        service.setSaved(OTHER_USER, deckId, true);

        ArgumentCaptor<UserDeck> captor = ArgumentCaptor.forClass(UserDeck.class);
        verify(userDeckRepository).save(captor.capture());
        assertThat(captor.getValue().isSaved()).isTrue();
    }

    @Test
    void setSaved_throwsNotFound_whenNotStudiable() {
        when(deckRepository.findStudiable(deckId, OTHER_USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.setSaved(OTHER_USER, deckId, true))
                .isInstanceOf(NotFoundException.class);
        verify(userDeckRepository, never()).save(any());
    }

    // ── author-profile (name + avatar) propagation ───────────────────────────

    @Test
    void syncAuthorProfile_stampsTheProvidedNameAndAvatarAcrossAuthoredDecks() {
        when(deckRepository.updateAuthorProfile(eq(USER), eq("Alice Renamed"), eq("https://cdn/a.png")))
                .thenReturn(3);

        int updated = service.syncAuthorProfile(
                new Caller(USER, "stale-jwt-name", null), "  Alice Renamed  ", "  https://cdn/a.png  ");

        assertThat(updated).isEqualTo(3);
        // The client-supplied name/avatar win (trimmed) over the JWT's, so it works
        // even before the token refreshes.
        verify(deckRepository).updateAuthorProfile(USER, "Alice Renamed", "https://cdn/a.png");
    }

    @Test
    void syncAuthorProfile_fallsBackToTheJwtNameAndAvatar_whenBlank() {
        when(deckRepository.updateAuthorProfile(eq(USER), eq("alice"), eq("https://oauth/pic.png")))
                .thenReturn(0);

        // Blank name/avatar → the (refreshed) JWT's values. This is the "removed my
        // custom photo, keep my OAuth one" case: the caller carries the OAuth avatar.
        service.syncAuthorProfile(new Caller(USER, "alice", "https://oauth/pic.png"), "   ", "  ");

        verify(deckRepository).updateAuthorProfile(USER, "alice", "https://oauth/pic.png");
    }

    @Test
    void syncAuthorProfile_clearsToNull_whenBlankAndTheJwtHasNoAvatar() {
        when(deckRepository.updateAuthorProfile(eq(USER), eq("alice"), isNull())).thenReturn(0);

        service.syncAuthorProfile(new Caller(USER, "alice", null), "   ", "  ");

        verify(deckRepository).updateAuthorProfile(USER, "alice", null);
    }

    // ── admin moderation ─────────────────────────────────────────────────────

    @Test
    void adminUnpublishDeck_takesItOffDiscover_withoutDeleting() {
        Deck deck = deck();
        deck.setPublic(true);
        deck.setSharedAt(OffsetDateTime.now());
        when(deckRepository.findById(deckId)).thenReturn(Optional.of(deck));

        service.adminUnpublishDeck(deckId);

        assertThat(deck.isPublic()).isFalse();
        assertThat(deck.getSharedAt()).isNull();
        verify(deckRepository).save(deck);
        verify(deckRepository, never()).delete(any());
    }

    @Test
    void adminDeleteDeck_removesTheDeck() {
        Deck deck = deck();
        when(deckRepository.findById(deckId)).thenReturn(Optional.of(deck));

        service.adminDeleteDeck(deckId);

        verify(deckRepository).delete(deck);
    }

    @Test
    void adminModeration_404sWhenTheDeckIsMissing() {
        when(deckRepository.findById(deckId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.adminUnpublishDeck(deckId)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.adminDeleteDeck(deckId)).isInstanceOf(NotFoundException.class);
    }
}
