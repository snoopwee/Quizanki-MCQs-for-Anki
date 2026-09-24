package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Why a rating is being removed.
 *
 * <p>Separate from {@link UpdateReportRequest} because this reason has a different audience: it is
 * <b>sent to the person whose rating was removed</b>, in their {@code content_removed}
 * notification. Requiring it is the point — somebody moderated by mistake needs something to
 * appeal, and somebody who broke a rule needs to know which one.
 */
public record TakedownRequest(
        @NotBlank(message = "Say why — this is sent to the person whose rating you're removing.")
        @Size(max = 1000, message = "Keep the reason under 1000 characters.")
        String note
) {
}
