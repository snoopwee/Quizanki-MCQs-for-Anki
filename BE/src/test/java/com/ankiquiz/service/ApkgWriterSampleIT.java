package com.ankiquiz.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Writes a real {@code .apkg} to disk so a human can import it into Anki.
 *
 * <p>No test can boot Anki, so the last step of W1 verification is manual. Skipped unless asked for:
 *
 * <pre>./mvnw test -Dtest=ApkgWriterSampleIT -Dapkg.sample.out=C:/path/to/sample.apkg</pre>
 *
 * <p>Content is eight real rows from the production "Japanese_Basic_Hiragana" deck, so what gets
 * imported looks like what a user would actually export.
 */
class ApkgWriterSampleIT {

    @Test
    @EnabledIfSystemProperty(named = "apkg.sample.out", matches = ".+")
    void writeSampleDeck() throws Exception {
        String[][] rows = {
                {"あ", "a"}, {"い", "i"}, {"う", "u"}, {"え", "e"},
                {"お", "o"}, {"か", "ka"}, {"き", "ki"}, {"く", "ku"},
        };

        List<ApkgWriterService.Note> notes = new ArrayList<>();
        for (String[] row : rows) {
            notes.add(new ApkgWriterService.Note(
                    ApkgWriterService.stableGuid("66614cad-273a-43b0-9326-1d91b04129af", row[0]),
                    List.of(row[0], row[1]),
                    List.of("quizanki")));
        }

        Path out = Path.of(System.getProperty("apkg.sample.out"));
        new ApkgWriterService(new ObjectMapper()).write(
                new ApkgWriterService.DeckSpec("Quizanki — Hiragana (W1 sample)",
                        ApkgWriterService.NoteType.basic("Quizanki Basic"), notes),
                out);

        System.out.println("Wrote " + Files.size(out) + " bytes to " + out.toAbsolutePath());
    }

    /**
     * Renders the MCQ question template as a standalone HTML page, the way Anki would after
     * substituting the fields.
     *
     * <p>The template's behaviour — shuffling, de-duplication, grading — runs in a WebView, so no Java
     * test can exercise it. This makes it drivable by a browser (and eyeball-able during development),
     * which is the only way to check the part the learner actually touches.
     *
     * <pre>./mvnw test -Dtest=ApkgWriterSampleIT -Dmcq.preview.out=C:/path/to/preview.html</pre>
     */
    @Test
    @EnabledIfSystemProperty(named = "mcq.preview.out", matches = ".+")
    void writeMcqPreview() throws Exception {
        ApkgWriterService.NoteType mcq = ApkgWriterService.NoteType.mcq("Quizanki MCQ");

        String question = "Mitochondria";
        // Correct first, then four distractors — one more than the four slots, so the set varies.
        String choices = String.join("\n", List.of(
                "The organelle that performs aerobic respiration",
                "The process converting CO2 and water into glucose",
                "A reactant in photosynthesis",
                "Site where gases are exchanged",
                "The pigment that absorbs light"));

        String body = mcq.qfmt()
                .replace("{{Question}}", question)
                // Anki's editor stores manual line breaks as <br>; mimic that, not raw newlines,
                // so the preview exercises the same splitting path a real card does.
                .replace("{{Choices}}", choices.replace("\n", "<br>"));

        String page = "<!doctype html><html><head><meta charset=\"utf-8\">"
                + "<style>" + mcq.css() + "</style></head>"
                + "<body><div class=\"card\">" + body + "</div></body></html>";

        Path out = Path.of(System.getProperty("mcq.preview.out"));
        Files.writeString(out, page);
        System.out.println("Wrote MCQ preview to " + out.toAbsolutePath());
    }

    /**
     * W1 + W2 + W3 together: a real deck turned into a multiple-choice package, with the generated
     * choices printed so their quality can actually be judged.
     *
     * <pre>./mvnw test -Dtest=ApkgWriterSampleIT -Dmcq.deck.out=C:/path/to/mcq.apkg</pre>
     */
    @Test
    @EnabledIfSystemProperty(named = "mcq.deck.out", matches = ".+")
    void writeMcqDeck() throws Exception {
        String[][] cards = {
                {"Ribosome", "The organelle that assembles proteins from amino acids."},
                {"Photosynthesis", "The process in which light energy is used to convert Carbon dioxide and Water into Glucose and Oxygen."},
                {"Respiration", "The process in which sugar and oxygen react to produce Carbon dioxide, Water, and ATP (energy)."},
                {"Golgi apparatus", "Packages and sorts proteins for transport out of the cell."},
                {"Lysosome", "Contains digestive enzymes that break down waste and worn-out organelles."},
                {"Aerobic", "Requires Oxygen"},
                {"Anaerobic", "Without Oxygen"},
                {"Nucleolus", "The region inside the nucleus where ribosomes are assembled."},
                {"Cytoskeleton", "A network of protein filaments that gives the cell shape and enables movement."},
                {"Lactic Acid", "A waste product of anaerobic respiration that builds up and causes fatigue."},
                {"Water", "A reactant in photosynthesis. Also, a waste product of aerobic respiration."},
                {"Glucose", "A product of photosynthesis containing the stored chemical energy. A reactant of all types of respiration."},
                {"Oxygen", "A waste product of photosynthesis. A reactant of aerobic respiration."},
                {"Light", "The energy source for photosynthesis."},
        };

        List<String> answers = new ArrayList<>();
        for (String[] c : cards) {
            answers.add(c[1]);
        }

        List<ApkgWriterService.Note> notes = new ArrayList<>();
        int skipped = 0;
        for (String[] c : cards) {
            String guid = ApkgWriterService.stableGuid("cell-biology", c[0]);
            McqDistractorSelector.Result picked =
                    McqDistractorSelector.select(c[0], c[1], answers, List.of(), guid);
            if (!picked.usable()) {
                System.out.println("SKIPPED " + c[0] + " — " + picked.rejection());
                skipped++;
                continue;
            }

            // Correct answer first: that is the contract the card template reads.
            List<String> choices = new ArrayList<>();
            choices.add(c[1]);
            choices.addAll(picked.distractors());

            System.out.println("\n== " + c[0] + " ==");
            System.out.println("  ✓ " + c[1]);
            for (String d : picked.distractors()) {
                System.out.println("  ✗ " + d);
            }

            notes.add(new ApkgWriterService.Note(guid,
                    List.of(c[0], String.join("\n", choices), c[1], "",
                            "From \"Cell Biology\" on Quizanki"),
                    List.of("quizanki")));
        }

        Path out = Path.of(System.getProperty("mcq.deck.out"));
        new ApkgWriterService(new ObjectMapper()).write(
                new ApkgWriterService.DeckSpec("Quizanki — Cell Biology (MCQ)",
                        ApkgWriterService.NoteType.mcq("Quizanki MCQ"), notes),
                out);

        System.out.println("\nWrote " + notes.size() + " MCQ cards (" + skipped + " skipped), "
                + Files.size(out) + " bytes to " + out.toAbsolutePath());
    }
}
