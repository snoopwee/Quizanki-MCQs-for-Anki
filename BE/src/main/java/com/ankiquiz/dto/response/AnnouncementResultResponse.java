package com.ankiquiz.dto.response;

/**
 * What a broadcast actually did. {@code recipients} is how many people it was aimed at and
 * {@code sent} how many rows were written — they differ if a recipient was dropped (a blank id, or
 * a duplicate in the list), so reporting both keeps the admin's confirmation honest.
 */
public record AnnouncementResultResponse(
        String audience,
        int recipients,
        int sent
) {
}
