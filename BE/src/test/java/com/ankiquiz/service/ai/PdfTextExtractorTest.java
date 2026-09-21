package com.ankiquiz.service.ai;

import com.ankiquiz.exception.AiInputException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Reading a PDF's text layer. The PDFs here are built in-process, so this runs offline and the
 * awkward cases (a scan with no text, a password, a file that isn't a PDF) are real files rather
 * than mocks.
 */
class PdfTextExtractorTest {

    private final PdfTextExtractor extractor = new PdfTextExtractor();

    /** A PDF with one line of text per page. A page given null gets no content at all — a "scan". */
    private static byte[] pdf(String... pageTexts) throws Exception {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (String text : pageTexts) {
                PDPage page = new PDPage(PDRectangle.A4);
                document.addPage(page);
                if (text == null) {
                    continue;
                }
                try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                    content.beginText();
                    content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                    content.newLineAtOffset(50, 700);
                    content.showText(text);
                    content.endText();
                }
            }
            document.save(out);
            return out.toByteArray();
        }
    }

    private static byte[] encryptedPdf() throws Exception {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            document.addPage(new PDPage(PDRectangle.A4));
            StandardProtectionPolicy policy =
                    new StandardProtectionPolicy("owner-pw", "user-pw", new AccessPermission());
            policy.setEncryptionKeyLength(128);
            document.protect(policy);
            document.save(out);
            return out.toByteArray();
        }
    }

    @Test
    void readsThePagesText() throws Exception {
        PdfTextExtractor.ExtractedPdf extracted = extractor.extract(pdf("Kanji for animals"), 80, 10_000);

        assertThat(extracted.text()).contains("Kanji for animals");
        assertThat(extracted.pages()).isEqualTo(1);
        assertThat(extracted.pagesRead()).isEqualTo(1);
        assertThat(extracted.truncated()).isFalse();
    }

    @Test
    void keepsSeveralPagesInOrder() throws Exception {
        PdfTextExtractor.ExtractedPdf extracted =
                extractor.extract(pdf("page one", "page two", "page three"), 80, 10_000);

        assertThat(extracted.text()).containsSubsequence("page one", "page two", "page three");
        assertThat(extracted.pages()).isEqualTo(3);
    }

    @Test
    void stopsAtThePageCapAndSaysSo() throws Exception {
        PdfTextExtractor.ExtractedPdf extracted =
                extractor.extract(pdf("page one", "page two", "page three"), 2, 10_000);

        assertThat(extracted.text()).contains("page one", "page two").doesNotContain("page three");
        assertThat(extracted.pagesRead()).isEqualTo(2);
        assertThat(extracted.pages()).isEqualTo(3);
        assertThat(extracted.truncated()).isTrue();
    }

    @Test
    void stopsAtTheCharacterCapAndSaysSo() throws Exception {
        PdfTextExtractor.ExtractedPdf extracted = extractor.extract(pdf("aaaaaaaaaa", "bbbbbbbbbb"), 80, 12);

        assertThat(extracted.text().length()).isLessThanOrEqualTo(12);
        assertThat(extracted.truncated()).isTrue();
    }

    @Test
    void aScanIsRejectedWithAnExplanation_becauseThereIsNoOcr() throws Exception {
        // Pages exist but carry no text layer — what a photographed or scanned document looks like.
        assertThatThrownBy(() -> extractor.extract(pdf(null, null), 80, 10_000))
                .isInstanceOf(AiInputException.class)
                .hasMessageContaining("looks like a scan")
                .hasMessageContaining("paste the text");
    }

    @Test
    void aPasswordProtectedPdfSaysSoRatherThanFailingObscurely() throws Exception {
        assertThatThrownBy(() -> extractor.extract(encryptedPdf(), 80, 10_000))
                .isInstanceOf(AiInputException.class)
                .hasMessageContaining("password-protected");
    }

    @Test
    void somethingThatIsNotAPdfIsRejected() {
        byte[] notAPdf = "This is just a text file, renamed.".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> extractor.extract(notAPdf, 80, 10_000))
                .isInstanceOf(AiInputException.class)
                .hasMessageContaining("Couldn't read that PDF");
    }

    @Test
    void anEmptyUploadIsRejected() {
        assertThatThrownBy(() -> extractor.extract(new byte[0], 80, 10_000))
                .isInstanceOf(AiInputException.class);
        assertThatThrownBy(() -> extractor.extract(null, 80, 10_000))
                .isInstanceOf(AiInputException.class);
    }
}
