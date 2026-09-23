package com.ankiquiz.dto.response;

/**
 * One switchable notification kind, and whether this person has switched it off.
 *
 * <p>Only mutable kinds appear: an admin announcement is operational and the answer to a report you
 * filed yourself is something you asked for, so neither is offered as a choice. The wording is the
 * client's — the server sends the kind and the state, not a sentence.
 */
public record NotificationSettingResponse(
        String kind,
        boolean muted
) {
}
