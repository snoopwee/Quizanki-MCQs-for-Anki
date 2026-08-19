package com.ankiquiz.dto.response;

import java.util.List;

/**
 * One page of the Discover directory: the decks on this page plus enough counts
 * for the client to render a pager ("Page 2 of 7") without a second request.
 * {@code page} is zero-based, matching the offset the client sends.
 */
public record PublicDeckPage(
        List<PublicDeckSummary> items,
        int page,
        int pageSize,
        long total,
        int totalPages
) {
}
