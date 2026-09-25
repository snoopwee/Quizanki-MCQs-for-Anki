package com.ankiquiz.dto.response;

import java.util.List;

/**
 * One page of the notification panel, plus the unread count so opening the bell costs a single
 * request. {@code page} is zero-based, matching the offset the client sends — the same shape as
 * {@link PublicDeckPage}.
 *
 * {@code unread} counts ALL of this user's unread notifications, not just the unread ones on this
 * page: it is what the badge shows.
 */
public record NotificationPage(
        List<NotificationResponse> items,
        int page,
        int pageSize,
        long total,
        int totalPages,
        long unread
) {
}
