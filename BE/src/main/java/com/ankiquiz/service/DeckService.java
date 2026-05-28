package com.ankiquiz.service;

import com.ankiquiz.dto.request.ImportDeckRequest;
import com.ankiquiz.dto.request.NoteRequest;
import com.ankiquiz.dto.request.NoteTypeRequest;
import com.ankiquiz.dto.response.DeckContentsResponse;
import com.ankiquiz.dto.response.DeckContentsResponse.NoteContents;
import com.ankiquiz.dto.response.DeckContentsResponse.NoteTypeContents;
import com.ankiquiz.dto.response.DeckResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Note;
import com.ankiquiz.entity.NoteType;
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
import java.util.List;
import java.util.Map;
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

            List<Note> notes = buildNotes(savedDeck.getId(), savedType.getId(), typeReq.notes());
            noteRepository.saveAll(notes);
        }

        // A freshly-imported deck has no card_stats yet, so completion is 0.
        return DeckResponse.from(savedDeck, 0.0);
    }

    @Transactional(readOnly = true)
    public DeckContentsResponse getDeckContents(String userId, UUID deckId) {
        Deck deck = deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));

        List<NoteType> types = noteTypeRepository.findAllByDeckId(deckId);
        Map<UUID, List<Note>> notesByType = noteRepository.findAllByDeckIdOrderById(deckId).stream()
                .collect(Collectors.groupingBy(Note::getNoteTypeId));

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

    private static List<Note> buildNotes(UUID deckId, UUID noteTypeId, List<NoteRequest> incoming) {
        List<Note> result = new ArrayList<>(incoming.size());
        for (NoteRequest req : incoming) {
            Note note = new Note();
            note.setDeckId(deckId);
            note.setNoteTypeId(noteTypeId);
            note.setAnkiNoteId(req.ankiNoteId());
            note.setFields(req.fields());
            note.setTags(req.tags() == null ? new String[0] : req.tags().toArray(String[]::new));
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
