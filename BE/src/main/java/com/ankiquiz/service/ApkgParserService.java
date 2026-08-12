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
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.HashMap;
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
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.function.BiConsumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipException;
import java.util.zip.ZipFile;
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
    /** Captures the media filename inside a {@code [sound:name.mp3]} tag. */
    private static final Pattern SOUND_SRC = Pattern.compile("\\[sound:([^]]+)]");
    // Block / line-break tags become a space so adjacent text isn't mashed together
    // (e.g. "...đóng2." from list items, lines joined by <br>); remaining inline
    // tags are then dropped without inserting a space, so words aren't split.
    private static final Pattern BLOCK_TAG = Pattern.compile(
            "(?i)<\\s*/?\\s*(br|div|p|li|tr|h[1-6]|hr|blockquote)\\b[^>]*>");
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]*>");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    /** A {@code {{...}}} placeholder in an Anki card template (qfmt/afmt). */
    private static final Pattern TEMPLATE_FIELD = Pattern.compile("\\{\\{(.+?)}}");

    /**
     * The Image-Occlusion-Enhanced add-on stores its rectangles inside a cloze
     * marker, e.g. {@code {{c1::image-occlusion:rect:left=.027:top=.0842:...}}}.
     * Such fields have no quizzable text — only mask coordinates — so the note is
     * excluded. Matches the opening of the cloze + IO keyword (case-insensitive);
     * intentionally narrower than just "image-occlusion" to avoid false hits on
     * normal text that mentions the term.
     */
    private static final Pattern IMAGE_OCCLUSION_CLOZE = Pattern.compile(
            "\\{\\{c\\d+::[^}]*image-occlusion", Pattern.CASE_INSENSITIVE);

    /** Note-type names that Anki's official IO add-on uses (case-insensitive). */
    private static final String IMAGE_OCCLUSION_TYPE_KEYWORD = "image occlusion";

    /**
     * Coarse guard against pathological archives. Media-heavy decks legitimately
     * have many entries, so this is generous; the real zip-bomb defense is
     * {@link #MAX_COLLECTION_BYTES}, enforced on the bytes we actually read.
     */
    static final int MAX_ENTRIES = 100_000;

    /** Hard cap on the decompressed collection db — aborts zip/zstd bombs. */
    static final long MAX_COLLECTION_BYTES = 200L * 1024 * 1024; // 200 MB

    /**
     * Hard cap on notes returned in a single response. Each parsed note is ~1–3 KB
     * of JSON; 5,000 keeps the response object well within the free-tier JVM heap
     * (~30 MB worst case) and covers the vast majority of real chapter-sized decks.
     * Decks above this need to be split by tag or sub-deck before upload.
     */
    static final int MAX_NOTES = 5_000;

    /**
     * Wall-clock budget for {@link #parseNotes}. Bounds CPU spend on a single
     * untrusted request. Cooperative — checked at the hot loops (note read +
     * extraction) since SQLite JDBC doesn't honour thread interrupts.
     */
    static final long PARSE_TIMEOUT_SECONDS = 20L;

    // ── Media (card image) extraction bounds ─────────────────────────────────
    /** Biggest single media blob we'll pull out of the deck (bigger images are skipped). */
    static final int MAX_IMAGE_BYTES = 1024 * 1024; // 1 MB
    /** Total media we'll buffer in memory per parse — the memory ceiling for extraction. */
    static final long MAX_MEDIA_BUFFER_BYTES = 12L * 1024 * 1024; // 12 MB
    /** The Anki media manifest is small JSON (number → filename); cap it defensively. */
    static final int MAX_MEDIA_MANIFEST_BYTES = 4 * 1024 * 1024; // 4 MB

    // ── Audio import bounds (streamReferencedMedia) ──────────────────────────
    /** Biggest single audio clip we'll pull out of the deck (bigger clips are skipped). */
    static final int MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB
    /** Total audio we'll pull from one deck — a ceiling on a single import's Storage cost. */
    static final long MAX_AUDIO_IMPORT_TOTAL_BYTES = 250L * 1024 * 1024; // 250 MB
    /** Anki's media manifest entry name in the .apkg zip. */
    private static final String MEDIA_MANIFEST = "media";
    /** Media blobs are stored under numeric names ("0", "1", …). */
    private static final Pattern NUMBERED_ENTRY = Pattern.compile("\\d+");
    /** First {@code <img src="…">} in a field value (either quote style). */
    private static final Pattern IMG_SRC =
            Pattern.compile("<img\\b[^>]*?\\bsrc\\s*=\\s*[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);

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

    /**
     * Resolved note type: ordered field names, cloze flag, and the fields the
     * author placed on the card's question ({@code frontFields}) / answer
     * ({@code backFields}) side per the first card template. Front/back are empty
     * when no template is available (modern decks).
     */
    private record NoteTypeInfo(long id, String name, boolean cloze, List<String> fieldNames,
            List<String> frontFields, List<String> backFields) {
    }

    /** Extracts the collection and returns its notes grouped by note type. */
    public ApkgNotesResponse parseNotes(MultipartFile file) {
        long deadlineNanos = System.nanoTime() + TimeUnit.SECONDS.toNanos(PARSE_TIMEOUT_SECONDS);
        ExtractedApkg apkg = extractApkg(file);
        ExtractedCollection col = apkg.collection();
        Map<String, byte[]> media = apkg.mediaByName();
        try (Connection conn = openReadOnly(col.dbFile())) {
            checkDeadline(deadlineNanos);
            boolean modern = tableExists(conn, "notetypes") && tableExists(conn, "fields");
            Map<Long, NoteTypeInfo> types = modern ? readModernNoteTypes(conn) : readLegacyNoteTypes(conn);

            Map<Long, List<ParsedNote>> notesByType = new LinkedHashMap<>();
            int total = 0;
            int skipped = 0;
            int imageOnly = 0;
            int audioNotes = 0;
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT id, mid, tags, flds FROM notes")) {
                while (rs.next()) {
                    // Deadline check every 256 rows — cheap, but enough to bound
                    // a deck with millions of notes that would otherwise just
                    // burn CPU until the request times out at the proxy.
                    if (((total + skipped + imageOnly) & 0xFF) == 0) {
                        checkDeadline(deadlineNanos);
                    }
                    NoteTypeInfo type = types.get(rs.getLong("mid"));
                    if (type == null) {
                        skipped++; // note references a model we couldn't resolve
                        continue;
                    }
                    String flds = rs.getString("flds");
                    Map<String, String> fields = mapFields(type.fieldNames(), flds);
                    // Uncleaned fields, so <img> and [sound:] survive for media extraction
                    // (mapFields strips both for the display text).
                    Map<String, String> raw = rawFields(type.fieldNames(), flds);
                    // Pull a card image out of the deck's media for each face. Front
                    // scans the front fields (all fields when the template gave none,
                    // e.g. modern decks); back scans the back fields.
                    List<String> frontScan = type.frontFields().isEmpty() ? type.fieldNames() : type.frontFields();
                    String frontImage = firstImageDataUrl(frontScan, raw, media);
                    String backImage = firstImageDataUrl(type.backFields(), raw, media);
                    boolean hasImage = frontImage != null || backImage != null;
                    // Record the [sound:] filename per face (a lightweight ref, not the
                    // bytes) — the client re-sends the .apkg after save so the backend
                    // can stream just these clips to storage (see import-audio).
                    String frontAudio = firstSoundRef(frontScan, raw);
                    String backAudio = firstSoundRef(type.backFields(), raw);
                    // Image-occlusion notes can't be quizzed as MCQ, so exclude + count:
                    //   1. Note-type name says "Image Occlusion" (Anki's official IO
                    //      add-on; its text fields are just internal IDs/SVGs)
                    //   2. Any field contains the IO Enhanced cloze marker
                    //      {{c1::image-occlusion:rect:...}}
                    //   3. Every field is empty after cleaning AND there's no extracted
                    //      image (a plain <img>-only card is now kept, with its picture)
                    if (isImageOcclusion(type, fields) || (isAllEmpty(fields) && !hasImage)) {
                        imageOnly++;
                        continue;
                    }
                    ParsedNote note = new ParsedNote(
                            String.valueOf(rs.getLong("id")),
                            fields,
                            parseTags(rs.getString("tags")),
                            frontImage,
                            backImage,
                            frontAudio,
                            backAudio);
                    notesByType.computeIfAbsent(type.id(), k -> new ArrayList<>()).add(note);
                    total++;
                    if (frontAudio != null || backAudio != null) {
                        audioNotes++;
                    }
                    if (total > MAX_NOTES) {
                        throw new ApkgParseException(
                                "This deck is too large (limit: " + MAX_NOTES
                                        + " cards). Try uploading a sub-deck or filtering by tag first.");
                    }
                }
            }

            List<NoteTypeNotes> out = new ArrayList<>();
            for (NoteTypeInfo type : types.values()) {
                List<ParsedNote> notes = notesByType.getOrDefault(type.id(), List.of());
                out.add(new NoteTypeNotes(
                        type.id(), type.name(), type.cloze(), type.fieldNames(),
                        type.frontFields(), type.backFields(),
                        notes.size(), notes));
            }
            return new ApkgNotesResponse(
                    file.getOriginalFilename(), col.name(), modern ? "modern" : "legacy",
                    total, skipped, imageOnly, audioNotes, out);
        } catch (SQLException e) {
            throw new ApkgParseException("Could not read notes from the collection.", e);
        } finally {
            deleteQuietly(col.dbFile());
        }
    }

    /** True when every field value in the map is empty after cleaning. */
    private static boolean isAllEmpty(Map<String, String> fields) {
        for (String v : fields.values()) {
            if (v != null && !v.isEmpty()) {
                return false;
            }
        }
        return true;
    }

    /**
     * True for notes that come from an image-occlusion add-on / note type. Catches
     * both Anki's official IO note type (by name) and IO Enhanced (by the cloze
     * marker its rectangles use). These notes have no quizzable text content
     * even when some text fields are non-empty (e.g. internal IDs, headers).
     */
    private static boolean isImageOcclusion(NoteTypeInfo type, Map<String, String> fields) {
        if (type.name() != null
                && type.name().toLowerCase(Locale.ROOT).contains(IMAGE_OCCLUSION_TYPE_KEYWORD)) {
            return true;
        }
        for (String v : fields.values()) {
            if (v != null && IMAGE_OCCLUSION_CLOZE.matcher(v).find()) {
                return true;
            }
        }
        return false;
    }

    /** Aborts when the wall-clock budget for the request is exhausted. */
    private static void checkDeadline(long deadlineNanos) {
        if (System.nanoTime() > deadlineNanos) {
            throw new ApkgParseException(
                    "Parsing this deck took too long (limit: " + PARSE_TIMEOUT_SECONDS
                            + " s). Try a smaller deck or split it by tag.");
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

    /**
     * Strips media tags + HTML and decodes the common HTML entities. {@code <img>}
     * tags are dropped here (no separate pass) — they match {@link #HTML_TAG} and
     * leave no marker behind, so an image-only field collapses to {@code ""}.
     * The {@link #isAllEmpty(Map)} check downstream then excludes such notes
     * (image-occlusion and other media-only cards) since they have no text to quiz.
     */
    private static String cleanField(String raw) {
        if (raw == null || raw.isEmpty()) {
            return "";
        }
        String s = SOUND_TAG.matcher(raw).replaceAll("");
        s = BLOCK_TAG.matcher(s).replaceAll(" ");   // keep word/line boundaries
        s = HTML_TAG.matcher(s).replaceAll("");     // drops <img>, <b>, ... no marker
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
                List<String> fieldNames = orderedNames(flds);

                // The author's front/back layout comes from the first card template.
                Set<String> valid = Set.copyOf(fieldNames);
                JsonNode firstTmpl = model.path("tmpls").path(0);
                List<String> front = templateFieldRefs(firstTmpl.path("qfmt").asText(""), valid);
                List<String> backAll = templateFieldRefs(firstTmpl.path("afmt").asText(""), valid);
                // The answer side = fields that appear on the back but not already on
                // the front (afmt usually re-renders the front via {{FrontSide}}).
                List<String> back = backAll.stream().filter(f -> !front.contains(f)).toList();

                result.put(id, new NoteTypeInfo(id, name, cloze, fieldNames, front, back));
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
            // Cloze flag and card templates in the modern schema live in protobuf
            // `config` blobs we don't decode here; defer to a later chunk. Front/back
            // are left empty so the client falls back to its detection heuristic.
            result.put(e.getKey(), new NoteTypeInfo(e.getKey(), e.getValue(), false,
                    orderedNames(fieldsByType.getOrDefault(e.getKey(), List.of())),
                    List.of(), List.of()));
        }
        return result;
    }

    /**
     * Extracts the field names referenced by a card template ({@code qfmt}/{@code afmt}),
     * in first-occurrence order, keeping only names that are real fields of the note
     * type. Handles Anki's template syntax: section/conditional markers
     * ({@code {{#Field}}}, {@code {{/Field}}}, {@code {{^Field}}}) and filters
     * ({@code {{type:Field}}}, {@code {{hint:Field}}}, {@code {{cloze:Field}}},
     * {@code {{tts ...:Field}}}) — the field name is whatever follows the last colon.
     * Special tokens like {@code {{FrontSide}}} aren't fields, so they fall out via
     * the {@code validFields} filter.
     */
    private static List<String> templateFieldRefs(String template, Set<String> validFields) {
        if (template == null || template.isEmpty() || validFields.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> refs = new LinkedHashSet<>();
        Matcher m = TEMPLATE_FIELD.matcher(template);
        while (m.find()) {
            String token = m.group(1).trim();
            if (!token.isEmpty() && (token.charAt(0) == '#' || token.charAt(0) == '/'
                    || token.charAt(0) == '^')) {
                token = token.substring(1).trim();
            }
            int lastColon = token.lastIndexOf(':');
            if (lastColon >= 0) {
                token = token.substring(lastColon + 1).trim();
            }
            if (validFields.contains(token)) {
                refs.add(token);
            }
        }
        return List.copyOf(refs);
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

    /** Collection extracted to a temp file, plus card-image media buffered in memory. */
    private record ExtractedApkg(ExtractedCollection collection, Map<String, byte[]> mediaByName) {
    }

    private ExtractedApkg extractApkg(MultipartFile file) {
        requireNonEmpty(file);
        requireApkgFilename(file);

        ExtractedCollection collection = null;
        byte[] manifest = null;
        Map<String, byte[]> numbered = new HashMap<>();
        long buffered = 0;

        try (InputStream in = new BufferedInputStream(file.getInputStream());
             ZipInputStream zip = new ZipInputStream(in)) {
            ZipEntry entry;
            int count = 0;
            while ((entry = zip.getNextEntry()) != null) {
                if (++count > MAX_ENTRIES) {
                    throw new ApkgParseException("Archive has too many entries (> " + MAX_ENTRIES + ").");
                }
                String name = entry.getName();
                if (COLLECTION_NAMES.contains(name)) {
                    collection = extractEntry(zip, name);
                } else if (MEDIA_MANIFEST.equals(name)) {
                    manifest = readEntryBounded(zip, MAX_MEDIA_MANIFEST_BYTES);
                } else if (NUMBERED_ENTRY.matcher(name).matches() && buffered < MAX_MEDIA_BUFFER_BYTES) {
                    // Buffer media blobs (bounded) so we can pull out card images
                    // after parsing the collection. Bigger-than-cap blobs are skipped.
                    byte[] bytes = readEntryBounded(zip, MAX_IMAGE_BYTES);
                    if (bytes != null) {
                        numbered.put(name, bytes);
                        buffered += bytes.length;
                    }
                }
                // Any other entry (or an over-cap blob) is ignored; getNextEntry advances past it.
            }
        } catch (ZipException e) {
            throw new ApkgParseException("The uploaded file is not a valid .apkg (zip) archive.", e);
        } catch (IOException e) {
            throw new ApkgParseException("Could not read the uploaded file.", e);
        }
        if (collection == null) {
            throw new ApkgParseException(
                    "No Anki collection (collection.anki2/anki21/anki21b) found — not a valid .apkg deck.");
        }
        return new ExtractedApkg(collection, buildMediaMap(manifest, numbered));
    }

    // Reads the current zip entry into memory up to maxBytes; null if it exceeds
    // (skip — we won't hold a single huge blob) or the entry runs long.
    private static byte[] readEntryBounded(ZipInputStream zip, int maxBytes) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int read;
        while ((read = zip.read(buf)) != -1) {
            if (out.size() + read > maxBytes) {
                return null;
            }
            out.write(buf, 0, read);
        }
        return out.toByteArray();
    }

    // Anki's media manifest is JSON mapping a numeric key to the real filename
    // ({@code {"0":"cat.jpg", ...}}). Combined with the numbered blobs we buffered,
    // this yields filename -> bytes. A missing / non-JSON manifest (e.g. the newest
    // protobuf format) yields no media — images just aren't extracted, cards keep
    // their text.
    private Map<String, byte[]> buildMediaMap(byte[] manifest, Map<String, byte[]> numbered) {
        if (manifest == null || numbered.isEmpty()) {
            return Map.of();
        }
        try {
            JsonNode root = objectMapper.readTree(manifest);
            Map<String, byte[]> byName = new HashMap<>();
            Iterator<Map.Entry<String, JsonNode>> it = root.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> e = it.next();
                byte[] bytes = numbered.get(e.getKey());
                if (bytes != null) {
                    byName.put(e.getValue().asText(), bytes);
                }
            }
            return byName;
        } catch (IOException e) {
            return Map.of();
        }
    }

    // The first <img>'s image, as a data URL, found across the given face's fields —
    // or null if none resolves to a known, supported image blob.
    private static String firstImageDataUrl(List<String> faceFields, Map<String, String> rawFields,
                                            Map<String, byte[]> media) {
        if (media.isEmpty()) {
            return null;
        }
        for (String fieldName : faceFields) {
            String raw = rawFields.get(fieldName);
            if (raw == null || raw.isEmpty()) {
                continue;
            }
            Matcher m = IMG_SRC.matcher(raw);
            while (m.find()) {
                String src = m.group(1);
                byte[] bytes = media.get(src);
                if (bytes == null) {
                    bytes = media.get(urlDecode(src)); // filenames may be %20-encoded
                }
                if (bytes != null) {
                    String mime = AvatarService.sniffImageType(bytes);
                    if (mime != null) {
                        return "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(bytes);
                    }
                }
            }
        }
        return null;
    }

    private static String urlDecode(String s) {
        try {
            return URLDecoder.decode(s, StandardCharsets.UTF_8);
        } catch (RuntimeException e) {
            return s;
        }
    }

    // The first [sound:name] media filename found across the given face's fields, or
    // null if the face has no sound tag. Only the filename is returned — the bytes are
    // pulled later (streamReferencedMedia) so a parse never buffers a deck of audio.
    private static String firstSoundRef(List<String> faceFields, Map<String, String> rawFields) {
        for (String fieldName : faceFields) {
            String raw = rawFields.get(fieldName);
            if (raw == null || raw.isEmpty()) {
                continue;
            }
            Matcher m = SOUND_SRC.matcher(raw);
            if (m.find()) {
                String name = m.group(1).trim();
                if (!name.isEmpty()) {
                    return name;
                }
            }
        }
        return null;
    }

    // ── Audio media streaming (import-audio) ─────────────────────────────────

    /** Receives one extracted audio clip: the filename it was referenced by and its bytes. */
    @FunctionalInterface
    public interface MediaSink {
        void accept(String filename, byte[] bytes);
    }

    /**
     * Streams the audio clips named in {@code wanted} out of the .apkg and hands each to
     * {@code sink}, one at a time — so a whole deck's audio is never held in memory. Opens
     * the archive with random access ({@link ZipFile}): reads the small {@code media}
     * manifest (number → filename), then pulls only the referenced numbered blobs, capping
     * each clip ({@link #MAX_AUDIO_BYTES}) and the total ({@link #MAX_AUDIO_IMPORT_TOTAL_BYTES}).
     * The sink is keyed by the {@code wanted} filename that matched (so callers can map it
     * back to the note that referenced it). A missing / non-JSON manifest yields nothing.
     */
    public void streamReferencedMedia(MultipartFile file, Set<String> wanted, MediaSink sink) {
        if (wanted.isEmpty()) {
            return;
        }
        Path temp = copyToTemp(file);
        long total = 0;
        try (ZipFile zip = new ZipFile(temp.toFile())) {
            ZipEntry manifestEntry = zip.getEntry(MEDIA_MANIFEST);
            if (manifestEntry == null) {
                return;
            }
            byte[] manifestBytes = readEntryBounded(zip, manifestEntry, MAX_MEDIA_MANIFEST_BYTES);
            if (manifestBytes == null) {
                return;
            }
            JsonNode root = objectMapper.readTree(manifestBytes);
            Iterator<Map.Entry<String, JsonNode>> it = root.fields();
            while (it.hasNext()) {
                if (total >= MAX_AUDIO_IMPORT_TOTAL_BYTES) {
                    break;
                }
                Map.Entry<String, JsonNode> e = it.next();
                String number = e.getKey();
                String filename = e.getValue().asText();
                // The [sound:] ref may be %-encoded relative to the manifest filename.
                String matched = wanted.contains(filename) ? filename
                        : wanted.contains(urlDecode(filename)) ? urlDecode(filename)
                        : null;
                if (matched == null) {
                    continue;
                }
                ZipEntry blob = zip.getEntry(number);
                if (blob == null) {
                    continue;
                }
                byte[] bytes = readEntryBounded(zip, blob, MAX_AUDIO_BYTES);
                if (bytes != null) {
                    sink.accept(matched, bytes);
                    total += bytes.length;
                }
            }
        } catch (IOException e) {
            throw new ApkgParseException("Could not read audio from the uploaded .apkg.", e);
        } finally {
            deleteQuietly(temp);
        }
    }

    // Reads one ZipFile entry into memory up to maxBytes; null if it exceeds the cap.
    private static byte[] readEntryBounded(ZipFile zip, ZipEntry entry, int maxBytes) throws IOException {
        try (InputStream in = zip.getInputStream(entry)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int read;
            while ((read = in.read(buf)) != -1) {
                if (out.size() + read > maxBytes) {
                    return null;
                }
                out.write(buf, 0, read);
            }
            return out.toByteArray();
        }
    }

    private Path copyToTemp(MultipartFile file) {
        requireNonEmpty(file);
        requireApkgFilename(file);
        try {
            Path temp = Files.createTempFile("ankiquiz-apkg-audio-", ".apkg");
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, temp, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException e) {
                deleteQuietly(temp);
                throw e;
            }
            return temp;
        } catch (IOException e) {
            throw new ApkgParseException("Could not read the uploaded file.", e);
        }
    }

    // Split a note's flds blob onto its field names WITHOUT cleaning — so <img> tags
    // survive for image extraction (mapFields strips them for the display text).
    private static Map<String, String> rawFields(List<String> fieldNames, String flds) {
        String[] values = (flds == null ? "" : flds).split(FIELD_SEPARATOR, -1);
        Map<String, String> raw = new LinkedHashMap<>();
        for (int i = 0; i < fieldNames.size(); i++) {
            raw.put(fieldNames.get(i), i < values.length ? values[i] : "");
        }
        return raw;
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
