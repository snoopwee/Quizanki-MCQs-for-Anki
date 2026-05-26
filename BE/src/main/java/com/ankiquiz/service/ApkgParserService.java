package com.ankiquiz.service;

import com.ankiquiz.dto.response.ApkgNotesResponse;
import com.ankiquiz.dto.response.ApkgNotesResponse.NoteTypeNotes;
import com.ankiquiz.dto.response.ApkgNotesResponse.ParsedNote;
import com.ankiquiz.exception.ApkgParseException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.luben.zstd.ZstdInputStream;
import org.sqlite.SQLiteConfig;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipException;
import java.util.zip.ZipInputStream;

/**
 * Parses Anki {@code .apkg} files. An .apkg is a zip archive containing a SQLite
 * collection ({@code collection.anki2} / {@code .anki21} / {@code .anki21b}),
 * a media manifest, and media blobs.
 *
 * <p>We treat the upload strictly as read-only data: we never execute anything
 * from it, never write files using its entry names (zip-slip immune), and never
 * extract or serve its media. The collection is opened <b>read-only with
 * extensions disabled</b>, and we only run our own fixed/parameterized queries.
 *
 * <p>Chunk 4 implements {@link #parseNotes(MultipartFile)} — it reads the notes,
 * maps each note's fields to its own note type's field names, cleans the values,
 * and groups the result by note type.
 */
@Service
public class ApkgParserService {

    /** The SQLite collection file names Anki uses; {@code .anki21b} is zstd-compressed. */
    static final Set<String> COLLECTION_NAMES =
            Set.of("collection.anki2", "collection.anki21", "collection.anki21b");

    private static final String ZSTD_COLLECTION = "collection.anki21b";

    /** Anki joins a note's field values with the unit-separator (0x1F) control char. */
    private static final String FIELD_SEPARATOR = String.valueOf((char) 0x1F);

    private static final Pattern SOUND_TAG = Pattern.compile("\\[sound:[^]]*]");
    // Block / line-break tags become a space so adjacent text isn't mashed together
    // (e.g. "...đóng2." from list items, lines joined by <br>); remaining inline
    // tags are then dropped without inserting a space, so words aren't split.
    private static final Pattern BLOCK_TAG = Pattern.compile(
            "(?i)<\\s*/?\\s*(br|div|p|li|tr|h[1-6]|hr|blockquote)\\b[^>]*>");
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]*>");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    /**
     * Coarse guard against pathological archives. Media-heavy decks legitimately
     * have many entries, so this is generous; the real zip-bomb defense is
     * {@link #MAX_COLLECTION_BYTES}, enforced on the bytes we actually read.
     */
    static final int MAX_ENTRIES = 100_000;

    /** Hard cap on the decompressed collection db — aborts zip/zstd bombs. */
    static final long MAX_COLLECTION_BYTES = 200L * 1024 * 1024; // 200 MB

    private final ObjectMapper objectMapper;

    public ApkgParserService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /** A collection extracted to a temp file, ready to open as SQLite. */
    private record ExtractedCollection(String name, Path dbFile, boolean zstd) {
    }

    /** A field's position and name within a note type. */
    private record FieldRef(int ord, String name) {
    }

    /** Resolved note type: its ordered field names + cloze flag. */
    private record NoteTypeInfo(long id, String name, boolean cloze, List<String> fieldNames) {
    }

    /** Extracts the collection and returns its notes grouped by note type. */
    public ApkgNotesResponse parseNotes(MultipartFile file) {
        ExtractedCollection col = extractCollection(file);
        try (Connection conn = openReadOnly(col.dbFile())) {
            boolean modern = tableExists(conn, "notetypes") && tableExists(conn, "fields");
            Map<Long, NoteTypeInfo> types = modern ? readModernNoteTypes(conn) : readLegacyNoteTypes(conn);

            Map<Long, List<ParsedNote>> notesByType = new LinkedHashMap<>();
            int total = 0;
            int skipped = 0;
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT id, mid, tags, flds FROM notes")) {
                while (rs.next()) {
                    NoteTypeInfo type = types.get(rs.getLong("mid"));
                    if (type == null) {
                        skipped++; // note references a model we couldn't resolve
                        continue;
                    }
                    ParsedNote note = new ParsedNote(
                            String.valueOf(rs.getLong("id")),
                            mapFields(type.fieldNames(), rs.getString("flds")),
                            parseTags(rs.getString("tags")));
                    notesByType.computeIfAbsent(type.id(), k -> new ArrayList<>()).add(note);
                    total++;
                }
            }

            List<NoteTypeNotes> out = new ArrayList<>();
            for (NoteTypeInfo type : types.values()) {
                List<ParsedNote> notes = notesByType.getOrDefault(type.id(), List.of());
                out.add(new NoteTypeNotes(
                        type.id(), type.name(), type.cloze(), type.fieldNames(),
                        notes.size(), notes));
            }
            return new ApkgNotesResponse(
                    file.getOriginalFilename(), col.name(), modern ? "modern" : "legacy",
                    total, skipped, out);
        } catch (SQLException e) {
            throw new ApkgParseException("Could not read notes from the collection.", e);
        } finally {
            deleteQuietly(col.dbFile());
        }
    }

    // ── Note → fields mapping & cleaning ──────────────────────────────────────

    /** Splits a note's {@code flds} blob and maps the values onto the field names. */
    private static Map<String, String> mapFields(List<String> fieldNames, String flds) {
        String[] values = (flds == null ? "" : flds).split(FIELD_SEPARATOR, -1);
        Map<String, String> fields = new LinkedHashMap<>();
        for (int i = 0; i < fieldNames.size(); i++) {
            String raw = i < values.length ? values[i] : "";
            fields.put(fieldNames.get(i), cleanField(raw));
        }
        return fields;
    }

    /** Strips media tags + HTML and decodes the common HTML entities. */
    private static String cleanField(String raw) {
        if (raw == null || raw.isEmpty()) {
            return "";
        }
        String s = SOUND_TAG.matcher(raw).replaceAll("");
        s = BLOCK_TAG.matcher(s).replaceAll(" ");   // keep word/line boundaries
        s = HTML_TAG.matcher(s).replaceAll("");     // drop remaining inline tags
        s = decodeEntities(s);
        return WHITESPACE.matcher(s).replaceAll(" ").strip();
    }

    private static String decodeEntities(String s) {
        return s.replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'");
    }

    /** Anki stores tags space-separated, padded with surrounding spaces. */
    private static List<String> parseTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return List.of();
        }
        return Arrays.stream(tags.strip().split("\\s+")).filter(t -> !t.isEmpty()).toList();
    }

    // ── Note types (legacy: col.models JSON) ──────────────────────────────────

    private Map<Long, NoteTypeInfo> readLegacyNoteTypes(Connection conn) throws SQLException {
        String modelsJson;
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT models FROM col LIMIT 1")) {
            if (!rs.next()) {
                throw new ApkgParseException("Collection has no `col` row; cannot read note types.");
            }
            modelsJson = rs.getString(1);
        }
        if (modelsJson == null || modelsJson.isBlank()) {
            throw new ApkgParseException("Collection `col.models` is empty; cannot read note types.");
        }

        Map<Long, NoteTypeInfo> result = new LinkedHashMap<>();
        try {
            JsonNode root = objectMapper.readTree(modelsJson); // object: modelId -> model
            Iterator<Map.Entry<String, JsonNode>> models = root.fields();
            while (models.hasNext()) {
                Map.Entry<String, JsonNode> entry = models.next();
                JsonNode model = entry.getValue();
                long id = model.path("id").asLong(parseLongOrZero(entry.getKey()));
                String name = model.path("name").asText("");
                boolean cloze = model.path("type").asInt(0) == 1; // 0=standard, 1=cloze

                List<FieldRef> flds = new ArrayList<>();
                for (JsonNode f : model.path("flds")) {
                    flds.add(new FieldRef(f.path("ord").asInt(flds.size()), f.path("name").asText("")));
                }
                result.put(id, new NoteTypeInfo(id, name, cloze, orderedNames(flds)));
            }
        } catch (JsonProcessingException e) {
            throw new ApkgParseException("Could not parse note-type definitions (col.models JSON).", e);
        }
        return result;
    }

    // ── Note types (modern: notetypes/fields tables) ─────────────────────────

    private Map<Long, NoteTypeInfo> readModernNoteTypes(Connection conn) throws SQLException {
        Map<Long, String> typeNames = new LinkedHashMap<>();
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT id, name FROM notetypes ORDER BY id")) {
            while (rs.next()) {
                typeNames.put(rs.getLong("id"), rs.getString("name"));
            }
        }

        Map<Long, List<FieldRef>> fieldsByType = new LinkedHashMap<>();
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT ntid, ord, name FROM fields")) {
            while (rs.next()) {
                fieldsByType
                        .computeIfAbsent(rs.getLong("ntid"), k -> new ArrayList<>())
                        .add(new FieldRef(rs.getInt("ord"), rs.getString("name")));
            }
        }

        Map<Long, NoteTypeInfo> result = new LinkedHashMap<>();
        for (Map.Entry<Long, String> e : typeNames.entrySet()) {
            // Cloze flag in the modern schema lives in a protobuf `config` blob we
            // don't decode here; defer cloze detection to a later chunk.
            result.put(e.getKey(), new NoteTypeInfo(e.getKey(), e.getValue(), false,
                    orderedNames(fieldsByType.getOrDefault(e.getKey(), List.of()))));
        }
        return result;
    }

    private static List<String> orderedNames(List<FieldRef> flds) {
        return flds.stream()
                .sorted(Comparator.comparingInt(FieldRef::ord))
                .map(FieldRef::name)
                .toList();
    }

    private static long parseLongOrZero(String s) {
        try {
            return Long.parseLong(s);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    // ── SQLite plumbing ──────────────────────────────────────────────────────

    private static Connection openReadOnly(Path dbFile) throws SQLException {
        SQLiteConfig config = new SQLiteConfig();
        config.setReadOnly(true);            // never write to an untrusted db
        config.enableLoadExtension(false);   // no extension loading (also the default)
        return DriverManager.getConnection("jdbc:sqlite:" + dbFile.toAbsolutePath(), config.toProperties());
    }

    private static boolean tableExists(Connection conn, String table) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    // ── Extraction ──────────────────────────────────────────────────────────

    private ExtractedCollection extractCollection(MultipartFile file) {
        requireNonEmpty(file);
        requireApkgFilename(file);

        try (InputStream in = new BufferedInputStream(file.getInputStream());
             ZipInputStream zip = new ZipInputStream(in)) {
            ZipEntry entry;
            int count = 0;
            while ((entry = zip.getNextEntry()) != null) {
                if (++count > MAX_ENTRIES) {
                    throw new ApkgParseException("Archive has too many entries (> " + MAX_ENTRIES + ").");
                }
                if (COLLECTION_NAMES.contains(entry.getName())) {
                    // Early-stop: grab the collection and ignore the rest (media).
                    return extractEntry(zip, entry.getName());
                }
                zip.closeEntry();
            }
        } catch (ZipException e) {
            throw new ApkgParseException("The uploaded file is not a valid .apkg (zip) archive.", e);
        } catch (IOException e) {
            throw new ApkgParseException("Could not read the uploaded file.", e);
        }
        throw new ApkgParseException(
                "No Anki collection (collection.anki2/anki21/anki21b) found — not a valid .apkg deck.");
    }

    /** Copies the current zip entry to a temp file, decompressing zstd if needed. */
    private ExtractedCollection extractEntry(ZipInputStream zip, String name) throws IOException {
        boolean zstd = name.equals(ZSTD_COLLECTION);

        Path raw = Files.createTempFile("ankiquiz-apkg-", ".bin");
        try {
            copyBounded(zip, raw, MAX_COLLECTION_BYTES);
        } catch (RuntimeException | IOException e) {
            deleteQuietly(raw);
            throw e;
        }

        if (!zstd) {
            return new ExtractedCollection(name, raw, false);
        }

        Path db = Files.createTempFile("ankiquiz-apkg-", ".sqlite");
        try {
            zstdDecompress(raw, db);
        } catch (RuntimeException e) {
            deleteQuietly(db);
            throw e;
        } finally {
            deleteQuietly(raw);
        }
        return new ExtractedCollection(name, db, true);
    }

    private static void zstdDecompress(Path src, Path dst) {
        try (InputStream in = new ZstdInputStream(new BufferedInputStream(Files.newInputStream(src)))) {
            copyBounded(in, dst, MAX_COLLECTION_BYTES);
        } catch (IOException e) {
            throw new ApkgParseException("Failed to decompress the collection (collection.anki21b).", e);
        }
    }

    /** Streams {@code in} to {@code target}, aborting if it exceeds {@code maxBytes}. */
    private static void copyBounded(InputStream in, Path target, long maxBytes) throws IOException {
        byte[] buf = new byte[8192];
        long total = 0;
        try (OutputStream out = new BufferedOutputStream(Files.newOutputStream(target))) {
            int read;
            while ((read = in.read(buf)) != -1) {
                total += read;
                if (total > maxBytes) {
                    throw new ApkgParseException(
                            "Collection database exceeds the size limit (possible zip bomb).");
                }
                out.write(buf, 0, read);
            }
        }
    }

    // ── Validation ──────────────────────────────────────────────────────────

    private static void requireNonEmpty(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApkgParseException("No file uploaded, or the file is empty.");
        }
    }

    private static void requireApkgFilename(MultipartFile file) {
        String name = file.getOriginalFilename();
        if (name == null || !name.toLowerCase(Locale.ROOT).endsWith(".apkg")) {
            throw new ApkgParseException("Only .apkg files are accepted.");
        }
    }

    private static void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // Temp file cleanup is best-effort.
        }
    }
}
