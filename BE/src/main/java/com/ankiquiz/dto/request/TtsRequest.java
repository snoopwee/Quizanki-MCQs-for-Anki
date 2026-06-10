package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request a spoken rendering of {@code text} in language {@code lang} (a BCP-47
 * primary subtag such as {@code vi}, {@code ja}, {@code zh}). Public, no auth —
 * the FE only calls this for a segment whose language the visitor's device has no
 * voice for, so the text is a single flashcard face or sentence. The size cap
 * bounds per-request synthesis cost; over-length requests are rejected as 400 by
 * the validation handler.
 */
public record TtsRequest(
        @NotBlank @Size(max = 600, message = "Text is too long to read aloud.") String text,
        @NotBlank @Size(max = 20) String lang
) {
}
