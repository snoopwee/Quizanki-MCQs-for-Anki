package com.ankiquiz.service.ai;

import com.ankiquiz.exception.AiInputException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Pulls the text layer out of an uploaded PDF.
 *
 * Deliberately NOT sending the PDF to the model: that would tie generation to one multimodal
 * provider (a bring-your-own-key user may be on another), cost several times the tokens on a free
 * tier that is already scarce, and make every test need a network. Extraction keeps the provider
 * seam text-only and reuses the chunker, prompt and parser from S2 unchanged.
 *
 * The cost of that choice is no OCR. A scanned PDF has no text layer, so it is rejected with an
 * explanation rather than silently producing nothing.
 */
@Component
public class PdfTextExtractor {

    private static final Logger log = LoggerFactory.getLogger(PdfTextExtractor.class);

    /**
     * @param text      everything read, pages separated by blank lines
     * @param pages     pages in the document
     * @param pagesRead how many were actually read (the rest were past a cap)
     * @param truncated true when a cap stopped us short of the whole document
     */
    public record ExtractedPdf(String text, int pages, int pagesRead, boolean truncated) {
    }

    /**
     * @param maxPages how many pages we are willing to read
     * @param maxChars how much text we are willing to keep (the generator caps again, lower)
     * @throws AiInputException the file isn't a readable PDF, is password-protected, or is a scan
     */
    public ExtractedPdf extract(byte[] bytes, int maxPages, int maxChars) {
        if (bytes == null || bytes.length == 0) {
            throw new AiInputException("That file is empty.");
        }
        try (PDDocument document = Loader.loadPDF(bytes)) {
            int pages = document.getNumberOfPages();
            if (pages == 0) {
                throw new AiInputException("That PDF has no pages.");
            }
            int pagesToRead = Math.min(pages, Math.max(1, maxPages));

            PDFTextStripper stripper = new PDFTextStripper();
            // Read in visual order rather than the order objects happen to sit in the file, so
            // two-column pages don't come out interleaved mid-sentence.
            stripper.setSortByPosition(true);

            StringBuilder text = new StringBuilder();
            boolean hitCharCap = false;
            for (int page = 1; page <= pagesToRead && !hitCharCap; page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                String pageText = stripper.getText(document).strip();
                if (pageText.isEmpty()) {
                    continue;
                }
                if (text.length() > 0) {
                    text.append("\n\n");
                }
                if (text.length() + pageText.length() > maxChars) {
                    text.append(pageText, 0, Math.max(0, maxChars - text.length()));
                    hitCharCap = true;
                } else {
                    text.append(pageText);
                }
            }

            String extracted = text.toString().strip();
            if (extracted.isEmpty()) {
                // Almost always a scan or a photo export: pages exist, but no text layer.
                throw new AiInputException("That PDF has no text in it — it looks like a scan. "
                        + "Try a PDF with selectable text, or paste the text instead.");
            }
            return new ExtractedPdf(extracted, pages, pagesToRead, hitCharCap || pagesToRead < pages);
        } catch (InvalidPasswordException ex) {
            throw new AiInputException("That PDF is password-protected. Remove the password and try again.");
        } catch (AiInputException ex) {
            throw ex;
        } catch (Exception ex) {
            // Corrupt file, not a PDF at all, or a structure PDFBox refuses — all the same to a user.
            log.warn("PDF extraction failed: {}", ex.getClass().getSimpleName());
            throw new AiInputException("Couldn't read that PDF. It may be corrupted or not a PDF.");
        }
    }
}
