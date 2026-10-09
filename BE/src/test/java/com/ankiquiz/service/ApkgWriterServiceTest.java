package com.ankiquiz.service;

import com.ankiquiz.dto.response.ApkgNotesResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * W1 of the Anki export: the package format itself.
 *
 * <p>The centrepiece is {@link #aWrittenPackageCanBeReadBackByOurOwnParser()}. We own a reader, so
 * writer → reader is a complete integration test of the format with no Anki involved and nothing
 * mocked — by far the most valuable check available here. Real Anki still has to be driven by hand
 * (no test can boot it), but anything this round trip catches is something we never have to discover
 * by importing a broken file.
 */
class ApkgWriterServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ApkgWriterService writer = new ApkgWriterService(objectMapper);
    private final ApkgParserService parser = new ApkgParserService(new ObjectMapper());

    private static final char SEP = 0x1F;

    private ApkgWriterService.DeckSpec deck(String name, String... frontBackPairs) {
        List<ApkgWriterService.Note> notes = new ArrayList<>();
        for (int i = 0; i < frontBackPairs.length; i += 2) {
            notes.add(new ApkgWriterService.Note(
                    ApkgWriterService.stableGuid("deck-1", "note-" + i),
                    List.of(frontBackPairs[i], frontBackPairs[i + 1]),
                    List.of()));
        }
        return new ApkgWriterService.DeckSpec(name, ApkgWriterService.NoteType.basic("Quizanki Basic"), notes);
    }

    private Path write(ApkgWriterService.DeckSpec spec, Path dir) throws Exception {
        Path out = dir.resolve("deck.apkg");
        writer.write(spec, out);
        return out;
    }

    // ── The round trip ───────────────────────────────────────────────────────

    @Test
    void aWrittenPackageCanBeReadBackByOurOwnParser(@TempDir Path dir) throws Exception {
        Path apkg = write(deck("JLPT N5 verbs",
                "たべる", "to eat",
                "のむ", "to drink",
                "いく", "to go"), dir);

        ApkgNotesResponse parsed = parser.parseNotes(
                new MockMultipartFile("file", "deck.apkg", "application/octet-stream",
                        Files.readAllBytes(apkg)));

        assertThat(parsed.schema()).isEqualTo("legacy");
        assertThat(parsed.totalNotes()).isEqualTo(3);
        assertThat(parsed.skippedNotes()).isZero();
        assertThat(parsed.noteTypes()).hasSize(1);

        ApkgNotesResponse.NoteTypeNotes type = parsed.noteTypes().get(0);
        assertThat(type.name()).isEqualTo("Quizanki Basic");
        assertThat(type.cloze()).isFalse();
        assertThat(type.fieldNames()).containsExactly("Front", "Back");
        // The parser derives these from the templates we wrote, so this proves the templates parse.
        assertThat(type.frontFields()).containsExactly("Front");
        assertThat(type.backFields()).containsExactly("Back");
        assertThat(type.noteCount()).isEqualTo(3);
    }

    @Test
    void theRoundTripPreservesEveryFieldValueInOrder(@TempDir Path dir) throws Exception {
        Path apkg = write(deck("Vocab", "term one", "definition one", "term two", "definition two"), dir);

        ApkgNotesResponse parsed = parser.parseNotes(
                new MockMultipartFile("file", "d.apkg", "application/octet-stream",
                        Files.readAllBytes(apkg)));

        List<String> fronts = parsed.noteTypes().get(0).notes().stream()
                .map(n -> n.fields().get("Front")).toList();
        List<String> backs = parsed.noteTypes().get(0).notes().stream()
                .map(n -> n.fields().get("Back")).toList();

        assertThat(fronts).containsExactly("term one", "term two");
        assertThat(backs).containsExactly("definition one", "definition two");
    }

    @Test
    void unicodeAndHtmlSurviveTheRoundTrip(@TempDir Path dir) throws Exception {
        // Japanese, an emoji, and markup a definition might legitimately carry.
        Path apkg = write(deck("Mixed", "漢字 📚", "<b>bold</b> and <i>italic</i>"), dir);

        ApkgNotesResponse parsed = parser.parseNotes(
                new MockMultipartFile("file", "d.apkg", "application/octet-stream",
                        Files.readAllBytes(apkg)));

        var note = parsed.noteTypes().get(0).notes().get(0);
        assertThat(note.fields().get("Front")).isEqualTo("漢字 📚");
        // The parser cleans markup for display; the point here is that it did not mangle the text.
        assertThat(note.fields().get("Back")).contains("bold").contains("italic");
    }

    // ── The zip ──────────────────────────────────────────────────────────────

    @Test
    void thePackageContainsExactlyTheLegacy1Entries(@TempDir Path dir) throws Exception {
        Path apkg = write(deck("Deck", "a", "b"), dir);

        Set<String> entries = new HashSet<>();
        try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(apkg))) {
            for (ZipEntry e = zip.getNextEntry(); e != null; e = zip.getNextEntry()) {
                entries.add(e.getName());
            }
        }
        // Legacy 1: the collection plus the media map. No `meta`, no dummy — those are Legacy 2.
        assertThat(entries).containsExactlyInAnyOrder("collection.anki2", "media");
    }

    @Test
    void theMediaMapIsPresentAndEmptyRatherThanMissing(@TempDir Path dir) throws Exception {
        // Anki reads `media` unconditionally; omitting it is not the same as it being empty.
        Path apkg = write(deck("Deck", "a", "b"), dir);

        assertThat(entryText(apkg, "media")).isEqualTo("{}");
    }

    // ── The collection itself ────────────────────────────────────────────────

    @Test
    void theCollectionDeclaresSchema11AndADayAlignedCreationTime(@TempDir Path dir) throws Exception {
        Path apkg = write(deck("Deck", "a", "b"), dir);

        try (Connection db = openCollection(apkg, dir)) {
            try (Statement st = db.createStatement();
                 ResultSet rs = st.executeQuery("select ver, crt, scm, mod from col")) {
                assertThat(rs.next()).isTrue();
                assertThat(rs.getInt("ver")).isEqualTo(11);
                // The scheduler counts days from `crt`, so it must sit on a day boundary.
                assertThat(rs.getLong("crt") % 86_400L).isZero();
                assertThat(rs.getLong("mod")).isPositive();
                assertThat(rs.getLong("scm")).isPositive();
            }
        }
    }

    @Test
    void everyCardIsWrittenAsNewWithNoInventedReviewHistory(@TempDir Path dir) throws Exception {
        Path apkg = write(deck("Deck", "a", "b", "c", "d"), dir);

        try (Connection db = openCollection(apkg, dir)) {
            try (Statement st = db.createStatement();
                 ResultSet rs = st.executeQuery(
                         "select type, queue, ivl, factor, reps, lapses, due from cards order by due")) {
                int seen = 0;
                while (rs.next()) {
                    assertThat(rs.getInt("type")).isZero();
                    assertThat(rs.getInt("queue")).isZero();
                    assertThat(rs.getInt("ivl")).isZero();
                    assertThat(rs.getInt("factor")).isZero();
                    assertThat(rs.getInt("reps")).isZero();
                    assertThat(rs.getInt("lapses")).isZero();
                    // `due` on a new card is its queue position, so they must be 0,1,2…
                    assertThat(rs.getInt("due")).isEqualTo(seen);
                    seen++;
                }
                assertThat(seen).isEqualTo(2);
            }
            // Sending review history would be inventing study the user never did.
            try (Statement st = db.createStatement();
                 ResultSet rs = st.executeQuery("select count(*) from revlog")) {
                rs.next();
                assertThat(rs.getInt(1)).isZero();
            }
        }
    }

    @Test
    void fieldsAreJoinedWithTheUnitSeparatorNotSomethingATermCouldContain(@TempDir Path dir) throws Exception {
        // A definition containing a comma or a tab is completely ordinary; either as a separator
        // would split the note silently.
        Path apkg = write(deck("Deck", "a, with comma", "b\twith tab"), dir);

        try (Connection db = openCollection(apkg, dir)) {
            try (Statement st = db.createStatement();
                 ResultSet rs = st.executeQuery("select flds, sfld from notes")) {
                rs.next();
                assertThat(rs.getString("flds"))
                        .isEqualTo("a, with comma" + SEP + "b\twith tab");
                assertThat(rs.getString("sfld")).isEqualTo("a, with comma");
            }
        }
    }

    @Test
    void theDefaultDeckSurvivesAlongsideOurs(@TempDir Path dir) throws Exception {
        // Importing must not disturb decks the user already has, and Anki expects deck 1 to exist.
        Path apkg = write(deck("JLPT N5", "a", "b"), dir);

        JsonNode decks = objectMapper.readTree(colColumn(apkg, dir, "decks"));
        assertThat(decks.has("1")).isTrue();
        assertThat(decks.get("1").get("name").asText()).isEqualTo("Default");
        List<String> names = new ArrayList<>();
        decks.fields().forEachRemaining(e -> names.add(e.getValue().get("name").asText()));
        assertThat(names).contains("JLPT N5");
    }

    @Test
    void theNoteTypeIsWrittenAsSchema11Json(@TempDir Path dir) throws Exception {
        Path apkg = write(deck("Deck", "a", "b"), dir);

        JsonNode models = objectMapper.readTree(colColumn(apkg, dir, "models"));
        JsonNode model = models.fields().next().getValue();
        assertThat(model.get("name").asText()).isEqualTo("Quizanki Basic");
        assertThat(model.get("type").asInt()).isZero();
        assertThat(model.get("sortf").asInt()).isZero();
        assertThat(model.get("flds")).hasSize(2);
        assertThat(model.get("tmpls")).hasSize(1);
        // `req` is what stops Anki generating a blank card from an empty question.
        assertThat(model.get("req")).hasSize(1);
    }

    // ── guid stability: the one that would hurt users most ───────────────────

    @Test
    void theSameCardGetsTheSameGuidEveryTime() {
        // Re-exporting a deck must UPDATE the user's cards. A guid that moves between runs makes
        // Anki add duplicates instead — silently, and for the whole deck.
        assertThat(ApkgWriterService.stableGuid("deck-1", "note-1"))
                .isEqualTo(ApkgWriterService.stableGuid("deck-1", "note-1"));
    }

    @Test
    void differentCardsGetDifferentGuids() {
        assertThat(ApkgWriterService.stableGuid("deck-1", "note-1"))
                .isNotEqualTo(ApkgWriterService.stableGuid("deck-1", "note-2"));
        // Same note id in a different deck is a different card.
        assertThat(ApkgWriterService.stableGuid("deck-1", "note-1"))
                .isNotEqualTo(ApkgWriterService.stableGuid("deck-2", "note-1"));
    }

    @Test
    void twoExportsOfTheSameDeckCarryIdenticalGuids(@TempDir Path dir) throws Exception {
        List<String> first = guidsOf(write(deck("Deck", "a", "b", "c", "d"), dir), dir);
        Path second = dir.resolve("again.apkg");
        writer.write(deck("Deck", "a", "b", "c", "d"), second);

        assertThat(guidsOf(second, dir)).isEqualTo(first);
    }

    // ── checksum ─────────────────────────────────────────────────────────────

    @Test
    void theChecksumIgnoresMarkupAndMediaLikeAnkiDoes() {
        // Anki strips HTML and [sound:] before hashing, which is how it spots that a plain and a
        // formatted copy of the same term are duplicates.
        assertThat(ApkgWriterService.fieldChecksum("<b>cat</b>"))
                .isEqualTo(ApkgWriterService.fieldChecksum("cat"));
        assertThat(ApkgWriterService.fieldChecksum("cat[sound:cat.mp3]"))
                .isEqualTo(ApkgWriterService.fieldChecksum("cat"));
        assertThat(ApkgWriterService.fieldChecksum("cat")).isNotEqualTo(ApkgWriterService.fieldChecksum("dog"));
    }

    @Test
    void theChecksumFitsTheFirstEightHexDigitsOfASha1() {
        // sha1("cat") = 9d989e8d27dc9e0ec3389fc855f142c3d40f0c50 → 0x9d989e8d
        assertThat(ApkgWriterService.fieldChecksum("cat")).isEqualTo(0x9d989e8dL);
    }

    // ── deck names ───────────────────────────────────────────────────────────

    @Test
    void aDeckNameCannotSmuggleInASubdeck() {
        // `::` nests decks in Anki, so a deck literally called "A::B" would silently become two.
        assertThat(ApkgWriterService.sanitiseDeckName("Biology::Cells")).isEqualTo("Biology-Cells");
        assertThat(ApkgWriterService.sanitiseDeckName("has \"quotes\"")).isEqualTo("has  quotes");
        assertThat(ApkgWriterService.sanitiseDeckName("   ")).isEqualTo("Quizanki deck");
    }

    // ── input guards ─────────────────────────────────────────────────────────

    @Test
    void aNoteTypeMustHaveFieldsAndASortFieldThatExists() {
        assertThatThrownBy(() -> new ApkgWriterService.NoteType("T", List.of(), "{{Front}}", "", "", 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ApkgWriterService.NoteType("T", List.of("Front"), "{{Front}}", "", "", 5))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aNoteMustCarryAGuid() {
        assertThatThrownBy(() -> new ApkgWriterService.Note("  ", List.of("a"), List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void anEmptyDeckStillProducesAValidPackage(@TempDir Path dir) throws Exception {
        // Nothing to export is not an error; it just makes an empty deck.
        Path apkg = write(deck("Empty"), dir);

        try (Connection db = openCollection(apkg, dir)) {
            try (Statement st = db.createStatement();
                 ResultSet rs = st.executeQuery("select count(*) from notes")) {
                rs.next();
                assertThat(rs.getInt(1)).isZero();
            }
        }
    }

    @Test
    void shortNoteValuesArePaddedToTheNoteTypesFieldCount(@TempDir Path dir) throws Exception {
        // One value for a two-field type: the second must exist as empty, or later fields read
        // as missing once Anki splits on the separator.
        ApkgWriterService.DeckSpec spec = new ApkgWriterService.DeckSpec("Deck",
                ApkgWriterService.NoteType.basic("Basic"),
                List.of(new ApkgWriterService.Note("guid000000a", List.of("only front"), List.of())));
        Path out = dir.resolve("short.apkg");
        writer.write(spec, out);

        try (Connection db = openCollection(out, dir)) {
            try (Statement st = db.createStatement();
                 ResultSet rs = st.executeQuery("select flds from notes")) {
                rs.next();
                assertThat(rs.getString("flds")).isEqualTo("only front" + SEP);
            }
        }
    }

    @Test
    void tagsAreSpacePaddedTheWayAnkiStoresThem(@TempDir Path dir) throws Exception {
        // Anki pads so a search for " jlpt " matches the whole tag, not a prefix of another.
        ApkgWriterService.DeckSpec spec = new ApkgWriterService.DeckSpec("Deck",
                ApkgWriterService.NoteType.basic("Basic"),
                List.of(new ApkgWriterService.Note("guid000000b", List.of("a", "b"),
                        List.of("jlpt", "n5"))));
        Path out = dir.resolve("tagged.apkg");
        writer.write(spec, out);

        try (Connection db = openCollection(out, dir)) {
            try (Statement st = db.createStatement();
                 ResultSet rs = st.executeQuery("select tags from notes")) {
                rs.next();
                assertThat(rs.getString("tags")).isEqualTo(" jlpt n5 ");
            }
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private List<String> guidsOf(Path apkg, Path dir) throws Exception {
        List<String> guids = new ArrayList<>();
        try (Connection db = openCollection(apkg, dir)) {
            try (Statement st = db.createStatement();
                 ResultSet rs = st.executeQuery("select guid from notes order by id")) {
                while (rs.next()) {
                    guids.add(rs.getString(1));
                }
            }
        }
        return guids;
    }

    private String colColumn(Path apkg, Path dir, String column) throws Exception {
        try (Connection db = openCollection(apkg, dir)) {
            try (Statement st = db.createStatement();
                 ResultSet rs = st.executeQuery("select " + column + " from col")) {
                rs.next();
                return rs.getString(1);
            }
        }
    }

    /** Extracts {@code collection.anki2} and opens it, so assertions can read the real tables. */
    private Connection openCollection(Path apkg, Path dir) throws Exception {
        Path db = Files.createTempFile(dir, "collection-", ".anki2");
        Files.write(db, entryBytes(apkg, "collection.anki2"));
        return DriverManager.getConnection("jdbc:sqlite:" + db.toAbsolutePath());
    }

    private static String entryText(Path apkg, String name) throws Exception {
        return new String(entryBytes(apkg, name), StandardCharsets.UTF_8);
    }

    private static byte[] entryBytes(Path apkg, String name) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(apkg))) {
            for (ZipEntry e = zip.getNextEntry(); e != null; e = zip.getNextEntry()) {
                if (e.getName().equals(name)) {
                    return readAll(zip);
                }
            }
        }
        throw new IllegalStateException("No entry " + name + " in the package");
    }

    private static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        for (int read = in.read(buf); read > 0; read = in.read(buf)) {
            out.write(buf, 0, read);
        }
        return out.toByteArray();
    }

    // ── W2: the multiple-choice note type ────────────────────────────────────

    private ApkgWriterService.DeckSpec mcqDeck() {
        return new ApkgWriterService.DeckSpec("Biology MCQ",
                ApkgWriterService.NoteType.mcq("Quizanki MCQ"),
                List.of(new ApkgWriterService.Note("mcqguid001a",
                        List.of("Mitochondria",
                                // Correct first, then distractors — the template's contract.
                                String.join("\n", List.of(
                                        "The organelle that performs aerobic respiration",
                                        "The process converting CO2 and water into glucose",
                                        "A reactant in photosynthesis",
                                        "Site where gases are exchanged",
                                        "The pigment that absorbs light")),
                                "The organelle that performs aerobic respiration",
                                "Also called the powerhouse of the cell.",
                                "From \"Cell Biology\" on Quizanki"),
                        List.of("quizanki", "biology"))));
    }

    @Test
    void theMcqNoteTypeDeclaresTheFiveFieldsInOrder() {
        ApkgWriterService.NoteType type = ApkgWriterService.NoteType.mcq("Quizanki MCQ");

        assertThat(type.fieldNames())
                .containsExactly("Question", "Choices", "Answer", "Extra", "Source");
        assertThat(type.sortField()).isZero();
    }

    @Test
    void anMcqCardNeedsBothAQuestionAndChoices() {
        // "all" of [Question, Choices]: a prompt with nothing to pick from is not a card, and Anki
        // would otherwise happily generate one.
        ApkgWriterService.NoteType type = ApkgWriterService.NoteType.mcq("Quizanki MCQ");

        assertThat(type.requiredFields()).containsExactly(0, 1);
    }

    @Test
    void theReqBlobSaysAllNotAny(@TempDir Path dir) throws Exception {
        Path apkg = dir.resolve("mcq.apkg");
        writer.write(mcqDeck(), apkg);

        JsonNode models = objectMapper.readTree(colColumn(apkg, dir, "models"));
        JsonNode req = models.fields().next().getValue().get("req").get(0);
        assertThat(req.get(0).asInt()).isZero();
        assertThat(req.get(1).asText()).isEqualTo("all");
        assertThat(req.get(2).toString()).isEqualTo("[0,1]");
    }

    /**
     * The regression this guards is subtle and would be easy to "fix" back in: starting the answer
     * template with {{FrontSide}} re-runs the question's script, which reshuffles the options — so the
     * back would show a different order than the learner just answered on.
     */
    @Test
    void theAnswerSideDoesNotReRunTheQuestionScript() {
        ApkgWriterService.NoteType type = ApkgWriterService.NoteType.mcq("Quizanki MCQ");

        assertThat(type.afmt()).doesNotContain("FrontSide");
        assertThat(type.afmt()).doesNotContain("<script");
        // It renders the stored answer, not "the first line of Choices".
        assertThat(type.afmt()).contains("{{Answer}}");
    }

    @Test
    void theQuestionSideShufflesInTheBrowserAndNeverAutoFlips() {
        String qfmt = ApkgWriterService.NoteType.mcq("Quizanki MCQ").qfmt();

        assertThat(qfmt).contains("{{Question}}").contains("{{Choices}}");
        // Auto-flipping needs platform-specific calls, which is what breaks across Anki releases.
        assertThat(qfmt).doesNotContain("pycmd").doesNotContain("showAnswer");
        // ES5 only. Not required by Anki Desktop (QtWebEngine is modern Chromium) — kept as cheap
        // insurance, and asserted so nobody modernises it without deciding to.
        assertThat(qfmt).doesNotContain("=>").doesNotContain("const ").doesNotContain("let ");
    }

    @Test
    void theStylingCoversBothOfAnkisNightModeClassNames() {
        // .nightMode is the one Anki Desktop stamps on the card — missing it means dark text on a
        // dark background. .night_mode is kept beside it only because a duplicate selector is free.
        String css = ApkgWriterService.NoteType.mcq("Quizanki MCQ").css();

        assertThat(css).contains(".nightMode").contains(".night_mode");
    }

    @Test
    void anMcqDeckRoundTripsThroughOurOwnParser(@TempDir Path dir) throws Exception {
        Path apkg = dir.resolve("mcq.apkg");
        writer.write(mcqDeck(), apkg);

        ApkgNotesResponse parsed = parser.parseNotes(
                new MockMultipartFile("file", "mcq.apkg", "application/octet-stream",
                        Files.readAllBytes(apkg)));

        assertThat(parsed.totalNotes()).isEqualTo(1);
        ApkgNotesResponse.NoteTypeNotes type = parsed.noteTypes().get(0);
        assertThat(type.name()).isEqualTo("Quizanki MCQ");
        assertThat(type.fieldNames())
                .containsExactly("Question", "Choices", "Answer", "Extra", "Source");

        var note = type.notes().get(0);
        assertThat(note.fields().get("Question")).isEqualTo("Mitochondria");
        assertThat(note.fields().get("Answer"))
                .isEqualTo("The organelle that performs aerobic respiration");
    }

    @Test
    void theChoicesFieldKeepsItsLineBreaksThroughTheDatabase(@TempDir Path dir) throws Exception {
        // The template splits on line breaks, so if the newlines do not survive the write there is
        // exactly one option and the card is useless.
        Path apkg = dir.resolve("mcq.apkg");
        writer.write(mcqDeck(), apkg);

        try (Connection db = openCollection(apkg, dir)) {
            try (Statement st = db.createStatement();
                 ResultSet rs = st.executeQuery("select flds from notes")) {
                rs.next();
                String choices = rs.getString("flds").split(String.valueOf(SEP), -1)[1];
                assertThat(choices.split("\n")).hasSize(5);
                assertThat(choices.split("\n")[0])
                        .isEqualTo("The organelle that performs aerobic respiration");
            }
        }
    }

    @Test
    void moreChoicesThanSlotsIsAllowedBecauseThatIsThePoint(@TempDir Path dir) throws Exception {
        // Five baked options, four slots: the template shows the correct one plus three of the four
        // distractors, varying per review. The writer must not trim them.
        Path apkg = dir.resolve("mcq.apkg");
        writer.write(mcqDeck(), apkg);

        try (Connection db = openCollection(apkg, dir)) {
            try (Statement st = db.createStatement();
                 ResultSet rs = st.executeQuery("select flds from notes")) {
                rs.next();
                String choices = rs.getString("flds").split(String.valueOf(SEP), -1)[1];
                assertThat(choices.split("\n").length).isGreaterThan(4);
            }
        }
    }

    // ── W4: media ────────────────────────────────────────────────────────────

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 1, 2, 3, 4};
    private static final byte[] MP3 = {'I', 'D', '3', 9, 8, 7};

    private ApkgWriterService.DeckSpec deckWithMedia(List<ApkgWriterService.Media> media) {
        return new ApkgWriterService.DeckSpec("Illustrated",
                ApkgWriterService.NoteType.basic("Basic"),
                List.of(new ApkgWriterService.Note("mediaguid01",
                        List.of("<img src=\"cell.png\">Mitochondria", "Powerhouse[sound:cell.mp3]"),
                        List.of())),
                media);
    }

    @Test
    void mediaIsPackagedUnderNumericNamesWithAMapBackToTheRealFilename(@TempDir Path dir)
            throws Exception {
        // Anki stores media as "0", "1", … and the `media` file is the index. That indirection is
        // what lets one deck hold two files both legitimately called diagram.png.
        Path apkg = dir.resolve("m.apkg");
        var result = writer.write(deckWithMedia(List.of(
                ApkgWriterService.Media.ofBytes("cell.png", PNG),
                ApkgWriterService.Media.ofBytes("cell.mp3", MP3))), apkg);

        assertThat(result.mediaWritten()).isEqualTo(2);
        assertThat(result.mediaSkipped()).isEmpty();

        JsonNode map = objectMapper.readTree(entryText(apkg, "media"));
        assertThat(map.get("0").asText()).isEqualTo("cell.png");
        assertThat(map.get("1").asText()).isEqualTo("cell.mp3");

        // The bytes land under the NUMBER, not the filename.
        assertThat(entryBytes(apkg, "0")).isEqualTo(PNG);
        assertThat(entryBytes(apkg, "1")).isEqualTo(MP3);
    }

    @Test
    void theSameFileReferencedTwiceIsPackagedOnce(@TempDir Path dir) throws Exception {
        // Media is content-addressed, so one picture used on ten cards is the common case. Shipping
        // ten copies would multiply the deck size for nothing.
        Path apkg = dir.resolve("dup.apkg");
        var result = writer.write(deckWithMedia(List.of(
                ApkgWriterService.Media.ofBytes("same.png", PNG),
                ApkgWriterService.Media.ofBytes("same.png", PNG),
                ApkgWriterService.Media.ofBytes("other.png", PNG))), apkg);

        assertThat(result.mediaWritten()).isEqualTo(2);
        JsonNode map = objectMapper.readTree(entryText(apkg, "media"));
        assertThat(map.size()).isEqualTo(2);
    }

    @Test
    void oneUnreadableFileCostsItsPictureNotTheWholeExport(@TempDir Path dir) throws Exception {
        // An object that has gone from storage must not turn a deck export into a failure. The card
        // keeps its text and loses its picture — the trade the extension's picture import makes too.
        Path apkg = dir.resolve("partial.apkg");
        var result = writer.write(deckWithMedia(List.of(
                ApkgWriterService.Media.ofBytes("good.png", PNG),
                new ApkgWriterService.Media("gone.png", () -> {
                    throw new java.io.FileNotFoundException("404 from storage");
                }),
                ApkgWriterService.Media.ofBytes("alsogood.mp3", MP3))), apkg);

        assertThat(result.mediaWritten()).isEqualTo(2);
        assertThat(result.mediaSkipped()).containsExactly("gone.png");

        // The package is still valid and still readable.
        ApkgNotesResponse parsed = parser.parseNotes(new MockMultipartFile(
                "file", "p.apkg", "application/octet-stream", Files.readAllBytes(apkg)));
        assertThat(parsed.totalNotes()).isEqualTo(1);
    }

    @Test
    void theMapNeverPromisesAFileThatIsNotThere(@TempDir Path dir) throws Exception {
        // Written last on purpose: an index naming a missing entry is worse than a missing picture,
        // because Anki trusts it.
        Path apkg = dir.resolve("promise.apkg");
        writer.write(deckWithMedia(List.of(
                ApkgWriterService.Media.ofBytes("a.png", PNG),
                new ApkgWriterService.Media("b.png", () -> {
                    throw new java.io.IOException("unreadable");
                }),
                ApkgWriterService.Media.ofBytes("c.png", PNG))), apkg);

        JsonNode map = objectMapper.readTree(entryText(apkg, "media"));
        Set<String> entries = new HashSet<>();
        try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(apkg))) {
            for (ZipEntry e = zip.getNextEntry(); e != null; e = zip.getNextEntry()) {
                entries.add(e.getName());
            }
        }
        map.fieldNames().forEachRemaining(number ->
                assertThat(entries).contains(number));
        // Numbering stays dense; the failed file does not leave a hole.
        assertThat(map.get("0").asText()).isEqualTo("a.png");
        assertThat(map.get("1").asText()).isEqualTo("c.png");
    }

    @Test
    void aFileOverTheSizeCapIsSkippedRatherThanStreamedForever(@TempDir Path dir) throws Exception {
        Path apkg = dir.resolve("big.apkg");
        var result = writer.write(deckWithMedia(List.of(
                new ApkgWriterService.Media("huge.bin", () -> new InputStream() {
                    @Override
                    public int read() {
                        return 0; // an endless file
                    }
                }),
                ApkgWriterService.Media.ofBytes("small.png", PNG))), apkg);

        assertThat(result.mediaSkipped()).contains("huge.bin");
        assertThat(result.mediaWritten()).isEqualTo(1);
    }

    @Test
    void aStoredPathCannotBecomeADirectoryOrEscapeTheMediaFolder() {
        // Our own stored paths are <userId>/<uuid>, which would become directories; and a name like
        // ../../evil.png in a package is a path-traversal attempt against whoever imports it.
        assertThat(ApkgWriterService.sanitiseMediaName("abc123/def456/pic.png")).isEqualTo("pic.png");
        assertThat(ApkgWriterService.sanitiseMediaName("../../evil.png")).isEqualTo("evil.png");
        assertThat(ApkgWriterService.sanitiseMediaName("..\\..\\evil.png")).isEqualTo("evil.png");
        assertThat(ApkgWriterService.sanitiseMediaName("ok.png")).isEqualTo("ok.png");
        assertThat(ApkgWriterService.sanitiseMediaName("  ")).isEqualTo("media");
    }

    @Test
    void charactersAFilesystemWouldRejectAreReplaced() {
        // The name ends up on the learner's disk when Anki unpacks the collection.
        assertThat(ApkgWriterService.sanitiseMediaName("a\"b*c?.png")).isEqualTo("a_b_c_.png");
        assertThat(ApkgWriterService.sanitiseMediaName("a<b>c|d.png")).isEqualTo("a_b_c_d.png");
    }

    @Test
    void aDeckWithNoMediaStillShipsAnEmptyMap(@TempDir Path dir) throws Exception {
        // Unchanged from W1: Anki reads `media` unconditionally.
        Path apkg = write(deck("Plain", "a", "b"), dir);

        assertThat(entryText(apkg, "media")).isEqualTo("{}");
    }

    @Test
    void theResultReportsWhatWentIn(@TempDir Path dir) throws Exception {
        // W5 renders this: "14 cards, 2 pictures, 1 skipped" is what makes a partial export honest.
        Path apkg = dir.resolve("r.apkg");
        var result = writer.write(deckWithMedia(List.of(
                ApkgWriterService.Media.ofBytes("x.png", PNG))), apkg);

        assertThat(result.notesWritten()).isEqualTo(1);
        assertThat(result.mediaWritten()).isEqualTo(1);
        assertThat(result.mediaSkipped()).isEmpty();
    }
}
