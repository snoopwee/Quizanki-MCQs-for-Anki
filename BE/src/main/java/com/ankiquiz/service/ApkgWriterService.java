package com.ankiquiz.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Writes an Anki {@code .apkg} package — the mirror of {@link ApkgParserService}.
 *
 * <p><b>Why this exists.</b> Decks come IN as {@code .apkg} today. This sends them back OUT, which is
 * what lets a user study Quizanki content inside Anki with Anki's own scheduler. Phase 13 in the
 * roadmap.
 *
 * <p>The note type is a {@link NoteType} parameter rather than anything hardcoded here, so this class
 * only ever deals with the package format. {@link NoteType#basic} is a plain Front/Back deck;
 * {@link NoteType#mcq} is the multiple-choice one this phase exists for, and its templates live in
 * {@link AnkiMcqTemplate}. Adding a third kind of card means another factory, not changes in here.
 *
 * <p><b>Which package format, and why the simplest one.</b> Anki has three variants: Legacy 1
 * ({@code collection.anki2}), Legacy 2 (adds {@code collection.anki21} plus a protobuf {@code meta}
 * file and a dummy {@code .anki2}), and Latest ({@code collection.anki21b}, schema 18, zstd, config
 * as protobuf BLOBs). Current Anki imports all three. This writes <b>Legacy 1</b>:
 *
 * <ul>
 *   <li>Schema 11 keeps every configuration blob as <b>JSON in a TEXT column</b>, so writing needs no
 *       protobuf at all. That is the whole difficulty of the modern format, and on the way out it
 *       simply does not arise — unlike the parser, which has to cope with it on the way in.</li>
 *   <li>It is what {@code genanki} emits, which makes it the most heavily exercised generator output
 *       in the ecosystem.</li>
 *   <li>Upgrading to Legacy 2 later is two bytes of {@code meta} and a dummy entry, if a reason ever
 *       appears. There isn't one today.</li>
 * </ul>
 *
 * <p><b>Scheduling is deliberately left empty.</b> Every card is written as NEW ({@code type} and
 * {@code queue} both 0, {@code ivl}/{@code factor}/{@code reps} zero) and {@code revlog} ships empty.
 * The point of the export is that Anki does the scheduling; sending review history would mean
 * inventing a study record the user never had.
 */
@Service
public class ApkgWriterService {

    private static final Logger log = LoggerFactory.getLogger(ApkgWriterService.class);

    /**
     * Anki joins a note's field values with the ASCII unit separator. Not a comma, not a tab — a
     * field containing either of those is ordinary, and would silently split the note.
     */
    private static final char FIELD_SEPARATOR = 0x1F;

    /** Anki's own id for the Default deck. It must exist in the collection even if nothing uses it. */
    private static final long DEFAULT_DECK_ID = 1L;

    /** {@code {{c1::hidden}}} — the marker that makes a cloze note generate its cards. */
    private static final java.util.regex.Pattern CLOZE_MARKER =
            java.util.regex.Pattern.compile("\\{\\{c(\\d+)::");

    /**
     * Ceiling on one media file. Matches the app's own upload limits (5 MB image / 10 MB audio), so
     * nothing we accepted on the way in can be too big on the way out.
     */
    static final long MAX_MEDIA_BYTES = 10L * 1024 * 1024;

    /**
     * Ceiling on a package's media in total. A 5,000-note deck with a picture on every card would
     * otherwise be unbounded; this is the point where a deck has to be split instead.
     */
    static final long MAX_TOTAL_MEDIA_BYTES = 200L * 1024 * 1024;

    private final ObjectMapper objectMapper;

    public ApkgWriterService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    // ── What a caller describes ──────────────────────────────────────────────

    /**
     * A note type (Anki calls it a "model"): the fields a note has and the templates that turn them
     * into cards.
     *
     * @param fieldNames in display order; a note's values are positional against this list
     * @param qfmt       front template, e.g. {@code {{Front}}}
     * @param afmt       back template; {@code {{FrontSide}}} re-renders the question
     * @param sortField  index into {@code fieldNames} that Anki's browser sorts on
     * @param requiredFields field ordinals that must ALL be non-empty before Anki will generate the
     *                       card. This becomes the note type's {@code req}, and it is what stops a
     *                       half-filled note turning into a blank card in someone's collection — an
     *                       MCQ with no {@code Choices} is not a card, it is a dead end.
     */
    public record NoteType(String name, List<String> fieldNames, String qfmt, String afmt,
                           String css, int sortField, List<Integer> requiredFields, boolean cloze) {

        public NoteType {
            if (name == null || name.isBlank()) {
                throw new IllegalArgumentException("A note type needs a name");
            }
            if (fieldNames == null || fieldNames.isEmpty()) {
                throw new IllegalArgumentException("A note type needs at least one field");
            }
            if (sortField < 0 || sortField >= fieldNames.size()) {
                throw new IllegalArgumentException("sortField must index one of the fields");
            }
            fieldNames = List.copyOf(fieldNames);
            // A cloze model's `req` must stay EMPTY — Anki generates its cards from the {{c1::}}
            // markers, not from field presence, and a non-empty req suppresses them. So the
            // sort-field default applies to standard models only.
            if (requiredFields == null || requiredFields.isEmpty()) {
                requiredFields = cloze ? List.of() : List.of(sortField);
            } else {
                requiredFields = List.copyOf(requiredFields);
            }
            for (int ord : requiredFields) {
                if (ord < 0 || ord >= fieldNames.size()) {
                    throw new IllegalArgumentException("requiredFields must index declared fields");
                }
            }
        }

        /** Convenience for a standard (non-cloze) type whose only requirement is its sort field. */
        public NoteType(String name, List<String> fieldNames, String qfmt, String afmt,
                        String css, int sortField) {
            this(name, fieldNames, qfmt, afmt, css, sortField, List.of(sortField), false);
        }

        /** Convenience for a standard type with explicit requirements. */
        public NoteType(String name, List<String> fieldNames, String qfmt, String afmt,
                        String css, int sortField, List<Integer> requiredFields) {
            this(name, fieldNames, qfmt, afmt, css, sortField, requiredFields, false);
        }

        /**
         * A cloze type, where one note yields a card per distinct {@code {{c<n>::}}} marker.
         *
         * <p>Anki treats cloze as a different KIND of model ({@code type: 1}), not a template
         * variation: its {@code req} must be empty, and card generation is driven by the markers in
         * the note's text rather than by the template list. Decks imported from Anki carry these, so
         * the exporter has to be able to send them back.
         */
        public static NoteType cloze(String name, List<String> fieldNames) {
            String first = fieldNames.isEmpty() ? "Text" : fieldNames.get(0);
            return new NoteType(name, fieldNames,
                    "{{cloze:" + first + "}}",
                    "{{cloze:" + first + "}}",
                    ".card { font-family: arial; font-size: 20px; text-align: center;"
                            + " color: black; background-color: white; }",
                    0, List.of(), true);
        }

        /** Front/Back, the shape of nearly every deck this app imports. */
        public static NoteType basic(String name) {
            return new NoteType(name, List.of("Front", "Back"),
                    "{{Front}}",
                    "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
                    ".card { font-family: arial; font-size: 20px; text-align: center;"
                            + " color: black; background-color: white; }",
                    0);
        }

        /** Field order for {@link #mcq}; the writer and the template both index against this. */
        public static final List<String> MCQ_FIELDS =
                List.of("Question", "Choices", "Answer", "Extra", "Source");

        /**
         * The multiple-choice note type — the point of the whole export.
         *
         * <p>{@code Choices} holds the options one per line, <b>correct one first</b>, and
         * {@link AnkiMcqTemplate} shuffles them in the browser at review time. That is what lets a
         * static package still vary: bake more options than there are slots and the learner sees a
         * different set on each review, which is as close to the web quiz as an offline deck gets.
         *
         * <p>{@code Answer} repeats the correct option deliberately. The back is rendered from it
         * rather than from "the first line of Choices", so a user who reorders or edits the choices
         * in Anki's own editor still gets a correct answer side.
         */
        public static NoteType mcq(String name) {
            return new NoteType(name, MCQ_FIELDS,
                    AnkiMcqTemplate.question(),
                    AnkiMcqTemplate.answer(),
                    AnkiMcqTemplate.css(),
                    0,
                    // Question AND Choices: a prompt with nothing to choose between is not a card.
                    List.of(0, 1));
        }
    }

    /**
     * One note.
     *
     * @param guid  <b>must be stable across exports of the same card.</b> Anki matches on this, so a
     *              guid derived from anything that changes between runs (a random value, a timestamp)
     *              makes a re-export ADD duplicates instead of updating what is already there. Use
     *              {@link #stableGuid}.
     * @param values positional against the note type's {@code fieldNames}
     */
    public record Note(String guid, int noteTypeIndex, List<String> values, List<String> tags) {

        public Note {
            if (guid == null || guid.isBlank()) {
                throw new IllegalArgumentException("A note needs a guid");
            }
            if (noteTypeIndex < 0) {
                throw new IllegalArgumentException("noteTypeIndex must index a declared note type");
            }
            values = List.copyOf(values == null ? List.of() : values);
            tags = List.copyOf(tags == null ? List.of() : tags);
        }

        /** A note in a deck with a single note type — the common case. */
        public Note(String guid, List<String> values, List<String> tags) {
            this(guid, 0, values, tags);
        }
    }

    /** A whole package: one deck, one note type, its notes. */
    public record DeckSpec(String deckName, List<NoteType> noteTypes, List<Note> notes,
                           List<Media> media) {

        public DeckSpec {
            if (deckName == null || deckName.isBlank()) {
                throw new IllegalArgumentException("A deck needs a name");
            }
            if (noteTypes == null || noteTypes.isEmpty()) {
                throw new IllegalArgumentException("A deck needs at least one note type");
            }
            noteTypes = List.copyOf(noteTypes);
            notes = List.copyOf(notes == null ? List.of() : notes);
            media = List.copyOf(media == null ? List.of() : media);
            for (Note note : notes) {
                if (note.noteTypeIndex() >= noteTypes.size()) {
                    throw new IllegalArgumentException(
                            "Note " + note.guid() + " references note type "
                                    + note.noteTypeIndex() + " but only " + noteTypes.size()
                                    + " are declared");
                }
            }
        }

        /** A deck using one note type throughout — what the MCQ export and most decks are. */
        public DeckSpec(String deckName, NoteType noteType, List<Note> notes, List<Media> media) {
            this(deckName, List.of(noteType), notes, media);
        }

        /** A single-note-type deck with no pictures or audio. */
        public DeckSpec(String deckName, NoteType noteType, List<Note> notes) {
            this(deckName, List.of(noteType), notes, List.of());
        }

        /** Several note types — an imported Anki deck can mix Basic, Cloze and custom models. */
        public DeckSpec(String deckName, List<NoteType> noteTypes, List<Note> notes) {
            this(deckName, noteTypes, notes, List.of());
        }

        /** The type a given note is written against. */
        NoteType typeOf(Note note) {
            return noteTypes.get(note.noteTypeIndex());
        }
    }

    /**
     * One picture or audio clip to ship inside the package.
     *
     * <p>Opened lazily through {@link Source} rather than handed over as bytes. A deck can carry
     * hundreds of files and this runs on a 512 MB instance, so they are streamed into the zip one at
     * a time and never all held at once.
     *
     * @param filename the name a note's field refers to — {@code <img src="x.jpg">} or
     *                 {@code [sound:x.mp3]}. It is the NAME that links a field to a file; the zip
     *                 entry itself is just a number.
     */
    public record Media(String filename, Source source) {

        public Media {
            if (filename == null || filename.isBlank()) {
                throw new IllegalArgumentException("Media needs a filename");
            }
            if (source == null) {
                throw new IllegalArgumentException("Media needs a source");
            }
        }

        /** Opens the bytes. Separate so the writer never learns where media is stored. */
        @FunctionalInterface
        public interface Source {
            InputStream open() throws IOException;
        }

        /** For small content already in hand — mostly tests. */
        public static Media ofBytes(String filename, byte[] content) {
            return new Media(filename, () -> new ByteArrayInputStream(content));
        }
    }

    /**
     * What the writer produced.
     *
     * @param mediaWritten  files successfully packaged
     * @param mediaSkipped  files whose bytes could not be read. Deliberately NOT fatal: a deck that
     *                      imports with one missing picture is far better than an export that fails
     *                      because a single object had gone from storage. The caller reports it.
     */
    public record WriteResult(int notesWritten, int mediaWritten, List<String> mediaSkipped) {

        public WriteResult {
            mediaSkipped = List.copyOf(mediaSkipped == null ? List.of() : mediaSkipped);
        }
    }

    // ── Writing ──────────────────────────────────────────────────────────────

    /**
     * A guid that is the same every time for the same card.
     *
     * <p>Any unique string is a legal Anki guid; what matters is that it does not move. Derived from
     * the deck and note ids so re-exporting a deck updates the user's cards rather than duplicating
     * them — the single most damaging thing this writer could get wrong.
     */
    public static String stableGuid(Object deckId, Object noteId) {
        byte[] digest = sha1(("quizanki:" + deckId + ":" + noteId).getBytes(StandardCharsets.UTF_8));
        // 11 base64 chars of entropy is far more than enough and keeps the column small.
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest).substring(0, 11);
    }

    /**
     * Writes {@code spec} as an {@code .apkg} to {@code destination}.
     *
     * <p>The collection is built on a temporary file rather than in memory: a full-sized deck is
     * millions of characters, and this runs on a 512 MB instance.
     */
    public WriteResult write(DeckSpec spec, Path destination) throws IOException {
        Path collection = Files.createTempFile("quizanki-apkg-", ".anki2");
        try {
            buildCollection(spec, collection);
            WriteResult result;
            try (OutputStream out = Files.newOutputStream(destination)) {
                result = zip(spec, collection, out);
            }
            log.debug("Wrote .apkg for deck '{}' ({} notes, {} media, {} media skipped) to {}",
                    spec.deckName(), result.notesWritten(), result.mediaWritten(),
                    result.mediaSkipped().size(), destination);
            return result;
        } finally {
            Files.deleteIfExists(collection);
        }
    }

    /**
     * Zips a Legacy 1 package: the collection, every media file, and the map that links them.
     *
     * <p>Anki stores media under NUMERIC entry names — "0", "1", "2" — and the {@code media} file is
     * the JSON index from that number to the real filename a field refers to. The indirection is what
     * lets a deck contain two files legitimately called {@code diagram.png}.
     *
     * <p>The map is written LAST, once it is known which files actually made it in. Zip entries have
     * no required order, and writing the index first would mean promising files that then failed.
     */
    private WriteResult zip(DeckSpec spec, Path collection, OutputStream out) throws IOException {
        Map<String, String> index = new LinkedHashMap<>();
        List<String> skipped = new ArrayList<>();

        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            zip.putNextEntry(new ZipEntry("collection.anki2"));
            Files.copy(collection, zip);
            zip.closeEntry();

            Set<String> seen = new LinkedHashSet<>();
            long total = 0;
            int number = 0;

            for (Media media : spec.media()) {
                String filename = sanitiseMediaName(media.filename());
                // The same picture on ten cards is one file. Content-addressed names make this the
                // common case, and shipping ten copies would multiply a deck's size for nothing.
                if (!seen.add(filename)) {
                    continue;
                }
                if (total >= MAX_TOTAL_MEDIA_BYTES) {
                    skipped.add(filename);
                    continue;
                }

                // Open BEFORE creating the zip entry. The common failure is the object having gone
                // from storage, and a zip entry cannot be un-created: opening first means that case
                // costs nothing at all.
                InputStream opened;
                try {
                    opened = media.source().open();
                } catch (IOException | RuntimeException e) {
                    log.warn("Skipping media '{}' in export: {}", filename, e.toString());
                    skipped.add(filename);
                    continue;
                }

                String entryName = String.valueOf(number);
                try (InputStream in = opened) {
                    zip.putNextEntry(new ZipEntry(entryName));
                    long written = copyCapped(in, zip);
                    zip.closeEntry();
                    index.put(entryName, filename);
                    total += written;
                } catch (IOException | RuntimeException e) {
                    // Failed PART WAY through, so the entry exists and holds a truncated file. It is
                    // simply left out of the map — Anki reads the map, so an unreferenced entry is
                    // ignored. The number is burned either way: reusing it would collide with this
                    // half-written entry and take the NEXT file down with it.
                    log.warn("Skipping media '{}' in export: {}", filename, e.toString());
                    skipped.add(filename);
                    try {
                        zip.closeEntry();
                    } catch (IOException ignored) {
                        // Already closed, or the stream is unusable; the map is what matters.
                    }
                }
                number++;
            }

            zip.putNextEntry(new ZipEntry("media"));
            zip.write(writeJson(index).getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        return new WriteResult(spec.notes().size(), index.size(), skipped);
    }

    /**
     * Copies a media file into the open zip entry, refusing to go past {@link #MAX_MEDIA_BYTES}.
     *
     * @return bytes written
     * @throws IOException if the source fails mid-read, or the file is over the cap
     */
    private long copyCapped(InputStream in, ZipOutputStream zip) throws IOException {
        long written = 0;
        byte[] buffer = new byte[8192];
        for (int read = in.read(buffer); read > 0; read = in.read(buffer)) {
            written += read;
            if (written > MAX_MEDIA_BYTES) {
                // Checked as we go, not afterwards: the whole point of the cap is never to hold or
                // copy the entire file. An endless source stops here instead of filling the disk.
                throw new IOException("Media file exceeds " + MAX_MEDIA_BYTES + " bytes");
            }
            zip.write(buffer, 0, read);
        }
        return written;
    }

    /**
     * Anki looks media up by this name, and it ends up on the learner's filesystem.
     *
     * <p>Path separators are the reason this exists: a name like {@code ../../evil.png} in a package
     * is a path-traversal attempt against whoever imports it, and our own stored paths legitimately
     * contain slashes ({@code <userId>/<uuid>}) which would become directories.
     */
    static String sanitiseMediaName(String filename) {
        String name = filename.replace('\\', '/');
        int slash = name.lastIndexOf('/');
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        name = name.replaceAll("[\\x00-\\x1f\"*?:<>|]", "_").strip();
        return name.isEmpty() ? "media" : name;
    }

    private void buildCollection(DeckSpec spec, Path file) throws IOException {
        long nowMs = System.currentTimeMillis();
        long nowSec = nowMs / 1000L;
        // Anki stores a collection's creation as the START of a day: the scheduler counts days from
        // it, so a mid-day value would put every "day" boundary at that time of day.
        long createdSec = nowSec - (nowSec % 86_400L);

        // One model id per note type, and a deck id that cannot collide with any of them.
        List<Long> modelIds = new ArrayList<>();
        for (int i = 0; i < spec.noteTypes().size(); i++) {
            modelIds.add(nowMs + i);
        }
        long deckId = nowMs + spec.noteTypes().size();

        try (Connection db = DriverManager.getConnection("jdbc:sqlite:" + file.toAbsolutePath())) {
            createSchema(db);
            insertCol(db, spec, createdSec, nowMs, modelIds, deckId);
            insertNotesAndCards(db, spec, nowSec, modelIds, deckId);
        } catch (SQLException e) {
            throw new IOException("Could not build the Anki collection", e);
        }
    }

    /**
     * Schema 11, exactly as Anki creates it.
     *
     * <p>{@code notes.sfld} is declared INTEGER but holds TEXT. That is Anki's own quirk, not a typo
     * here — SQLite's typing is per value, so the declared type is advisory and Anki relies on that.
     * Reproduce it: a collection whose DDL does not match is a collection Anki may decide to migrate.
     */
    private void createSchema(Connection db) throws SQLException {
        try (Statement st = db.createStatement()) {
            st.executeUpdate("""
                    create table col (
                        id     integer primary key,
                        crt    integer not null,
                        mod    integer not null,
                        scm    integer not null,
                        ver    integer not null,
                        dty    integer not null,
                        usn    integer not null,
                        ls     integer not null,
                        conf   text    not null,
                        models text    not null,
                        decks  text    not null,
                        dconf  text    not null,
                        tags   text    not null
                    )""");
            st.executeUpdate("""
                    create table notes (
                        id    integer primary key,
                        guid  text    not null,
                        mid   integer not null,
                        mod   integer not null,
                        usn   integer not null,
                        tags  text    not null,
                        flds  text    not null,
                        sfld  integer not null,
                        csum  integer not null,
                        flags integer not null,
                        data  text    not null
                    )""");
            st.executeUpdate("""
                    create table cards (
                        id     integer primary key,
                        nid    integer not null,
                        did    integer not null,
                        ord    integer not null,
                        mod    integer not null,
                        usn    integer not null,
                        type   integer not null,
                        queue  integer not null,
                        due    integer not null,
                        ivl    integer not null,
                        factor integer not null,
                        reps   integer not null,
                        lapses integer not null,
                        left   integer not null,
                        odue   integer not null,
                        odid   integer not null,
                        flags  integer not null,
                        data   text    not null
                    )""");
            st.executeUpdate("""
                    create table revlog (
                        id      integer primary key,
                        cid     integer not null,
                        usn     integer not null,
                        ease    integer not null,
                        ivl     integer not null,
                        lastIvl integer not null,
                        factor  integer not null,
                        time    integer not null,
                        type    integer not null
                    )""");
            st.executeUpdate("""
                    create table graves (
                        usn  integer not null,
                        oid  integer not null,
                        type integer not null
                    )""");

            // Anki's own index set. Not strictly needed to import, but a collection that looks like
            // Anki made it is one Anki has no reason to treat as foreign.
            st.executeUpdate("create index ix_notes_usn on notes (usn)");
            st.executeUpdate("create index ix_cards_usn on cards (usn)");
            st.executeUpdate("create index ix_revlog_usn on revlog (usn)");
            st.executeUpdate("create index ix_cards_nid on cards (nid)");
            st.executeUpdate("create index ix_cards_sched on cards (did, queue, due)");
            st.executeUpdate("create index ix_revlog_cid on revlog (cid)");
            st.executeUpdate("create index ix_notes_csum on notes (csum)");
        }
    }

    private void insertCol(Connection db, DeckSpec spec, long createdSec, long nowMs,
                           List<Long> modelIds, long deckId) throws SQLException, IOException {
        String sql = "insert into col (id, crt, mod, scm, ver, dty, usn, ls,"
                + " conf, models, decks, dconf, tags) values (1,?,?,?,11,0,0,0,?,?,?,?,'{}')";
        try (PreparedStatement ps = db.prepareStatement(sql)) {
            ps.setLong(1, createdSec);
            ps.setLong(2, nowMs);
            ps.setLong(3, nowMs);
            ps.setString(4, confJson(modelIds.get(0)));
            ps.setString(5, modelsJson(spec.noteTypes(), modelIds, deckId));
            ps.setString(6, decksJson(spec.deckName(), deckId));
            ps.setString(7, dconfJson());
            ps.executeUpdate();
        }
    }

    private void insertNotesAndCards(Connection db, DeckSpec spec, long nowSec,
                                     List<Long> modelIds, long deckId) throws SQLException {
        String insertNote = "insert into notes (id, guid, mid, mod, usn, tags, flds, sfld, csum,"
                + " flags, data) values (?,?,?,?,-1,?,?,?,?,0,'')";
        String insertCard = "insert into cards (id, nid, did, ord, mod, usn, type, queue, due, ivl,"
                + " factor, reps, lapses, left, odue, odid, flags, data)"
                + " values (?,?,?,?,?,-1,0,0,?,0,0,0,0,0,0,0,0,'')";

        db.setAutoCommit(false);
        try (PreparedStatement note = db.prepareStatement(insertNote);
             PreparedStatement card = db.prepareStatement(insertCard)) {

            // Ids are epoch-millis in Anki, and must be unique within the collection. Walking a
            // counter from "now" gives both without asking the clock per row.
            long id = System.currentTimeMillis();
            int position = 0;

            for (Note n : spec.notes()) {
                NoteType type = spec.typeOf(n);
                long noteId = id++;
                List<String> values = padded(n, type);
                String flds = String.join(String.valueOf(FIELD_SEPARATOR), values);

                note.setLong(1, noteId);
                note.setString(2, n.guid());
                note.setLong(3, modelIds.get(n.noteTypeIndex()));
                note.setLong(4, nowSec);
                // Anki stores tags space-separated AND space-padded, so a search for " tag " matches
                // a whole tag rather than a prefix of another one.
                note.setString(5, n.tags().isEmpty() ? "" : " " + String.join(" ", n.tags()) + " ");
                note.setString(6, flds);
                note.setString(7, values.get(type.sortField()));
                note.setLong(8, fieldChecksum(values.isEmpty() ? "" : values.get(0)));
                note.addBatch();

                // A standard note makes one card; a cloze note makes one per distinct marker.
                for (int ord : cardOrdinals(type, flds)) {
                    card.setLong(1, id++);
                    card.setLong(2, noteId);
                    card.setLong(3, deckId);
                    card.setInt(4, ord);
                    card.setLong(5, nowSec);
                    // `due` for a NEW card is its position in the new-card queue, not a date.
                    card.setInt(6, position++);
                    card.addBatch();
                }
            }
            note.executeBatch();
            card.executeBatch();
            db.commit();
        } catch (SQLException e) {
            db.rollback();
            throw e;
        } finally {
            db.setAutoCommit(true);
        }
    }

    /**
     * Which cards a note generates.
     *
     * <p>A standard note makes exactly one. A CLOZE note makes one per distinct {@code {{c<n>::}}}
     * marker in its text, at ordinal {@code n - 1} — that is how Anki turns one sentence with three
     * blanks into three cards. A cloze note with no markers still gets ordinal 0 rather than
     * vanishing: a note that produced no card at all would simply disappear on import.
     */
    private static List<Integer> cardOrdinals(NoteType type, String flds) {
        if (!type.cloze()) {
            return List.of(0);
        }
        java.util.TreeSet<Integer> ords = new java.util.TreeSet<>();
        java.util.regex.Matcher m = CLOZE_MARKER.matcher(flds);
        while (m.find()) {
            int index = Integer.parseInt(m.group(1));
            if (index >= 1) {
                ords.add(index - 1);
            }
        }
        return ords.isEmpty() ? List.of(0) : new ArrayList<>(ords);
    }

    /**
     * A note's values, padded or trimmed to the note type's field count.
     *
     * <p>Anki expects exactly as many separated values as the type has fields. Too few and later
     * fields read as missing; too many and the extra text is invisible but travels with the note.
     */
    private static List<String> padded(Note note, NoteType type) {
        int want = type.fieldNames().size();
        List<String> out = new java.util.ArrayList<>(want);
        for (int i = 0; i < want; i++) {
            String v = i < note.values().size() ? note.values().get(i) : "";
            out.add(v == null ? "" : v);
        }
        return out;
    }

    /**
     * Anki's duplicate-detection checksum: the first 8 hex digits of the SHA-1 of the first field,
     * as an integer. Anki strips HTML and media references before hashing, which is why
     * {@code <b>cat</b>} and {@code cat} are found as duplicates of each other.
     */
    static long fieldChecksum(String firstField) {
        String stripped = stripHtmlMedia(firstField);
        byte[] digest = sha1(stripped.getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder();
        for (int i = 0; i < 4; i++) {
            hex.append(String.format("%02x", digest[i]));
        }
        return Long.parseLong(hex.toString(), 16);
    }

    /** What Anki's {@code stripHTMLMedia} does, to the extent the checksum depends on it. */
    private static String stripHtmlMedia(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        return value
                .replaceAll("(?i)\\[sound:[^]]*]", "")
                .replaceAll("(?i)<img[^>]*>", "")
                .replaceAll("<[^>]+>", "");
    }

    private static byte[] sha1(byte[] input) {
        try {
            return MessageDigest.getInstance("SHA-1").digest(input);
        } catch (NoSuchAlgorithmException e) {
            // SHA-1 is required of every JVM; this cannot happen.
            throw new IllegalStateException("SHA-1 unavailable", e);
        }
    }

    // ── The JSON blobs schema 11 keeps in `col` ──────────────────────────────

    private String confJson(long modelId) throws IOException {
        ObjectNode conf = objectMapper.createObjectNode();
        conf.put("nextPos", 1);
        conf.put("estTimes", true);
        conf.set("activeDecks", objectMapper.createArrayNode().add(DEFAULT_DECK_ID));
        conf.put("sortType", "noteFld");
        conf.put("timeLim", 0);
        conf.put("sortBackwards", false);
        conf.put("addToCur", true);
        conf.put("curDeck", DEFAULT_DECK_ID);
        conf.put("newBury", true);
        conf.put("newSpread", 0);
        conf.put("dueCounts", true);
        conf.put("curModel", String.valueOf(modelId));
        conf.put("collapseTime", 1200);
        // The v2 scheduler. Anki upgrades a collection declaring v1, and we have no reason to make
        // it do that on import.
        conf.put("schedVer", 2);
        conf.put("dayLearnFirst", false);
        return write(conf);
    }

    private String modelsJson(List<NoteType> types, List<Long> modelIds, long deckId)
            throws IOException {
        ObjectNode models = objectMapper.createObjectNode();
        for (int i = 0; i < types.size(); i++) {
            long modelId = modelIds.get(i);
            models.set(String.valueOf(modelId), model(types.get(i), modelId, deckId));
        }
        return write(models);
    }

    private ObjectNode model(NoteType type, long modelId, long deckId) {
        ObjectNode model = objectMapper.createObjectNode();
        model.put("id", modelId);
        model.put("name", type.name());
        // 0 = standard, 1 = cloze. Anki treats these as different kinds of model, not as a
        // template variation: cloze generates its cards from the text's {{c1::}} markers.
        model.put("type", type.cloze() ? 1 : 0);
        model.put("mod", modelId / 1000L);
        model.put("usn", -1);
        model.put("sortf", type.sortField());
        model.put("did", deckId);
        model.put("css", type.css());
        model.put("latexPre", "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n"
                + "\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n"
                + "\\setlength{\\parindent}{0in}\n\\begin{document}\n");
        model.put("latexPost", "\\end{document}");
        model.put("latexsvg", false);
        model.set("req", requirements(type));
        model.set("tags", objectMapper.createArrayNode());
        model.set("vers", objectMapper.createArrayNode());

        ArrayNode fields = objectMapper.createArrayNode();
        for (int i = 0; i < type.fieldNames().size(); i++) {
            ObjectNode f = objectMapper.createObjectNode();
            f.put("name", type.fieldNames().get(i));
            f.put("ord", i);
            f.put("sticky", false);
            f.put("rtl", false);
            f.put("font", "Arial");
            f.put("size", 20);
            f.put("description", "");
            f.put("media", "");
            fields.add(f);
        }
        model.set("flds", fields);

        ObjectNode template = objectMapper.createObjectNode();
        template.put("name", type.cloze() ? "Cloze" : "Card 1");
        template.put("ord", 0);
        template.put("qfmt", type.qfmt());
        template.put("afmt", type.afmt());
        template.put("bqfmt", "");
        template.put("bafmt", "");
        template.put("did", (String) null);
        template.put("bfont", "");
        template.put("bsize", 0);
        model.set("tmpls", objectMapper.createArrayNode().add(template));
        return model;
    }

    /**
     * {@code req} tells Anki which fields a template needs before it will generate a card. One entry
     * per template: {@code [ord, "any"|"all"|"none", [fieldOrds]]}.
     *
     * <p>We write {@code "all"} — the required fields are the ones the card cannot do without — but
     * <b>do not rely on it.</b> Verified 2026-10-09 by importing a package with the real Anki
     * library (26.09.3): Anki RECOMPUTES {@code req} from the template on import and stored
     * {@code [[0, "any", [0, 1]]]} over our {@code "all"}. So this value is a hint at best, and the
     * actual guarantee that a note has both a question and choices comes from
     * {@link McqDistractorSelector} refusing to export one that doesn't.
     *
     * <p>It still matters that the ORDINALS are right: Anki keeps the field list it derives, and a
     * cloze model's empty {@code req} is honoured (a non-empty one suppresses every card).
     */
    private ArrayNode requirements(NoteType type) {
        // A cloze model's req must be EMPTY. Its cards come from the {{c1::}} markers, and a
        // non-empty req makes Anki suppress them — the deck imports with no cards at all.
        if (type.cloze()) {
            return objectMapper.createArrayNode();
        }
        ArrayNode ords = objectMapper.createArrayNode();
        type.requiredFields().forEach(ords::add);
        ArrayNode entry = objectMapper.createArrayNode();
        entry.add(0);
        entry.add("all");
        entry.add(ords);
        return objectMapper.createArrayNode().add(entry);
    }

    private String decksJson(String deckName, long deckId) throws IOException {
        ObjectNode decks = objectMapper.createObjectNode();
        // Anki expects the Default deck to exist. Ours is a sibling, not a replacement — importing
        // into a collection that already has decks must not disturb them.
        decks.set(String.valueOf(DEFAULT_DECK_ID), deck(DEFAULT_DECK_ID, "Default"));
        decks.set(String.valueOf(deckId), deck(deckId, sanitiseDeckName(deckName)));
        return write(decks);
    }

    private ObjectNode deck(long id, String name) {
        ObjectNode d = objectMapper.createObjectNode();
        d.put("id", id);
        d.put("mod", id / 1000L);
        d.put("name", name);
        d.put("usn", -1);
        d.set("lrnToday", counter());
        d.set("revToday", counter());
        d.set("newToday", counter());
        d.set("timeToday", counter());
        d.put("collapsed", false);
        d.put("browserCollapsed", false);
        d.put("desc", "");
        d.put("dyn", 0);
        d.put("conf", 1);
        d.put("extendNew", 0);
        d.put("extendRev", 0);
        return d;
    }

    private ArrayNode counter() {
        return objectMapper.createArrayNode().add(0).add(0);
    }

    /**
     * {@code ::} is Anki's sub-deck separator, so a deck literally called "A::B" would silently
     * become a nested pair. Quotes and newlines confuse the deck list.
     */
    static String sanitiseDeckName(String name) {
        String cleaned = name.replace("::", "-").replaceAll("[\"\\r\\n\\t]", " ").trim();
        return cleaned.isEmpty() ? "Quizanki deck" : cleaned;
    }

    private String dconfJson() throws IOException {
        ObjectNode options = objectMapper.createObjectNode();
        options.put("id", 1);
        options.put("mod", 0);
        options.put("name", "Default");
        options.put("usn", -1);
        options.put("maxTaken", 60);
        options.put("autoplay", true);
        options.put("timer", 0);
        options.put("replayq", true);
        options.put("dyn", false);

        ObjectNode newCards = objectMapper.createObjectNode();
        newCards.set("delays", objectMapper.createArrayNode().add(1.0).add(10.0));
        newCards.set("ints", objectMapper.createArrayNode().add(1).add(4).add(7));
        newCards.put("initialFactor", 2500);
        newCards.put("separate", true);
        newCards.put("order", 1);
        newCards.put("perDay", 20);
        newCards.put("bury", false);
        options.set("new", newCards);

        ObjectNode rev = objectMapper.createObjectNode();
        rev.put("perDay", 200);
        rev.put("ease4", 1.3);
        rev.put("fuzz", 0.05);
        rev.put("minSpace", 1);
        rev.put("ivlFct", 1.0);
        rev.put("maxIvl", 36500);
        rev.put("bury", false);
        rev.put("hardFactor", 1.2);
        options.set("rev", rev);

        ObjectNode lapse = objectMapper.createObjectNode();
        lapse.set("delays", objectMapper.createArrayNode().add(10.0));
        lapse.put("mult", 0.0);
        lapse.put("minInt", 1);
        lapse.put("leechFails", 8);
        lapse.put("leechAction", 0);
        options.set("lapse", lapse);

        ObjectNode dconf = objectMapper.createObjectNode();
        dconf.set("1", options);
        return write(dconf);
    }

    private String writeJson(Map<String, String> map) throws IOException {
        ObjectNode node = objectMapper.createObjectNode();
        map.forEach(node::put);
        return write(node);
    }

    private String write(ObjectNode node) throws IOException {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException e) {
            throw new IOException("Could not serialise an Anki collection blob", e);
        }
    }
}
