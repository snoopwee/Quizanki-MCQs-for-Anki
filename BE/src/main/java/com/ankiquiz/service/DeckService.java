package com.ankiquiz.service;

import com.ankiquiz.dto.request.ImportDeckRequest;
import com.ankiquiz.dto.request.NoteRequest;
import com.ankiquiz.dto.request.NoteTypeRequest;
import com.ankiquiz.dto.request.UpdateDeckContentsRequest;
import com.ankiquiz.dto.response.DeckContentsResponse;
import com.ankiquiz.dto.response.DeckContentsResponse.NoteContents;
import com.ankiquiz.dto.response.DeckContentsResponse.NoteTypeContents;
import com.ankiquiz.dto.response.DeckResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Note;
import com.ankiquiz.entity.NoteType;
import com.ankiquiz.exception.ApkgParseException;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import com.ankiquiz.repository.NoteTypeRepository;
import jakarta.persistence.EntityManager;
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
    public DeckResponse importDeck(String userId, ImportDeckRequest request) {
        int totalNotes = request.noteTypes().stream()
                .mapToInt(t -> t.notes().size())
                .sum();

        Deck deck = new Deck();
        deck.setUserId(userId);
        deck.setName(request.name());
        deck.setSubdeckPath(request.subdeckPath());
        deck.setSourceFilename(request.sourceFilename());
        deck.setCardCount(totalNotes);
        deck.setImportedAt(OffsetDateTime.now());
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

        // A freshly-imported deck has no card_stats yet, so completion is 0.
        return DeckResponse.from(savedDeck, 0.0);
    }

    private static final int MAX_NOTES = 5_000;

    /**
     * Commit the flashcard editor's whole working set in one transaction
     * (last-write-wins). Sets the name, applies front/back layout swaps to the
     * deck's note types, then reconciles the note set: notes carrying a known id
     * are updated, id-less entries are inserted, and any stored note absent from
     * the payload is deleted (its card_stats cascade away). Each note's order is
     * its index in the payload. New/unrouted cards go to a Basic (Front/Back) type.
     */
    @Transactional
    public DeckContentsResponse replaceDeckContents(String userId, UUID deckId, UpdateDeckContentsRequest req) {
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
        int position = 0;
        for (UpdateDeckContentsRequest.NoteEntry entry : req.notes()) {
            Note note;
            if (entry.id() != null && existingById.containsKey(entry.id())) {
                note = existingById.get(entry.id());
                keptIds.add(note.getId());
            } else {
                note = new Note();
                note.setDeckId(deckId);
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
            note.setPosition(position++);
            toSave.add(note);
        }
        noteRepository.saveAll(toSave);

        List<Note> toDelete = existing.stream()
                .filter(n -> !keptIds.contains(n.getId()))
                .toList();
        if (!toDelete.isEmpty()) {
            noteRepository.deleteAll(toDelete);
        }

        deck.setCardCount(req.notes().size());
        deckRepository.save(deck);

        return getDeckContents(userId, deckId);
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
                toList(note.getTags())
        );
    }

    private static String[] toArray(List<String> values) {
        return values == null ? new String[0] : values.toArray(String[]::new);
    }

    private static List<String> toList(String[] values) {
        return values == null ? List.of() : List.of(values);
    }
}
