package com.ankiquiz.service;

import com.ankiquiz.dto.response.ApkgNotesResponse;
import com.ankiquiz.dto.response.ApkgNotesResponse.NoteTypeNotes;
import com.ankiquiz.exception.ApkgParseException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.luben.zstd.ZstdOutputStream;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ApkgParserServiceTest {

    private final ApkgParserService service = new ApkgParserService(new ObjectMapper());

    /** Anki's field separator inside the `flds` blob. */
    private static final char SEP = 0x1F;

    private static final String BASIC_MODEL = """
            {"1607392319":{"id":1607392319,"name":"Basic","type":0,
              "flds":[{"name":"Front","ord":0},{"name":"Back","ord":1}],
              "tmpls":[{"name":"Card 1","ord":0,
                "qfmt":"{{Front}}","afmt":"{{FrontSide}}<hr>{{Back}}"}]}}
            """;

    private record NoteRow(long mid, String tags, String flds) {
    }

    private static String flds(String... values) {
        return String.join(String.valueOf(SEP), values);
    }

    private static MockMultipartFile apkg(String filename, byte[] bytes) {
        return new MockMultipartFile("file", filename, "application/octet-stream", bytes);
    }

    // ── Happy paths ───────────────────────────────────────────────────────────

    @Test
    void parsesNotes_mapsFieldsToNoteTypeNames() throws Exception {
        byte[] bytes = buildApkg("collection.anki2", BASIC_MODEL,
                List.of(new NoteRow(1607392319L, "", flds("こんにちは", "hello"))));

        ApkgNotesResponse resp = service.parseNotes(apkg("deck.apkg", bytes));

        assertEquals("legacy", resp.schema());
        assertEquals(1, resp.totalNotes());
        assertEquals(0, resp.skippedNotes());
        assertEquals(1, resp.noteTypes().size());

        NoteTypeNotes type = resp.noteTypes().get(0);
        assertEquals("Basic", type.name());
        assertEquals(List.of("Front", "Back"), type.fieldNames());
        assertEquals(1, type.noteCount());
        assertEquals("こんにちは", type.notes().get(0).fields().get("Front"));
        assertEquals("hello", type.notes().get(0).fields().get("Back"));
        // Front/back derived from the card template (qfmt/afmt).
        assertEquals(List.of("Front"), type.frontFields());
        assertEquals(List.of("Back"), type.backFields());
    }

    @Test
    void derivesFrontBackFields_fromTemplate_handlingFiltersConditionalsAndFrontSide() throws Exception {
        // qfmt uses a {{hint:...}} filter; afmt re-shows the front via {{FrontSide}},
        // references a field twice (plain + {{#...}} conditional), and adds a new one.
        String models = """
                {"300":{"id":300,"name":"Vocab","type":0,
                   "flds":[{"name":"Word","ord":0},{"name":"Reading","ord":1},
                           {"name":"Meaning","ord":2},{"name":"Example","ord":3}],
                   "tmpls":[{"name":"Recognition","ord":0,
                     "qfmt":"{{Word}}<br>{{hint:Reading}}",
                     "afmt":"{{FrontSide}}<hr>{{Meaning}}{{#Example}}<div>{{Example}}</div>{{/Example}}"}]}}
                """;
        byte[] bytes = buildApkg("collection.anki2", models,
                List.of(new NoteRow(300L, "", flds("猫", "ねこ", "cat", "猫がいる"))));

        NoteTypeNotes type = service.parseNotes(apkg("deck.apkg", bytes)).noteTypes().get(0);

        // {{hint:Reading}} -> Reading; order preserved.
        assertEquals(List.of("Word", "Reading"), type.frontFields());
        // {{FrontSide}} is not a field; Word/Reading already on front are excluded;
        // Example appears twice (conditional + value) but is de-duplicated.
        assertEquals(List.of("Meaning", "Example"), type.backFields());
    }

    @Test
    void cleansValues_blockTagsBecomeSpace_inlineTagsDropped_soundAndEntitiesHandled() throws Exception {
        String dirty = "<div>line one</div><br>line two &amp; <b>bold</b>word [sound:a.mp3]";
        byte[] bytes = buildApkg("collection.anki2", BASIC_MODEL,
                List.of(new NoteRow(1607392319L, "", flds("Q", dirty))));

        ApkgNotesResponse resp = service.parseNotes(apkg("deck.apkg", bytes));

        // <div>/<br> -> space (no word mashing), <b> dropped (no word split),
        // [sound:] removed, &amp; decoded, whitespace collapsed.
        assertEquals("line one line two & boldword",
                resp.noteTypes().get(0).notes().get(0).fields().get("Back"));
    }

    @Test
    void parsesTags_trimsAndSplitsOnWhitespace() throws Exception {
        byte[] bytes = buildApkg("collection.anki2", BASIC_MODEL,
                List.of(new NoteRow(1607392319L, "  greeting  jp  ", flds("a", "b"))));

        List<String> tags = service.parseNotes(apkg("deck.apkg", bytes))
                .noteTypes().get(0).notes().get(0).tags();

        assertEquals(List.of("greeting", "jp"), tags);
    }

    @Test
    void padsMissingFields_whenNoteHasFewerValuesThanFieldNames() throws Exception {
        byte[] bytes = buildApkg("collection.anki2", BASIC_MODEL,
                List.of(new NoteRow(1607392319L, "", "only front"))); // no separator -> 1 value

        var fields = service.parseNotes(apkg("deck.apkg", bytes))
                .noteTypes().get(0).notes().get(0).fields();

        assertEquals("only front", fields.get("Front"));
        assertEquals("", fields.get("Back"));
    }

    @Test
    void groupsNotesByNoteType_acrossMultipleModels() throws Exception {
        String models = """
                {"100":{"id":100,"name":"Basic","type":0,
                   "flds":[{"name":"Front","ord":0},{"name":"Back","ord":1}]},
                 "200":{"id":200,"name":"Cloze","type":1,
                   "flds":[{"name":"Text","ord":0}]}}
                """;
        byte[] bytes = buildApkg("collection.anki2", models, List.of(
                new NoteRow(100L, "", flds("f1", "b1")),
                new NoteRow(100L, "", flds("f2", "b2")),
                new NoteRow(200L, "", "some {{c1::cloze}}")));

        ApkgNotesResponse resp = service.parseNotes(apkg("deck.apkg", bytes));

        assertEquals(3, resp.totalNotes());
        NoteTypeNotes basic = resp.noteTypes().stream()
                .filter(t -> t.name().equals("Basic")).findFirst().orElseThrow();
        NoteTypeNotes cloze = resp.noteTypes().stream()
                .filter(t -> t.name().equals("Cloze")).findFirst().orElseThrow();
        assertEquals(2, basic.noteCount());
        assertEquals(1, cloze.noteCount());
        assertTrue(cloze.cloze(), "type:1 model should be flagged cloze");
    }

    @Test
    void countsNotesWithUnknownModel_asSkipped() throws Exception {
        byte[] bytes = buildApkg("collection.anki2", BASIC_MODEL, List.of(
                new NoteRow(1607392319L, "", flds("a", "b")),
                new NoteRow(999999L, "", flds("orphan", "note")))); // mid not in models

        ApkgNotesResponse resp = service.parseNotes(apkg("deck.apkg", bytes));

        assertEquals(1, resp.totalNotes());
        assertEquals(1, resp.skippedNotes());
        assertEquals(0, resp.imageOnlyNotes());
    }

    @Test
    void excludesImageOnlyNotes_andCountsThem() throws Exception {
        // Three notes: one normal, one image-only (both fields are just <img>),
        // and one with text + image (the image strips out, the text survives).
        byte[] bytes = buildApkg("collection.anki2", BASIC_MODEL, List.of(
                new NoteRow(1607392319L, "", flds("hello", "world")),
                new NoteRow(1607392319L, "", flds("<img src=\"a.jpg\">", "<img src=\"b.jpg\">")),
                new NoteRow(1607392319L, "", flds("Look:", "answer <img src=\"c.jpg\">"))));

        ApkgNotesResponse resp = service.parseNotes(apkg("deck.apkg", bytes));

        assertEquals(2, resp.totalNotes());
        assertEquals(1, resp.imageOnlyNotes());
        assertEquals(0, resp.skippedNotes());
        // Mixed-content note: <img> dropped, surrounding text kept.
        var kept = resp.noteTypes().get(0).notes();
        assertEquals("Look:", kept.get(1).fields().get("Front"));
        assertEquals("answer", kept.get(1).fields().get("Back"));
    }

    @Test
    void excludesImageOcclusionEnhancedNotes_byClozeMarker() throws Exception {
        // IO Enhanced add-on stores rect coordinates inside a cloze marker that
        // would otherwise slip through as gibberish quiz text. Detected by the
        // {{c\d+::image-occlusion ...}} pattern regardless of note-type name.
        String ioField = "{{c1::image-occlusion:rect:left=.027:top=.0842:width=.9462:height=.9158:oi=1}}";
        byte[] bytes = buildApkg("collection.anki2", BASIC_MODEL, List.of(
                new NoteRow(1607392319L, "", flds("hello", "world")),
                new NoteRow(1607392319L, "", flds(ioField, "extra notes about anatomy"))));

        ApkgNotesResponse resp = service.parseNotes(apkg("deck.apkg", bytes));

        assertEquals(1, resp.totalNotes(), "only the non-IO note is included");
        assertEquals(1, resp.imageOnlyNotes(), "IO Enhanced note is excluded + counted");
        assertEquals("hello", resp.noteTypes().get(0).notes().get(0).fields().get("Front"));
    }

    @Test
    void excludesAllNotes_whenNoteTypeNameSaysImageOcclusion() throws Exception {
        // Anki's official IO note type. Even if some text fields are populated
        // (e.g. "Header" / internal ID), the note has no usable Q/A pair.
        String ioModel = """
                {"42":{"id":42,"name":"Image Occlusion Enhanced","type":1,
                  "flds":[{"name":"Header","ord":0},{"name":"Image","ord":1},
                          {"name":"Original Mask","ord":2},{"name":"ID","ord":3}]}}
                """;
        byte[] bytes = buildApkg("collection.anki2", ioModel, List.of(
                new NoteRow(42L, "", flds("Heart anatomy", "<img src=heart.jpg>", "<img src=mask.svg>", "1604247200000"))));

        ApkgNotesResponse resp = service.parseNotes(apkg("deck.apkg", bytes));

        assertEquals(0, resp.totalNotes(), "IO note types contribute no quizzable notes");
        assertEquals(1, resp.imageOnlyNotes());
    }

    @Test
    void rejectsDeckExceedingMaxNotes() throws Exception {
        // Generate MAX_NOTES + 1 valid notes — should trip the cap and abort.
        List<NoteRow> rows = new java.util.ArrayList<>(ApkgParserService.MAX_NOTES + 1);
        for (int i = 0; i <= ApkgParserService.MAX_NOTES; i++) {
            rows.add(new NoteRow(1607392319L, "", flds("q" + i, "a" + i)));
        }
        byte[] bytes = buildApkg("collection.anki2", BASIC_MODEL, rows);

        ApkgParseException ex = assertThrows(ApkgParseException.class,
                () -> service.parseNotes(apkg("deck.apkg", bytes)));
        assertTrue(ex.getMessage().toLowerCase().contains("too large"),
                "expected too-large message, got: " + ex.getMessage());
    }

    @Test
    void parsesZstdCompressedCollection() throws Exception {
        byte[] bytes = buildApkg("collection.anki21b", BASIC_MODEL,
                List.of(new NoteRow(1607392319L, "", flds("zstd", "works"))));

        ApkgNotesResponse resp = service.parseNotes(apkg("deck.apkg", bytes));

        assertEquals("collection.anki21b", resp.collectionFile());
        assertEquals(1, resp.totalNotes());
        assertEquals("works", resp.noteTypes().get(0).notes().get(0).fields().get("Back"));
    }

    // ── Rejections ────────────────────────────────────────────────────────────

    @Test
    void rejectsEmptyFile() {
        ApkgParseException ex = assertThrows(ApkgParseException.class,
                () -> service.parseNotes(apkg("deck.apkg", new byte[0])));
        assertTrue(ex.getMessage().toLowerCase().contains("empty"));
    }

    @Test
    void rejectsNonApkgExtension() {
        ApkgParseException ex = assertThrows(ApkgParseException.class,
                () -> service.parseNotes(apkg("notes.txt", new byte[]{1, 2, 3})));
        assertTrue(ex.getMessage().contains("Only .apkg"));
    }

    @Test
    void rejectsNonZipContent() {
        byte[] notAZip = "this is plainly not a zip file".getBytes(StandardCharsets.UTF_8);
        // Either "not a valid .apkg (zip)" or "No Anki collection", depending on how
        // ZipInputStream reacts to the garbage — both are ApkgParseException.
        assertThrows(ApkgParseException.class,
                () -> service.parseNotes(apkg("deck.apkg", notAZip)));
    }

    @Test
    void rejectsZipWithoutCollection() throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            zos.putNextEntry(new ZipEntry("media"));
            zos.write("{}".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
        ApkgParseException ex = assertThrows(ApkgParseException.class,
                () -> service.parseNotes(apkg("deck.apkg", baos.toByteArray())));
        assertTrue(ex.getMessage().contains("No Anki collection"));
    }

    // ── Fixture builder ─────────────────────────────────────────────────────────

    /**
     * Builds a minimal {@code .apkg}: a zip containing a SQLite collection (with
     * the {@code col.models} JSON and {@code notes} rows) plus an empty media
     * manifest. When {@code entryName} is {@code collection.anki21b} the db is
     * zstd-compressed, mirroring newer Anki exports.
     */
    private static byte[] buildApkg(String entryName, String modelsJson, List<NoteRow> notes)
            throws Exception {
        Path db = Files.createTempFile("fixture-", ".sqlite");
        try {
            try (Connection c = DriverManager.getConnection("jdbc:sqlite:" + db.toAbsolutePath())) {
                try (Statement st = c.createStatement()) {
                    st.execute("CREATE TABLE col (models TEXT)");
                    st.execute("CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, tags TEXT, flds TEXT)");
                }
                try (PreparedStatement ps = c.prepareStatement("INSERT INTO col(models) VALUES (?)")) {
                    ps.setString(1, modelsJson);
                    ps.executeUpdate();
                }
                try (PreparedStatement ps =
                             c.prepareStatement("INSERT INTO notes(mid, tags, flds) VALUES (?, ?, ?)")) {
                    for (NoteRow n : notes) {
                        ps.setLong(1, n.mid());
                        ps.setString(2, n.tags());
                        ps.setString(3, n.flds());
                        ps.addBatch();
                    }
                    ps.executeBatch();
                }
            }

            byte[] dbBytes = Files.readAllBytes(db);
            if (entryName.equals("collection.anki21b")) {
                ByteArrayOutputStream compressed = new ByteArrayOutputStream();
                try (ZstdOutputStream z = new ZstdOutputStream(compressed)) {
                    z.write(dbBytes);
                }
                dbBytes = compressed.toByteArray();
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            try (ZipOutputStream zos = new ZipOutputStream(baos)) {
                zos.putNextEntry(new ZipEntry(entryName));
                zos.write(dbBytes);
                zos.closeEntry();
                zos.putNextEntry(new ZipEntry("media"));
                zos.write("{}".getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            }
            return baos.toByteArray();
        } finally {
            Files.deleteIfExists(db);
        }
    }
}
