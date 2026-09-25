package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * An admin broadcast. The caps match {@code NotificationService.MAX_TITLE} / {@code MAX_BODY} — the
 * service would clip a longer one, but an admin typing into a box deserves a 400 that says so
 * rather than silently truncated text.
 *
 * @param link     optional in-app route the row should open, e.g. {@code /help}. Absolute URLs and
 *                 anything scheme-relative are refused here: a notification must not be able to
 *                 send every user off-site.
 * @param audience {@code all} (every user in the project) or {@code me} (the sending admin only,
 *                 for checking what a broadcast looks like). Absent or unrecognised means
 *                 {@code me} — the safe direction to fail in.
 */
public record AnnouncementRequest(
        @NotBlank(message = "An announcement needs a title")
        @Size(max = 120, message = "Keep the title under 120 characters")
        String title,

        @Size(max = 500, message = "Keep the message under 500 characters")
        String body,

        // Empty is allowed (no link); otherwise it must be a plain in-app path. The
        // (?![/\\]) stops "//host" and "/\host", which browsers treat as off-site.
        @Pattern(regexp = "^$|^/(?![/\\\\])[^\\\\]*$",
                message = "A link must be an in-app path like /help")
        String link,

        @Pattern(regexp = "^(all|me)$", message = "Audience must be \"all\" or \"me\"")
        String audience
) {
}
