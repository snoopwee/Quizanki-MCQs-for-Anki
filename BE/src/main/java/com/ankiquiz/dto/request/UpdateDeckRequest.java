package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Deck-level edit. Only the name is editable for now (rename). */
public record UpdateDeckRequest(
        @NotBlank String name
) {
}
