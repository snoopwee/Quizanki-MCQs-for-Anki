package com.ankiquiz.service;

import com.ankiquiz.dto.request.ImportDeckRequest;
import com.ankiquiz.dto.request.NoteRequest;
import com.ankiquiz.dto.request.NoteTypeRequest;
import com.ankiquiz.dto.request.UpdateDeckContentsRequest;
import com.ankiquiz.dto.response.DeckContentsResponse;
import com.ankiquiz.dto.response.DeckContentsResponse.NoteContents;
import com.ankiquiz.dto.response.DeckContentsResponse.NoteTypeContents;
import com.ankiquiz.dto.response.DeckResponse;
import com.ankiquiz.dto.response.PublicDeckSummary;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Note;
import com.ankiquiz.entity.NoteType;
import com.ankiquiz.exception.ApkgParseException;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import com.ankiquiz.repository.NoteTypeRepository;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DeckService {

    private final DeckRepository deckRepository;
    private final NoteTypeRepository noteTypeRepository;
    private final NoteRepository noteRepository;
    private final EntityManager entityManager;

    public DeckService(DeckRepository deckRepository,
                       NoteTypeRepository noteTypeRepository,
                       NoteRepository noteRepository,
                       EntityManager entityManager) {
        this.deckRepository = deckRepository;
        this.noteTypeRepository = noteTypeRepository;
        this.noteRepository = noteRepository;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public List<DeckResponse> getDecksForUser(String userId) {
        List<Deck> decks = deckRepository.findAllByUserIdOrderByImportedAtDesc(userId);
        if (decks.isEmpty()) {
            return List.of();
        }
        Map<UUID, Double> completion = completionByDeckForUser(userId);
        return decks.stream()
                .map(d -> DeckResponse.from(d, completion.getOrDefault(d.getId(), 0.0)))
                .toList();
    }

    @Transactional
    public DeckResponse renameDeck(String userId, UUID deckId, String name) {
        Deck deck = deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        deck.setName(name.trim());
        Deck saved = deckRepository.save(deck);
        return DeckResponse.from(saved, completionForDeck(deckId));
    }

    @Transactional
    public void deleteDeck(String userId, UUID deckId) {
        Deck deck = deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        deckRepository.delete(deck);
    }

    @Transactional
    public DeckResponse importDeck(Caller caller, ImportDeckRequest request) {
        // A freshly-imported deck has no card_stats yet, so completion is 0.
        return DeckResponse.from(persistImport(caller.id(), request, Provenance.ownWork(caller)), 0.0);
    }

    /**
     * Where a deck came from and who gets the credit. Bundled because import and
     * clone differ only in these four values — an import credits the importer; a
     * copy keeps crediting the deck it came from until its new owner edits it.
     */
    private record Provenance(String authorId, String authorName, String sourceAuthorName,
                              UUID cloneSourceDeckId) {

        static Provenance ownWork(Caller caller) {
            return new Provenance(caller.id(), caller.displayName(), null, null);
        }

        static Provenance copyOf(Deck source) {
            return new Provenance(source.getAuthorId(), source.getAuthorName(),
                    source.getAuthorName(), source.getId());
        }
    }

    // Shared by import and clone: writes the deck, its note types and its notes.
    private Deck persistImport(String userId, ImportDeckRequest request, Provenance provenance) {
        int totalNotes = request.noteTypes().stream()
                .mapToInt(t -> t.notes().size())
                .sum();

        Deck deck = new Deck();
        deck.setUserId(userId);
        deck.setName(request.name());
        deck.setSubdeckPath(request.subdeckPath());
        deck.setSourceFilename(request.sourceFilename());
        deck.setCardCount(totalNotes);
        // Persist the client-detected majority language per face (null = auto).
        deck.setFrontLang(normalizeLang(request.frontLang()));
        deck.setBackLang(normalizeLang(request.backLang()));
        deck.setImportedAt(OffsetDateTime.now());
        deck.setAuthorId(provenance.authorId());
        deck.setAuthorName(provenance.authorName());
        deck.setSourceAuthorName(provenance.sourceAuthorName());
        deck.setCloneSourceDeckId(provenance.cloneSourceDeckId());
        // A MISSING isPublic means private. The review screen defaults its control
        // to public, but omission must never publish someone's deck by accident.
        boolean isPublic = Boolean.TRUE.equals(request.isPublic());
        deck.setPublic(isPublic);
        deck.setSharedAt(isPublic ? OffsetDateTime.now() : null);
        Deck savedDeck = deckRepository.save(deck);

        int position = 0;
        for (NoteTypeRequest typeReq : request.noteTypes()) {
            NoteType noteType = new NoteType();
            noteType.setDeckId(savedDeck.getId());
            noteType.setAnkiModelId(typeReq.ankiModelId());
            noteType.setName(typeReq.name());
            noteType.setCloze(typeReq.cloze());
            noteType.setFieldNames(toArray(typeReq.fieldNames()));
            noteType.setFrontFields(toArray(typeReq.frontFields()));
            noteType.setBackFields(toArray(typeReq.backFields()));
            NoteType savedType = noteTypeRepository.save(noteType);

            // Deck-global positions so the editor can reorder across note types.
            List<Note> notes = buildNotes(savedDeck.getId(), savedType.getId(), typeReq.notes(), position);
            position += notes.size();
            noteRepository.saveAll(notes);
        }

        return savedDeck;
    }

    /**
     * Turn the deck's public share link on or off (owner only). While it's on,
     * anyone holding {@code /shared/{deckId}} can preview the deck and clone it.
     * {@code shared_at} tracks when the link went live and is cleared when it's
     * switched off, so it reads as "shared since".
     */
    @Transactional
    public DeckResponse setDeckSharing(String userId, UUID deckId, boolean isPublic) {
        Deck deck = deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        // You may only publish a deck you're credited for. An untouched copy still
        // credits its original author, so republishing it would just put a second
        // identical deck in Discover — edit it first and the credit (and this
        // permission) become yours. Un-sharing is always allowed.
        if (isPublic && !userId.equals(deck.getAuthorId())) {
            throw new ConflictException(
                    "This is a copy of someone else's deck. Edit it to make it your own before sharing it.");
        }
        deck.setPublic(isPublic);
        deck.setSharedAt(isPublic ? OffsetDateTime.now() : null);
        Deck saved = deckRepository.save(deck);
        return DeckResponse.from(saved, completionForDeck(deckId));
    }

    /**
     * Read a shared deck's contents with no authentication — this backs the public
     * share page. Gated on {@code is_public}: a private (or missing) deck is a 404,
     * never a 403, so the link can't be used to probe for a deck's existence.
     *
     * <p>Note the {@code completion} it reports is the OWNER's mastery, since
     * card_stats hang off the owner's notes. The share page ignores it.
     */
    @Transactional(readOnly = true)
    public DeckContentsResponse getPublicDeckContents(UUID deckId) {
        Deck deck = deckRepository.findById(deckId)
                .filter(Deck::isPublic)
                .orElseThrow(() -> new NotFoundException("Shared deck not found: " + deckId));
        return buildContents(deck);
    }

    /**
     * The public Discover directory: every deck whose owner has shared it, newest
     * first, optionally narrowed by a name fragment. No authentication — browsing
     * is open to guests; only copying a deck requires an account.
     */
    @Transactional(readOnly = true)
    public List<PublicDeckSummary> getPublicDecks(String query, int limit, int offset) {
        int size = Math.max(1, Math.min(limit, MAX_DISCOVER_PAGE));
        // Spring Data pages by page number, so translate the caller's row offset.
        // Snapping to a page boundary keeps the contract honest for the paging the
        // client actually does (offset always a multiple of limit).
        Pageable page = PageRequest.of(Math.max(0, offset) / size, size);
        String q = query == null ? "" : query.trim();
        return deckRepository.findPublicDecks(q, page).stream()
                .map(d -> new PublicDeckSummary(
                        d.getId(),
                        d.getName(),
                        d.getCardCount(),
                        d.getAuthorName(),
                        d.getSourceAuthorName(),
                        d.getSharedAt()))
                .toList();
    }

    /** How many people have taken a copy of this deck (owner-scoped read). */
    @Transactional(readOnly = true)
    public long countCopies(String userId, UUID deckId) {
        deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        return deckRepository.countByCloneSourceDeckId(deckId);
    }

    /**
     * Copy a shared deck into the caller's own account: a brand-new deck with its
     * own notes and therefore its own progress (no card_stats are copied). The
     * source deck is left completely untouched.
     *
     * <p>Readable if the deck is shared, or if the caller already owns it (which
     * makes this a plain "duplicate"). Anything else 404s rather than 403 so a
     * private deck's existence isn't leaked by the status code.
     *
     * <p>The copy keeps crediting the source's author — taking a deck isn't
     * authorship. Credit moves to the new owner the first time they change a card.
     */
    @Transactional
    public DeckResponse cloneDeck(Caller caller, UUID sourceDeckId) {
        Deck source = deckRepository.findById(sourceDeckId)
                .filter(d -> d.isPublic() || d.getUserId().equals(caller.id()))
                .orElseThrow(() -> new NotFoundException("Shared deck not found: " + sourceDeckId));

        DeckContentsResponse contents = buildContents(source);
        ImportDeckRequest request = new ImportDeckRequest(
                contents.name(),
                contents.subdeckPath(),
                contents.sourceFilename(),
                contents.frontLang(),
                contents.backLang(),
                // A copy always starts private — see setDeckSharing.
                false,
                contents.noteTypes().stream().map(DeckService::toNoteTypeRequest).toList()
        );
        Deck clone = persistImport(caller.id(), request, Provenance.copyOf(source));
        // No card_stats are copied, so the copy starts at zero progress.
        return DeckResponse.from(clone, 0.0);
    }

    // DeckContentsResponse -> ImportDeckRequest, so a clone can reuse the import
    // writer. The field map is defensively copied: the source's is the live entity
    // map, and the two decks' notes must not share one instance.
    // Fidelity note: NoteRequest carries no per-card TTS language override (V6), so
    // a clone keeps the deck-level frontLang/backLang and drops per-card overrides.
    private static NoteTypeRequest toNoteTypeRequest(NoteTypeContents type) {
        List<NoteRequest> notes = type.notes().stream()
                .map(n -> new NoteRequest(n.ankiNoteId(), new LinkedHashMap<>(n.fields()), n.tags()))
                .toList();
        return new NoteTypeRequest(
                type.ankiModelId(),
                type.name(),
                type.cloze(),
                type.fieldNames(),
                type.frontFields(),
                type.backFields(),
                notes
        );
    }

    private static final int MAX_NOTES = 5_000;

    // Ceiling on a single Discover page, so a hand-crafted ?limit= can't ask the
    // public endpoint to serialise the whole directory.
    private static final int MAX_DISCOVER_PAGE = 60;

    /**
     * Commit the flashcard editor's whole working set in one transaction
     * (last-write-wins). Sets the name, applies front/back layout swaps to the
     * deck's note types, then reconciles the note set: notes carrying a known id
     * are updated, id-less entries are inserted, and any stored note absent from
     * the payload is deleted (its card_stats cascade away). Each note's order is
     * its index in the payload. New/unrouted cards go to a Basic (Front/Back) type.
     */
    @Transactional
    public DeckContentsResponse replaceDeckContents(Caller caller, UUID deckId, UpdateDeckContentsRequest req) {
        String userId = caller.id();
        Deck deck = deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        if (req.notes().size() > MAX_NOTES) {
            throw new ApkgParseException("Too many cards (max " + MAX_NOTES + ").");
        }
        deck.setName(req.name().trim());

        Map<UUID, NoteType> typeById = noteTypeRepository.findAllByDeckId(deckId).stream()
                .collect(Collectors.toMap(NoteType::getId, t -> t, (a, b) -> a, LinkedHashMap::new));

        // Front/back layout swaps (bulk "swap all"). Unknown ids are ignored.
        if (req.noteTypes() != null) {
            for (UpdateDeckContentsRequest.NoteTypeLayout layout : req.noteTypes()) {
                NoteType type = typeById.get(layout.id());
                if (type == null) {
                    continue;
                }
                if (layout.frontFields() != null) {
                    type.setFrontFields(layout.frontFields().toArray(String[]::new));
                }
                if (layout.backFields() != null) {
                    type.setBackFields(layout.backFields().toArray(String[]::new));
                }
                noteTypeRepository.save(type);
            }
        }

        List<Note> existing = noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId);
        Map<UUID, Note> existingById = existing.stream()
                .collect(Collectors.toMap(Note::getId, n -> n));

        Set<UUID> keptIds = new HashSet<>();
        UUID[] basicTypeId = {null}; // resolved lazily, only if a new/unrouted card appears
        List<Note> toSave = new ArrayList<>(req.notes().size());
        // Tracks whether this save actually altered the CARDS (not the deck name).
        // It's what decides whether a copied deck becomes the editor's own work —
        // see claimAuthorship below.
        boolean contentChanged = false;
        int position = 0;
        for (UpdateDeckContentsRequest.NoteEntry entry : req.notes()) {
            Note note;
            if (entry.id() != null && existingById.containsKey(entry.id())) {
                note = existingById.get(entry.id());
                keptIds.add(note.getId());
                contentChanged |= !entry.fields().equals(note.getFields());
            } else {
                note = new Note();
                note.setDeckId(deckId);
                contentChanged = true; // a card was added
            }

            UUID typeId = entry.noteTypeId();
            if (typeId == null || !typeById.containsKey(typeId)) {
                if (basicTypeId[0] == null) {
                    basicTypeId[0] = ensureBasicType(deckId, typeById);
                }
                typeId = basicTypeId[0];
            }
            note.setNoteTypeId(typeId);
            note.setFields(new LinkedHashMap<>(entry.fields()));
            note.setTags(entry.tags() == null ? new String[0] : entry.tags().toArray(String[]::new));
            // Per-face TTS language override travels with the card (blank = inherit).
            note.setFrontLang(normalizeLang(entry.frontLang()));
            note.setBackLang(normalizeLang(entry.backLang()));
            note.setPosition(position++);
            toSave.add(note);
        }
        noteRepository.saveAll(toSave);

        List<Note> toDelete = existing.stream()
                .filter(n -> !keptIds.contains(n.getId()))
                .toList();
        if (!toDelete.isEmpty()) {
            noteRepository.deleteAll(toDelete);
            contentChanged = true; // a card was removed
        }

        deck.setCardCount(req.notes().size());
        if (contentChanged) {
            claimAuthorship(deck, caller);
        }
        deckRepository.save(deck);

        return getDeckContents(userId, deckId);
    }

    /**
     * Editing a deck's cards is what turns a copy into your own work, so the
     * credit moves to whoever made the change. Deliberately driven by a real
     * content change: re-saving without touching a card, or only renaming the
     * deck, is not authorship.
     *
     * <p>For a deck you already author this just refreshes the stored display
     * name, so a later profile rename propagates on the next save.
     */
    private static void claimAuthorship(Deck deck, Caller caller) {
        if (!caller.id().equals(deck.getAuthorId())) {
            deck.setAuthorId(caller.id());
        }
        deck.setAuthorName(caller.displayName());
    }

    // The note type new/imported Front-Back cards land in. Reuse a non-cloze type
    // already shaped exactly as ["Front","Back"] (so the keys match); otherwise
    // create one. Mutates typeById so a single Save reuses the one it creates.
    private UUID ensureBasicType(UUID deckId, Map<UUID, NoteType> typeById) {
        for (NoteType t : typeById.values()) {
            String[] fields = t.getFieldNames();
            if (!t.isCloze() && fields != null && fields.length == 2
                    && "Front".equals(fields[0]) && "Back".equals(fields[1])) {
                return t.getId();
            }
        }
        NoteType basic = new NoteType();
        basic.setDeckId(deckId);
        basic.setName("Basic");
        basic.setCloze(false);
        basic.setFieldNames(new String[]{"Front", "Back"});
        basic.setFrontFields(new String[]{"Front"});
        basic.setBackFields(new String[]{"Back"});
        NoteType saved = noteTypeRepository.save(basic);
        typeById.put(saved.getId(), saved);
        return saved.getId();
    }

    @Transactional(readOnly = true)
    public DeckContentsResponse getDeckContents(String userId, UUID deckId) {
        Deck deck = deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        return buildContents(deck);
    }

    // Assemble a loaded deck's note types + notes. Access control belongs to the
    // caller — this is reached both owner-scoped and (for shared decks) unauthenticated.
    private DeckContentsResponse buildContents(Deck deck) {
        UUID deckId = deck.getId();

        List<NoteType> types = noteTypeRepository.findAllByDeckId(deckId);
        Map<UUID, List<Note>> notesByType = noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId).stream()
                .collect(Collectors.groupingBy(Note::getNoteTypeId, LinkedHashMap::new, Collectors.toList()));

        List<NoteTypeContents> typeContents = types.stream()
                .map(type -> {
                    List<NoteContents> notes = notesByType
                            .getOrDefault(type.getId(), List.of()).stream()
                            .map(DeckService::toNoteContents)
                            .toList();
                    return new NoteTypeContents(
                            type.getId(),
                            type.getAnkiModelId(),
                            type.getName(),
                            type.isCloze(),
                            toList(type.getFieldNames()),
                            toList(type.getFrontFields()),
                            toList(type.getBackFields()),
                            notes.size(),
                            notes
                    );
                })
                .toList();

        return new DeckContentsResponse(
                deck.getId(),
                deck.getName(),
                deck.getSubdeckPath(),
                deck.getSourceFilename(),
                deck.getCardCount(),
                deck.getImportedAt(),
                completionForDeck(deckId),
                deck.getFrontLang(),
                deck.getBackLang(),
                deck.isPublic(),
                deck.getAuthorId(),
                deck.getAuthorName(),
                deck.getSourceAuthorName(),
                typeContents
        );
    }

    // Mean mastery across every note in the deck, with unseen notes counted as 0
    // (inner COALESCE turns a missing card_stats row into 0 instead of NULL,
    // which AVG would otherwise skip). Returned as 0-100, matching the column.
    private double completionForDeck(UUID deckId) {
        Object value = entityManager.createNativeQuery("""
                SELECT COALESCE(AVG(COALESCE(cs.mastery, 0)), 0)
                FROM notes n
                LEFT JOIN card_stats cs ON cs.note_id = n.id
                WHERE n.deck_id = :deckId
                """)
                .setParameter("deckId", deckId)
                .getSingleResult();
        return value == null ? 0.0 : ((Number) value).doubleValue();
    }

    // Bulk version for the deck-list endpoint: one round trip for all of a user's
    // decks instead of one per deck. Returns deck_id -> completion (0-100).
    private Map<UUID, Double> completionByDeckForUser(String userId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT d.id, COALESCE(AVG(COALESCE(cs.mastery, 0)), 0)
                FROM decks d
                LEFT JOIN notes n ON n.deck_id = d.id
                LEFT JOIN card_stats cs ON cs.note_id = n.id
                WHERE d.user_id = :userId
                GROUP BY d.id
                """)
                .setParameter("userId", userId)
                .getResultList();

        Map<UUID, Double> result = new HashMap<>(rows.size());
        for (Object[] row : rows) {
            UUID deckId = (UUID) row[0];
            double completion = row[1] == null ? 0.0 : ((Number) row[1]).doubleValue();
            result.put(deckId, completion);
        }
        return result;
    }

    private static List<Note> buildNotes(UUID deckId, UUID noteTypeId, List<NoteRequest> incoming,
                                         int startPosition) {
        List<Note> result = new ArrayList<>(incoming.size());
        int pos = startPosition;
        for (NoteRequest req : incoming) {
            Note note = new Note();
            note.setDeckId(deckId);
            note.setNoteTypeId(noteTypeId);
            note.setAnkiNoteId(req.ankiNoteId());
            note.setFields(req.fields());
            note.setTags(req.tags() == null ? new String[0] : req.tags().toArray(String[]::new));
            note.setPosition(pos++);
            result.add(note);
        }
        return result;
    }

    private static NoteContents toNoteContents(Note note) {
        return new NoteContents(
                note.getId(),
                note.getAnkiNoteId(),
                note.getFields(),
                toList(note.getTags()),
                note.getFrontLang(),
                note.getBackLang()
        );
    }

    /**
     * Set the deck-level primary TTS language for each face (Flashcards Options
     * modal). A blank value clears that face back to auto-detect. Scoped by deck
     * ownership; returns the refreshed contents so the client can update in place.
     */
    @Transactional
    public DeckContentsResponse setDeckLanguages(String userId, UUID deckId, String frontLang, String backLang) {
        Deck deck = deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        deck.setFrontLang(normalizeLang(frontLang));
        deck.setBackLang(normalizeLang(backLang));
        deckRepository.save(deck);
        return getDeckContents(userId, deckId);
    }

    // A blank / whitespace-only language code means "auto-detect" — store it as
    // NULL so the column has a single canonical empty value. Trimmed otherwise.
    private static String normalizeLang(String lang) {
        if (lang == null) {
            return null;
        }
        String trimmed = lang.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String[] toArray(List<String> values) {
        return values == null ? new String[0] : values.toArray(String[]::new);
    }

    private static List<String> toList(String[] values) {
        return values == null ? List.of() : List.of(values);
    }
}
