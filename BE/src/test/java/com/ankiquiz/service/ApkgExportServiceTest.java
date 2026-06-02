package com.ankiquiz.service;

import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Note;
import com.ankiquiz.entity.NoteType;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import com.ankiquiz.repository.NoteTypeRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApkgExportServiceTest {

    private static final String USER = "user-1";

    @Mock private DeckRepository deckRepository;
    @Mock private NoteTypeRepository noteTypeRepository;
    @Mock private NoteRepository noteRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private ApkgExportService service() {
        return new ApkgExportService(deckRepository, noteTypeRepository, noteRepository, objectMapper);
    }

    private NoteType type(UUID id, UUID deckId, String name, boolean cloze, String... fieldNames) {
        NoteType t = new NoteType();
        t.setId(id);
        t.setDeckId(deckId);
        t.setName(name);
        t.setCloze(cloze);
        t.setFieldNames(fieldNames);
        t.setFrontFields(new String[0]);
        t.setBackFields(new String[0]);
        return t;
    }

    private Note note(UUID deckId, UUID typeId, Map<String, String> fields, String... tags) {
        Note n = new Note();
        n.setId(UUID.randomUUID());
        n.setDeckId(deckId);
        n.setNoteTypeId(typeId);
        n.setFields(fields);
        n.setTags(tags);
        return n;
    }

    // Unzips the .apkg, writes collection.anki2 to a temp file, and opens it. The
    // consumer runs assertions against the live SQLite connection.
    private interface DbCheck {
        void check(Connection conn) throws Exception;
    }

    private void withCollection(byte[] apkg, java.util.Set<String> expectedEntries, DbCheck check) throws Exception {
        byte[] collection = null;
        java.util.Set<String> entries = new java.util.HashSet<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(apkg))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                entries.add(entry.getName());
                if (entry.getName().equals("collection.anki2")) {
                    collection = zis.readAllBytes();
                }
            }
        }
        assertThat(entries).containsAll(expectedEntries);
        assertThat(collection).isNotNull();

        Path tmp = Files.createTempFile("test-export-", ".anki2");
        try {
            Files.write(tmp, collection);
            try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + tmp.toAbsolutePath())) {
                check.check(conn);
            }
        } finally {
            Files.deleteIfExists(tmp);
        }
    }

    private long count(Connection conn, String table) throws Exception {
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM " + table)) {
            rs.next();
            return rs.getLong(1);
        }
    }

    @Test
    void export_basicDeck_buildsNotesAndOneCardEach() throws Exception {
        UUID deckId = UUID.randomUUID();
        UUID typeId = UUID.randomUUID();
        Deck deck = new Deck();
        deck.setId(deckId);
        deck.setUserId(USER);
        deck.setName("JLPT N4");

        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.of(deck));
        when(noteTypeRepository.findAllByDeckId(deckId))
                .thenReturn(List.of(type(typeId, deckId, "Basic", false, "Front", "Back")));
        Map<String, String> f1 = new HashMap<>(Map.of("Front", "食べる", "Back", "to eat"));
        Map<String, String> f2 = new HashMap<>(Map.of("Front", "飲む", "Back", "to drink"));
        when(noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId))
                .thenReturn(List.of(note(deckId, typeId, f1, "N4", "verb"), note(deckId, typeId, f2)));

        byte[] apkg = service().export(USER, deckId);

        withCollection(apkg, java.util.Set.of("collection.anki2", "media"), conn -> {
            assertThat(count(conn, "notes")).isEqualTo(2);
            assertThat(count(conn, "cards")).isEqualTo(2);

            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT ver, models FROM col WHERE id=1")) {
                rs.next();
                assertThat(rs.getInt("ver")).isEqualTo(11);
                JsonNode models = objectMapper.readTree(rs.getString("models"));
                // Exactly one model, named "Basic", standard type (0), two fields.
                assertThat(models.size()).isEqualTo(1);
                JsonNode model = models.elements().next();
                assertThat(model.get("name").asText()).isEqualTo("Basic");
                assertThat(model.get("type").asInt()).isEqualTo(0);
                assertThat(model.get("flds").size()).isEqualTo(2);
            }

            // Fields are stored joined by the unit separator (0x1f).
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT flds, tags FROM notes ORDER BY id LIMIT 1")) {
                rs.next();
                assertThat(rs.getString("flds")).isEqualTo("食べるto eat");
                assertThat(rs.getString("tags")).isEqualTo(" N4 verb ");
            }
        });
    }

    @Test
    void export_clozeNote_generatesOneCardPerIndex() throws Exception {
        UUID deckId = UUID.randomUUID();
        UUID typeId = UUID.randomUUID();
        Deck deck = new Deck();
        deck.setId(deckId);
        deck.setUserId(USER);
        deck.setName("Geo");

        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.of(deck));
        when(noteTypeRepository.findAllByDeckId(deckId))
                .thenReturn(List.of(type(typeId, deckId, "Cloze", true, "Text", "Extra")));
        Map<String, String> fields = new HashMap<>(
                Map.of("Text", "{{c1::Paris}} is the capital of {{c2::France}}.", "Extra", ""));
        when(noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId))
                .thenReturn(List.of(note(deckId, typeId, fields)));

        byte[] apkg = service().export(USER, deckId);

        withCollection(apkg, java.util.Set.of("collection.anki2", "media"), conn -> {
            assertThat(count(conn, "notes")).isEqualTo(1);
            assertThat(count(conn, "cards")).isEqualTo(2); // c1 + c2

            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT ord FROM cards ORDER BY ord")) {
                rs.next();
                assertThat(rs.getInt("ord")).isEqualTo(0); // c1 -> ord 0
                rs.next();
                assertThat(rs.getInt("ord")).isEqualTo(1); // c2 -> ord 1
            }

            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT models FROM col WHERE id=1")) {
                rs.next();
                JsonNode model = objectMapper.readTree(rs.getString("models")).elements().next();
                assertThat(model.get("type").asInt()).isEqualTo(1); // cloze model
            }
        });
    }

    @Test
    void export_throwsNotFound_whenDeckMissing() {
        UUID deckId = UUID.randomUUID();
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().export(USER, deckId))
                .isInstanceOf(NotFoundException.class);
    }
}
