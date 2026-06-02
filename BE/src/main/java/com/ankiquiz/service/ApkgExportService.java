package com.ankiquiz.service;

import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Note;
import com.ankiquiz.entity.NoteType;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import com.ankiquiz.repository.NoteTypeRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Assembles a deck into a legacy (schema 11) Anki <code>.apkg</code>: a zip of a
 * SQLite <code>collection.anki2</code> plus an empty <code>media</code> map.
 * Schema 11 is the most broadly importable target — current Anki still reads it.
 * Only notes and their fields are exported; review history / scheduling is reset
 * (every card is "new"), and media is dropped (we already strip images on import).
 */
@Service
public class ApkgExportService {

    private static final char FIELD_SEPARATOR = ''; // Anki joins fields with US (0x1f)
    private static final Pattern CLOZE = Pattern.compile("\\{\\{c(\\d+)::");
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]+>");
    // Anki's guid alphabet (base91), see anki/rslib utils.
    private static final String BASE91 =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~";

    private final DeckRepository deckRepository;
    private final NoteTypeRepository noteTypeRepository;
    private final NoteRepository noteRepository;
    private final ObjectMapper objectMapper;

    public ApkgExportService(DeckRepository deckRepository,
                             NoteTypeRepository noteTypeRepository,
                             NoteRepository noteRepository,
                             ObjectMapper objectMapper) {
        this.deckRepository = deckRepository;
        this.noteTypeRepository = noteTypeRepository;
        this.noteRepository = noteRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public byte[] export(String userId, UUID deckId) {
        Deck deck = deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        List<NoteType> types = noteTypeRepository.findAllByDeckId(deckId);
        List<Note> notes = noteRepository.findAllByDeckIdOrderById(deckId);

        Path tmp = null;
        try {
            tmp = Files.createTempFile("ankiquiz-export-", ".anki2");
            byte[] collection = buildCollection(tmp, deck, types, notes);
            return zip(collection);
        } catch (IOException | SQLException e) {
            throw new UncheckedIOException(new IOException("Failed to build .apkg", e));
        } finally {
            if (tmp != null) {
                try {
                    Files.deleteIfExists(tmp);
                } catch (IOException ignored) {
                    // temp file cleanup is best-effort
                }
            }
        }
    }

    private byte[] buildCollection(Path dbFile, Deck deck, List<NoteType> types, List<Note> notes)
            throws SQLException, IOException {
        long nowMs = System.currentTimeMillis();
        long nowSec = nowMs / 1000;
        long deckId = nowMs; // Anki deck id; must differ from the reserved Default (1)

        // Assign a stable Anki model id to each of our note types.
        Map<UUID, Long> midByType = new LinkedHashMap<>();
        Map<UUID, NoteType> typeById = new LinkedHashMap<>();
        long midSeed = nowMs;
        for (NoteType t : types) {
            midByType.put(t.getId(), midSeed++);
            typeById.put(t.getId(), t);
        }

        String modelsJson = buildModelsJson(types, midByType, nowSec);
        String decksJson = buildDecksJson(deckId, deck.getName(), nowSec);
        String dconfJson = buildDconfJson();
        String confJson = buildConfJson(types.isEmpty() ? "1" : String.valueOf(midByType.values().iterator().next()));

        try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + dbFile.toAbsolutePath())) {
            conn.setAutoCommit(false);
            createSchema(conn);
            insertCol(conn, nowSec, nowMs, confJson, modelsJson, decksJson, dconfJson);
            insertNotesAndCards(conn, notes, typeById, midByType, deckId, nowSec);
            conn.commit();
        }
        return Files.readAllBytes(dbFile);
    }

    private void createSchema(Connection conn) throws SQLException {
        String[] ddl = {
                "CREATE TABLE col (id integer PRIMARY KEY, crt integer NOT NULL, mod integer NOT NULL, "
                        + "scm integer NOT NULL, ver integer NOT NULL, dty integer NOT NULL, usn integer NOT NULL, "
                        + "ls integer NOT NULL, conf text NOT NULL, models text NOT NULL, decks text NOT NULL, "
                        + "dconf text NOT NULL, tags text NOT NULL)",
                "CREATE TABLE notes (id integer PRIMARY KEY, guid text NOT NULL, mid integer NOT NULL, "
                        + "mod integer NOT NULL, usn integer NOT NULL, tags text NOT NULL, flds text NOT NULL, "
                        + "sfld integer NOT NULL, csum integer NOT NULL, flags integer NOT NULL, data text NOT NULL)",
                "CREATE TABLE cards (id integer PRIMARY KEY, nid integer NOT NULL, did integer NOT NULL, "
                        + "ord integer NOT NULL, mod integer NOT NULL, usn integer NOT NULL, type integer NOT NULL, "
                        + "queue integer NOT NULL, due integer NOT NULL, ivl integer NOT NULL, factor integer NOT NULL, "
                        + "reps integer NOT NULL, lapses integer NOT NULL, left integer NOT NULL, odue integer NOT NULL, "
                        + "odid integer NOT NULL, flags integer NOT NULL, data text NOT NULL)",
                "CREATE TABLE revlog (id integer PRIMARY KEY, cid integer NOT NULL, usn integer NOT NULL, "
                        + "ease integer NOT NULL, ivl integer NOT NULL, lastIvl integer NOT NULL, factor integer NOT NULL, "
                        + "time integer NOT NULL, type integer NOT NULL)",
                "CREATE TABLE graves (usn integer NOT NULL, oid integer NOT NULL, type integer NOT NULL)",
                "CREATE INDEX ix_notes_usn ON notes (usn)",
                "CREATE INDEX ix_cards_usn ON cards (usn)",
                "CREATE INDEX ix_cards_nid ON cards (nid)",
                "CREATE INDEX ix_cards_sched ON cards (did, queue, due)",
                "CREATE INDEX ix_revlog_cid ON revlog (cid)",
                "CREATE INDEX ix_notes_csum ON notes (csum)",
        };
        try (Statement st = conn.createStatement()) {
            for (String sql : ddl) {
                st.execute(sql);
            }
        }
    }

    private void insertCol(Connection conn, long crtSec, long modMs, String conf, String models,
                           String decks, String dconf) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) "
                        + "VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')")) {
            ps.setLong(1, crtSec);
            ps.setLong(2, modMs);
            ps.setLong(3, modMs);
            ps.setString(4, conf);
            ps.setString(5, models);
            ps.setString(6, decks);
            ps.setString(7, dconf);
            ps.executeUpdate();
        }
    }

    private void insertNotesAndCards(Connection conn, List<Note> notes, Map<UUID, NoteType> typeById,
                                     Map<UUID, Long> midByType, long deckId, long nowSec) throws SQLException {
        AtomicLong idSeq = new AtomicLong(System.currentTimeMillis());
        long[] due = {1};

        String noteSql = "INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) "
                + "VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 0, '')";
        String cardSql = "INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, "
                + "reps, lapses, left, odue, odid, flags, data) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')";

        try (PreparedStatement notePs = conn.prepareStatement(noteSql);
             PreparedStatement cardPs = conn.prepareStatement(cardSql)) {
            for (Note note : notes) {
                NoteType type = typeById.get(note.getNoteTypeId());
                if (type == null) {
                    continue; // a note whose type didn't load can't be templated
                }
                long mid = midByType.get(type.getId());
                String[] fieldNames = type.getFieldNames() == null ? new String[0] : type.getFieldNames();
                List<String> values = new ArrayList<>(fieldNames.length);
                Map<String, String> fields = note.getFields() == null ? Map.of() : note.getFields();
                for (String name : fieldNames) {
                    values.add(fields.getOrDefault(name, ""));
                }
                String flds = String.join(String.valueOf(FIELD_SEPARATOR), values);
                String sortField = stripHtml(values.isEmpty() ? "" : values.get(0));

                long noteId = idSeq.incrementAndGet();
                notePs.setLong(1, noteId);
                notePs.setString(2, guid64(noteId));
                notePs.setLong(3, mid);
                notePs.setLong(4, nowSec);
                notePs.setString(5, formatTags(note.getTags()));
                notePs.setString(6, flds);
                notePs.setString(7, sortField);
                notePs.setLong(8, fieldChecksum(sortField));
                notePs.executeUpdate();

                for (int ord : cardOrdinals(type, flds)) {
                    cardPs.setLong(1, idSeq.incrementAndGet());
                    cardPs.setLong(2, noteId);
                    cardPs.setLong(3, deckId);
                    cardPs.setInt(4, ord);
                    cardPs.setLong(5, nowSec);
                    cardPs.setLong(6, due[0]++);
                    cardPs.executeUpdate();
                }
            }
        }
    }

    // Which card ordinals a note generates. Basic notes get one card (ord 0);
    // cloze notes get one per distinct {{c<n>::}} index (ord = n-1), falling back
    // to ord 0 so a marker-less cloze note still produces a card.
    private List<Integer> cardOrdinals(NoteType type, String flds) {
        if (!type.isCloze()) {
            return List.of(0);
        }
        TreeSet<Integer> ords = new TreeSet<>();
        Matcher m = CLOZE.matcher(flds);
        while (m.find()) {
            int idx = Integer.parseInt(m.group(1));
            if (idx >= 1) {
                ords.add(idx - 1);
            }
        }
        return ords.isEmpty() ? List.of(0) : new ArrayList<>(ords);
    }

    // ── JSON blobs stored in the col row ─────────────────────────────────────

    private String buildModelsJson(List<NoteType> types, Map<UUID, Long> midByType, long nowSec) {
        Map<String, Object> models = new LinkedHashMap<>();
        for (NoteType t : types) {
            long mid = midByType.get(t.getId());
            String[] fieldNames = t.getFieldNames() == null ? new String[0] : t.getFieldNames();

            List<Map<String, Object>> flds = new ArrayList<>();
            for (int i = 0; i < fieldNames.length; i++) {
                Map<String, Object> f = new LinkedHashMap<>();
                f.put("name", fieldNames[i]);
                f.put("ord", i);
                f.put("sticky", false);
                f.put("rtl", false);
                f.put("font", "Arial");
                f.put("size", 20);
                f.put("media", List.of());
                flds.add(f);
            }

            String firstField = fieldNames.length > 0 ? fieldNames[0] : "Front";
            String secondField = fieldNames.length > 1 ? fieldNames[1] : firstField;

            List<Map<String, Object>> tmpls = new ArrayList<>();
            Map<String, Object> tmpl = new LinkedHashMap<>();
            if (t.isCloze()) {
                tmpl.put("name", "Cloze");
                tmpl.put("qfmt", "{{cloze:" + firstField + "}}");
                tmpl.put("afmt", "{{cloze:" + firstField + "}}");
            } else {
                tmpl.put("name", "Card 1");
                tmpl.put("qfmt", "{{" + firstField + "}}");
                tmpl.put("afmt", "{{FrontSide}}\n\n<hr id=answer>\n\n{{" + secondField + "}}");
            }
            tmpl.put("ord", 0);
            tmpl.put("bqfmt", "");
            tmpl.put("bafmt", "");
            tmpl.put("did", null);
            tmpls.add(tmpl);

            Map<String, Object> model = new LinkedHashMap<>();
            model.put("id", mid);
            model.put("name", t.getName());
            model.put("type", t.isCloze() ? 1 : 0);
            model.put("mod", nowSec);
            model.put("usn", 0);
            model.put("sortf", 0);
            model.put("did", 1);
            model.put("tmpls", tmpls);
            model.put("flds", flds);
            model.put("css", ".card{font-family:arial;font-size:20px;text-align:center;color:black;background-color:white;}");
            model.put("latexPre", "");
            model.put("latexPost", "");
            model.put("req", buildReq(fieldNames.length, t.isCloze()));
            model.put("tags", List.of());
            model.put("vers", List.of());
            models.put(String.valueOf(mid), model);
        }
        return write(models);
    }

    // `req` tells legacy Anki which fields a template needs. Cloze models leave it
    // empty; standard models require any of the fields to be non-empty for ord 0.
    private List<Object> buildReq(int fieldCount, boolean cloze) {
        if (cloze) {
            return List.of();
        }
        List<Integer> ords = new ArrayList<>();
        for (int i = 0; i < Math.max(fieldCount, 1); i++) {
            ords.add(i);
        }
        return List.of(List.of(0, "any", ords));
    }

    private String buildDecksJson(long deckId, String deckName, long nowSec) {
        Map<String, Object> decks = new LinkedHashMap<>();
        decks.put("1", deckDict(1L, "Default", nowSec));
        decks.put(String.valueOf(deckId), deckDict(deckId, deckName, nowSec));
        return write(decks);
    }

    private Map<String, Object> deckDict(long id, String name, long nowSec) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("id", id);
        d.put("mod", nowSec);
        d.put("name", name);
        d.put("usn", 0);
        d.put("lrnToday", List.of(0, 0));
        d.put("revToday", List.of(0, 0));
        d.put("newToday", List.of(0, 0));
        d.put("timeToday", List.of(0, 0));
        d.put("collapsed", false);
        d.put("browserCollapsed", false);
        d.put("desc", "");
        d.put("dyn", 0);
        d.put("conf", 1);
        d.put("extendNew", 0);
        d.put("extendRev", 0);
        return d;
    }

    private String buildDconfJson() {
        Map<String, Object> newConf = new LinkedHashMap<>();
        newConf.put("bury", false);
        newConf.put("delays", List.of(1.0, 10.0));
        newConf.put("initialFactor", 2500);
        newConf.put("ints", List.of(1, 4, 0));
        newConf.put("order", 1);
        newConf.put("perDay", 20);
        newConf.put("separate", true);

        Map<String, Object> revConf = new LinkedHashMap<>();
        revConf.put("bury", false);
        revConf.put("ease4", 1.3);
        revConf.put("ints", List.of(1, 7, 4));
        revConf.put("maxIvl", 36500);
        revConf.put("perDay", 200);
        revConf.put("hardFactor", 1.2);
        revConf.put("fuzz", 0.05);
        revConf.put("minSpace", 1);

        Map<String, Object> lapseConf = new LinkedHashMap<>();
        lapseConf.put("delays", List.of(10.0));
        lapseConf.put("leechAction", 1);
        lapseConf.put("leechFails", 8);
        lapseConf.put("minInt", 1);
        lapseConf.put("mult", 0.0);

        Map<String, Object> conf = new LinkedHashMap<>();
        conf.put("id", 1);
        conf.put("mod", 0);
        conf.put("name", "Default");
        conf.put("usn", 0);
        conf.put("maxTaken", 60);
        conf.put("autoplay", true);
        conf.put("timer", 0);
        conf.put("replayq", true);
        conf.put("new", newConf);
        conf.put("rev", revConf);
        conf.put("lapse", lapseConf);
        conf.put("dyn", false);

        return write(Map.of("1", conf));
    }

    private String buildConfJson(String curModel) {
        Map<String, Object> conf = new LinkedHashMap<>();
        conf.put("nextPos", 1);
        conf.put("estTimes", true);
        conf.put("activeDecks", List.of(1));
        conf.put("sortType", "noteFld");
        conf.put("timeLim", 0);
        conf.put("sortBackwards", false);
        conf.put("addToCur", true);
        conf.put("curDeck", 1);
        conf.put("newBury", true);
        conf.put("newSpread", 0);
        conf.put("dueCounts", true);
        conf.put("curModel", curModel);
        conf.put("collapseTime", 1200);
        return write(conf);
    }

    // ── zip + helpers ────────────────────────────────────────────────────────

    private byte[] zip(byte[] collection) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            zos.putNextEntry(new ZipEntry("collection.anki2"));
            zos.write(collection);
            zos.closeEntry();
            // No media: an empty JSON map keeps the importer happy.
            zos.putNextEntry(new ZipEntry("media"));
            zos.write("{}".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
        return baos.toByteArray();
    }

    private static String stripHtml(String value) {
        return value == null ? "" : HTML_TAG.matcher(value).replaceAll("").trim();
    }

    // Anki stores tags space-separated with a leading and trailing space; empty
    // when there are none.
    private static String formatTags(String[] tags) {
        if (tags == null || tags.length == 0) {
            return "";
        }
        StringBuilder sb = new StringBuilder(" ");
        for (String tag : tags) {
            if (tag != null && !tag.isBlank()) {
                sb.append(tag.replace(' ', '_')).append(' ');
            }
        }
        return sb.length() == 1 ? "" : sb.toString();
    }

    // Anki's note checksum: first 8 hex digits of SHA1(sortField) as an integer.
    private static long fieldChecksum(String sortField) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] digest = md.digest(sortField.getBytes(StandardCharsets.UTF_8));
            long value = 0;
            for (int i = 0; i < 4; i++) {
                value = (value << 8) | (digest[i] & 0xffL);
            }
            return value; // top 32 bits of the SHA1 == first 8 hex digits
        } catch (NoSuchAlgorithmException e) {
            return 0L;
        }
    }

    // Anki guid: a base91 encoding of a 64-bit value. Uniqueness is all that
    // matters for import; we seed from the (unique) note id.
    private static String guid64(long seed) {
        long num = seed ^ (seed >>> 17) ^ 0x5DEECE66DL;
        if (num < 0) {
            num = -num;
        }
        StringBuilder sb = new StringBuilder();
        int base = BASE91.length();
        do {
            sb.append(BASE91.charAt((int) (num % base)));
            num /= base;
        } while (num > 0);
        return sb.toString();
    }

    private String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new UncheckedIOException(e);
        }
    }
}
