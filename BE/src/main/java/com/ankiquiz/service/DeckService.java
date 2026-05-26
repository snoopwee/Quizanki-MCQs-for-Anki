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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DeckService {

    private final DeckRepository deckRepository;
    private final NoteTypeRepository noteTypeRepository;
    private final NoteRepository noteRepository;

    public DeckService(DeckRepository deckRepository,
                       NoteTypeRepository noteTypeRepository,
                       NoteRepository noteRepository) {
        this.deckRepository = deckRepository;
        this.noteTypeRepository = noteTypeRepository;
        this.noteRepository = noteRepository;
    }

    @Transactional(readOnly = true)
    public List<DeckResponse> getDecksForUser(String userId) {
        return deckRepository.findAllByUserIdOrderByImportedAtDesc(userId).stream()
                .map(DeckResponse::from)
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

        return DeckResponse.from(savedDeck);
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
                typeContents
        );
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
