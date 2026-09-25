package com.ankiquiz.service;

import com.ankiquiz.dto.response.DeckResponse;
import com.ankiquiz.dto.response.FolderDetailResponse;
import com.ankiquiz.dto.response.FolderResponse;
import com.ankiquiz.entity.Folder;
import com.ankiquiz.entity.FolderDeck;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.FolderDeckRepository;
import com.ankiquiz.repository.FolderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Folders — the viewer's own grouping over decks they own or saved.
 *
 * Two rules hold throughout: a folder is only ever reached WITH its owner (never by id alone), and
 * a deck can only be filed if the caller may study it. Filing changes nothing for the deck's owner.
 */
@Service
public class FolderService {

    private final FolderRepository folders;
    private final FolderDeckRepository folderDecks;
    private final DeckRepository deckRepository;
    private final DeckService deckService;
    private final Clock clock;

    public FolderService(
            FolderRepository folders,
            FolderDeckRepository folderDecks,
            DeckRepository deckRepository,
            DeckService deckService,
            Clock clock
    ) {
        this.folders = folders;
        this.folderDecks = folderDecks;
        this.deckRepository = deckRepository;
        this.deckService = deckService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<FolderResponse> list(String userId) {
        return list(userId, null);
    }

    /**
     * @param deckId when given, each folder also reports whether it already holds that deck — one
     *               call for the deck page's folder picker, instead of one per folder.
     */
    @Transactional(readOnly = true)
    public List<FolderResponse> list(String userId, UUID deckId) {
        List<Folder> owned = folders.findAllByUserIdOrderByNameAsc(userId);
        if (owned.isEmpty()) {
            return List.of();
        }
        Map<UUID, Integer> counts = countsFor(owned.stream().map(Folder::getId).toList());
        Set<UUID> holdingDeck = deckId == null
                ? Set.of()
                : folderDecks.findAllByDeckId(deckId).stream()
                        .map(FolderDeck::getFolderId)
                        .collect(Collectors.toSet());

        return owned.stream()
                .map(f -> new FolderResponse(f.getId(), f.getName(),
                        counts.getOrDefault(f.getId(), 0), f.getUpdatedAt(),
                        holdingDeck.contains(f.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public FolderDetailResponse get(String userId, UUID folderId) {
        Folder folder = require(userId, folderId);
        List<UUID> deckIds = folderDecks.findAllByFolderIdOrderByAddedAtDesc(folderId).stream()
                .map(FolderDeck::getDeckId)
                .toList();
        List<DeckResponse> decks = deckService.getDecksByIds(userId, deckIds);
        return new FolderDetailResponse(folder.getId(), folder.getName(), decks);
    }

    @Transactional
    public FolderResponse create(String userId, String rawName) {
        String name = cleanName(rawName);
        if (folders.existsByUserIdAndName(userId, name)) {
            throw new ConflictException("You already have a folder called \"" + name + "\".");
        }
        Folder folder = new Folder();
        folder.setUserId(userId);
        folder.setName(name);
        folder.setCreatedAt(OffsetDateTime.now(clock));
        folder.setUpdatedAt(OffsetDateTime.now(clock));
        folders.save(folder);
        return new FolderResponse(folder.getId(), folder.getName(), 0, folder.getUpdatedAt(), false);
    }

    @Transactional
    public FolderResponse rename(String userId, UUID folderId, String rawName) {
        Folder folder = require(userId, folderId);
        String name = cleanName(rawName);
        if (!name.equals(folder.getName()) && folders.existsByUserIdAndName(userId, name)) {
            throw new ConflictException("You already have a folder called \"" + name + "\".");
        }
        folder.setName(name);
        folder.setUpdatedAt(OffsetDateTime.now(clock));
        folders.save(folder);
        int count = countsFor(List.of(folderId)).getOrDefault(folderId, 0);
        return new FolderResponse(folder.getId(), folder.getName(), count, folder.getUpdatedAt(), false);
    }

    /** Deletes the folder only — the decks inside it are untouched (the filings cascade away). */
    @Transactional
    public void delete(String userId, UUID folderId) {
        folders.delete(require(userId, folderId));
    }

    @Transactional
    public void addDeck(String userId, UUID folderId, UUID deckId) {
        Folder folder = require(userId, folderId);
        // Studiable = owned or public. Filing a deck you can't open would make a folder row that
        // silently renders nothing.
        deckRepository.findStudiable(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));

        FolderDeck filing = new FolderDeck();
        filing.setFolderId(folderId);
        filing.setDeckId(deckId);
        filing.setAddedAt(OffsetDateTime.now(clock));
        // save() upserts on the composite key, so filing a deck twice is a no-op rather than a 500.
        folderDecks.save(filing);

        folder.setUpdatedAt(OffsetDateTime.now(clock));
        folders.save(folder);
    }

    @Transactional
    public void removeDeck(String userId, UUID folderId, UUID deckId) {
        Folder folder = require(userId, folderId);
        folderDecks.deleteByFolderIdAndDeckId(folderId, deckId);
        folder.setUpdatedAt(OffsetDateTime.now(clock));
        folders.save(folder);
    }

    private Folder require(String userId, UUID folderId) {
        // Not-found rather than forbidden: someone else's folder id shouldn't be confirmable.
        return folders.findByIdAndUserId(folderId, userId)
                .orElseThrow(() -> new NotFoundException("Folder not found: " + folderId));
    }

    private Map<UUID, Integer> countsFor(List<UUID> folderIds) {
        Map<UUID, Integer> counts = new HashMap<>();
        for (Object[] row : folderDecks.countByFolderIds(folderIds)) {
            counts.put((UUID) row[0], ((Number) row[1]).intValue());
        }
        return counts;
    }

    private static String cleanName(String rawName) {
        String name = rawName == null ? "" : rawName.strip();
        if (name.isEmpty()) {
            throw new ConflictException("A folder needs a name.");
        }
        return name.length() > 60 ? name.substring(0, 60).strip() : name;
    }
}
