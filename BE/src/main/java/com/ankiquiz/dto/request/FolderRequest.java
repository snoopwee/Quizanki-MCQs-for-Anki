package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of folder create / rename. The name is trimmed and must be unique within the account. */
public record FolderRequest(
        @NotBlank @Size(max = 60) String name
) {
}
