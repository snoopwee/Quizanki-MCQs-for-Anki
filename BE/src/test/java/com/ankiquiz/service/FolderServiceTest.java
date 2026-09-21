package com.ankiquiz.service;

import com.ankiquiz.dto.response.DeckResponse;
import com.ankiquiz.dto.response.FolderDetailResponse;
import com.ankiquiz.dto.response.FolderResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Folder;
import com.ankiquiz.entity.FolderDeck;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.FolderDeckRepository;
import com.ankiquiz.repository.FolderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
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

/**
 * Folders. The security-shaped assertions matter most: a folder is only ever reached with its
 * owner, and a deck can only be filed if the caller may actually study it.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FolderServiceTest {

    private static final String USER = "user-1";
    private static final String STRANGER = "user-2";

    @Mock private FolderRepository folders;
    @Mock private FolderDeckRepository folderDecks;
    @Mock private DeckRepository deckRepository;
    @Mock private DeckService deckService;

    private final Clock clock = Clock.fixed(Instant.parse("2026-09-21T09:00:00Z"), ZoneOffset.UTC);
    private FolderService service;

    private final UUID folderId = UUID.randomUUID();
    private final UUID deckId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new FolderService(folders, folderDecks, deckRepository, deckService, clock);
    }

    private Folder folder(String owner, String name) {
        Folder f = new Folder();
        f.setId(folderId);
        f.setUserId(owner);
        f.setName(name);
        f.setUpdatedAt(OffsetDateTime.now(clock));
        return f;
    }

    private void folderExists(String owner) {
        when(folders.findByIdAndUserId(folderId, owner)).thenReturn(Optional.of(folder(owner, "Japanese")));
    }

    private void deckIsStudiable() {
        when(deckRepository.findStudiable(eq(deckId), anyString())).thenReturn(Optional.of(new Deck()));
    }

    @Test
    void listsFoldersWithTheirDeckCounts() {
        Folder a = folder(USER, "Japanese");
        when(folders.findAllByUserIdOrderByNameAsc(USER)).thenReturn(List.of(a));
        when(folderDecks.countByFolderIds(any())).thenReturn(List.<Object[]>of(new Object[]{folderId, 3L}));

        List<FolderResponse> list = service.list(USER);

        assertThat(list).hasSize(1);
        assertThat(list.get(0).name()).isEqualTo("Japanese");
        assertThat(list.get(0).deckCount()).isEqualTo(3);
    }

    @Test
    void anEmptyFolderCountsZeroRatherThanVanishing() {
        when(folders.findAllByUserIdOrderByNameAsc(USER)).thenReturn(List.of(folder(USER, "Empty")));
        when(folderDecks.countByFolderIds(any())).thenReturn(List.of());

        assertThat(service.list(USER).get(0).deckCount()).isZero();
    }

    @Test
    void whenAskedAboutOneDeckEachFolderSaysWhetherItHoldsIt() {
        UUID otherFolder = UUID.randomUUID();
        Folder holding = folder(USER, "Japanese");
        Folder empty = new Folder();
        empty.setId(otherFolder);
        empty.setUserId(USER);
        empty.setName("Spanish");
        when(folders.findAllByUserIdOrderByNameAsc(USER)).thenReturn(List.of(holding, empty));
        when(folderDecks.countByFolderIds(any())).thenReturn(List.of());
        FolderDeck filing = new FolderDeck();
        filing.setFolderId(folderId);
        filing.setDeckId(deckId);
        when(folderDecks.findAllByDeckId(deckId)).thenReturn(List.of(filing));

        List<FolderResponse> list = service.list(USER, deckId);

        assertThat(list).extracting(FolderResponse::containsDeck).containsExactly(true, false);
    }

    @Test
    void aPlainListDoesNotClaimToHoldAnything() {
        when(folders.findAllByUserIdOrderByNameAsc(USER)).thenReturn(List.of(folder(USER, "Japanese")));
        when(folderDecks.countByFolderIds(any())).thenReturn(List.of());

        assertThat(service.list(USER).get(0).containsDeck()).isFalse();
        // No deck asked about ⇒ no reason to query the join table at all.
        verify(folderDecks, never()).findAllByDeckId(any());
    }

    @Test
    void createTrimsTheNameAndStartsEmpty() {
        FolderResponse created = service.create(USER, "  Japanese  ");

        ArgumentCaptor<Folder> saved = ArgumentCaptor.forClass(Folder.class);
        verify(folders).save(saved.capture());
        assertThat(saved.getValue().getName()).isEqualTo("Japanese");
        assertThat(saved.getValue().getUserId()).isEqualTo(USER);
        assertThat(created.deckCount()).isZero();
    }

    @Test
    void refusesADuplicateName() {
        when(folders.existsByUserIdAndName(USER, "Japanese")).thenReturn(true);

        assertThatThrownBy(() -> service.create(USER, "Japanese"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("already have a folder");

        verify(folders, never()).save(any());
    }

    @Test
    void refusesABlankName() {
        assertThatThrownBy(() -> service.create(USER, "   ")).isInstanceOf(ConflictException.class);
        verify(folders, never()).save(any());
    }

    @Test
    void renamingToItsOwnNameIsAllowed() {
        folderExists(USER);
        when(folders.existsByUserIdAndName(USER, "Japanese")).thenReturn(true);

        assertThat(service.rename(USER, folderId, "Japanese").name()).isEqualTo("Japanese");
    }

    @Test
    void renamingOntoAnotherFoldersNameIsRefused() {
        folderExists(USER);
        when(folders.existsByUserIdAndName(USER, "Kanji")).thenReturn(true);

        assertThatThrownBy(() -> service.rename(USER, folderId, "Kanji"))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void someoneElsesFolderIsNotFound_notForbidden() {
        // Nothing should confirm that another user's folder id exists.
        when(folders.findByIdAndUserId(folderId, STRANGER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(STRANGER, folderId)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.rename(STRANGER, folderId, "Mine")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.delete(STRANGER, folderId)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.addDeck(STRANGER, folderId, deckId)).isInstanceOf(NotFoundException.class);
        verify(folderDecks, never()).save(any());
    }

    @Test
    void filesADeckTheCallerCanStudy() {
        folderExists(USER);
        deckIsStudiable();

        service.addDeck(USER, folderId, deckId);

        ArgumentCaptor<FolderDeck> filing = ArgumentCaptor.forClass(FolderDeck.class);
        verify(folderDecks).save(filing.capture());
        assertThat(filing.getValue().getFolderId()).isEqualTo(folderId);
        assertThat(filing.getValue().getDeckId()).isEqualTo(deckId);
    }

    @Test
    void refusesToFileADeckTheCallerCannotStudy() {
        folderExists(USER);
        when(deckRepository.findStudiable(eq(deckId), anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.addDeck(USER, folderId, deckId))
                .isInstanceOf(NotFoundException.class);

        verify(folderDecks, never()).save(any());
    }

    @Test
    void removingADeckLeavesTheDeckAlone() {
        folderExists(USER);

        service.removeDeck(USER, folderId, deckId);

        verify(folderDecks).deleteByFolderIdAndDeckId(folderId, deckId);
        verify(deckRepository, never()).delete(any());
    }

    @Test
    void deletingAFolderDoesNotDeleteItsDecks() {
        folderExists(USER);

        service.delete(USER, folderId);

        verify(folders).delete(any(Folder.class));
        verify(deckRepository, never()).delete(any());
    }

    @Test
    void aFoldersContentsComeBackInFilingOrder() {
        folderExists(USER);
        UUID second = UUID.randomUUID();
        FolderDeck a = new FolderDeck();
        a.setFolderId(folderId);
        a.setDeckId(deckId);
        FolderDeck b = new FolderDeck();
        b.setFolderId(folderId);
        b.setDeckId(second);
        when(folderDecks.findAllByFolderIdOrderByAddedAtDesc(folderId)).thenReturn(List.of(a, b));
        when(deckService.getDecksByIds(eq(USER), eq(List.of(deckId, second)))).thenReturn(List.of());

        FolderDetailResponse detail = service.get(USER, folderId);

        assertThat(detail.name()).isEqualTo("Japanese");
        verify(deckService).getDecksByIds(USER, List.of(deckId, second));
        assertThat(detail.decks()).isEmpty();
    }

    @Test
    void theDecksInAFolderKeepTheirNormalShape() {
        folderExists(USER);
        FolderDeck filing = new FolderDeck();
        filing.setFolderId(folderId);
        filing.setDeckId(deckId);
        when(folderDecks.findAllByFolderIdOrderByAddedAtDesc(folderId)).thenReturn(List.of(filing));
        DeckResponse deck = new DeckResponse(deckId, "Kanji", null, null, 10,
                OffsetDateTime.now(clock), 42.0, null, null, false, "author", "Author", null, null);
        when(deckService.getDecksByIds(any(), any())).thenReturn(List.of(deck));

        assertThat(service.get(USER, folderId).decks()).containsExactly(deck);
    }
}
