package com.ankiquiz.service;

import com.ankiquiz.dto.response.CardStatsResponse;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class NoteService {

    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 200;

    private final DeckRepository deckRepository;
    private final NoteRepository noteRepository;
    private final NoteTypeRepository noteTypeRepository;
    private final CardStatsRepository cardStatsRepository;

    public NoteService(DeckRepository deckRepository,
                       NoteRepository noteRepository,
                       NoteTypeRepository noteTypeRepository,
                       CardStatsRepository cardStatsRepository) {
        this.deckRepository = deckRepository;
        this.noteRepository = noteRepository;
        this.noteTypeRepository = noteTypeRepository;
        this.cardStatsRepository = cardStatsRepository;
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> getNotes(String userId, UUID deckId, List<String> tags,
                                       boolean weakOnly, boolean starredOnly, Integer limit) {
        // Studiable (owned or public): a visitor of a shared deck sees its cards
        // paired with THEIR own progress.
        deckRepository.findStudiable(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));

        String tagsCsv = (tags == null || tags.isEmpty()) ? "" : String.join(",", tags);
        int effectiveLimit = clampLimit(limit);

        List<Note> notes = noteRepository.findFiltered(deckId, tagsCsv, weakOnly, starredOnly, effectiveLimit);
        if (notes.isEmpty()) {
            return List.of();
        }

        // The caller's OWN progress for these notes — someone else studying the
        // same (shared) deck has separate rows.
        Map<UUID, CardStats> statsByNoteId = cardStatsRepository
                .findByUserIdAndNoteIdIn(userId, notes.stream().map(Note::getId).toList()).stream()
                .collect(Collectors.toMap(CardStats::getNoteId, Function.identity()));

        return notes.stream()
                .map(note -> {
                    CardStats stats = statsByNoteId.get(note.getId());
                    return NoteResponse.from(note, stats == null ? null : CardStatsResponse.from(stats));
                })
                .toList();
    }

    /**
     * Edit a single flashcard's field values. Scoped by deck ownership, then by
     * note→deck so a user can't touch another deck's note. Only field keys that
     * belong to the note's type are accepted; incoming values are merged over the
     * existing field map, so an empty or partial form can't drop other fields or
     * inject unknown ones. Cloze markup ({{c1::...}}) is stored verbatim.
     *
     * <p>Changing a card is real work, so it also claims authorship of the deck —
     * this is how a copy of someone else's deck becomes the editor's own (see
     * {@code DeckService.claimAuthorship}).
     */
    @Transactional
    public NoteResponse updateNote(Caller caller, UUID deckId, UUID noteId, Map<String, String> incoming,
                                   String frontLang, String backLang) {
        Deck deck = deckRepository.findByIdAndUserId(deckId, caller.id())
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        Note note = noteRepository.findByIdAndDeckId(noteId, deckId)
                .orElseThrow(() -> new NotFoundException("Note not found: " + noteId));

        Set<String> allowed = allowedFieldKeys(note);
        Map<String, String> existing = note.getFields() == null ? Map.of() : note.getFields();
        Map<String, String> merged = new LinkedHashMap<>(existing);
        for (Map.Entry<String, String> e : incoming.entrySet()) {
            if (allowed.isEmpty() || allowed.contains(e.getKey())) {
                merged.put(e.getKey(), e.getValue() == null ? "" : e.getValue());
            }
        }
        if (!merged.equals(existing)) {
            deck.setAuthorId(caller.id());
            deck.setAuthorName(caller.displayName());
            deck.setAuthorAvatarUrl(caller.avatarUrl());
            deckRepository.save(deck);
        }
        note.setFields(merged);
        // Per-face language override: a present value (including a blank one, which
        // clears back to auto) is applied; an absent (null) value leaves it as-is.
        if (frontLang != null) {
            note.setFrontLang(normalizeLang(frontLang));
        }
        if (backLang != null) {
            note.setBackLang(normalizeLang(backLang));
        }
        Note saved = noteRepository.save(note);

        CardStats stats = cardStatsRepository.findByUserIdAndNoteId(caller.id(), saved.getId()).orElse(null);
        return NoteResponse.from(saved, stats == null ? null : CardStatsResponse.from(stats));
    }

    /**
     * Star / unstar a flashcard (a per-user focus flag). Starring is a personal
     * annotation, so it's allowed on any studiable deck (owned or public) — the
     * star lives on the caller's own card_stats row, never the author's. That row
     * may not exist yet for a never-answered card; we insert a fresh one with
     * default counters and only `starred` set (record_answer takes over the
     * counters on the first answer).
     */
    @Transactional
    public NoteResponse setStarred(String userId, UUID deckId, UUID noteId, boolean starred) {
        deckRepository.findStudiable(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        Note note = noteRepository.findByIdAndDeckId(noteId, deckId)
                .orElseThrow(() -> new NotFoundException("Note not found: " + noteId));

        // The star is the caller's own (per-user card_stats), so it never touches
        // another user's row for the same shared note.
        CardStats stats = cardStatsRepository.findByUserIdAndNoteId(userId, note.getId())
                .orElseGet(() -> newStatsRow(userId, note.getId()));
        stats.setStarred(starred);
        CardStats saved = cardStatsRepository.save(stats);

        return NoteResponse.from(note, CardStatsResponse.from(saved));
    }

    // A fresh card_stats row for a never-answered note. JPA includes every column
    // in the INSERT, so DB-level defaults wouldn't apply — set them explicitly to
    // match the V1/V3/V5 column defaults.
    private static CardStats newStatsRow(String userId, UUID noteId) {
        CardStats stats = new CardStats();
        stats.setUserId(userId);
        stats.setNoteId(noteId);
        stats.setTimesSeen(0);
        stats.setTimesCorrect(0);
        stats.setAccuracy(0.0);
        stats.setStreak(0);
        stats.setMastery(0.0);
        stats.setStarred(false);
        return stats;
    }

    // Keys the edit form may write: the note type's declared field names when we
    // have them, else fall back to whatever keys the note already carries (unknown
    // model). Empty set = no constraint (don't lock out an unusual note).
    private Set<String> allowedFieldKeys(Note note) {
        if (note.getNoteTypeId() != null) {
            NoteType type = noteTypeRepository.findById(note.getNoteTypeId()).orElse(null);
            if (type != null && type.getFieldNames() != null && type.getFieldNames().length > 0) {
                return new LinkedHashSet<>(Arrays.asList(type.getFieldNames()));
            }
        }
        return note.getFields() == null ? Set.of() : note.getFields().keySet();
    }

    private static int clampLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_LIMIT;
        }
        return Math.max(1, Math.min(limit, MAX_LIMIT));
    }

    // A blank / whitespace-only language code means "auto-detect" — store NULL so
    // the column has one canonical empty value. Trimmed otherwise.
    private static String normalizeLang(String lang) {
        if (lang == null) {
            return null;
        }
        String trimmed = lang.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
