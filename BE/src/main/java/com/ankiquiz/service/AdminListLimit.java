package com.ankiquiz.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

/**
 * The ceiling on rows an admin listing will load in one request.
 *
 * <p>Shared by the deck-report and review-report queues, which are the same screen twice over and
 * had the same unbounded query. Both used to return every matching row, and the retention sweep
 * only stamps {@code purge_after} on CLOSED reports — so an unworked OPEN queue grows forever, and
 * a spam wave would pull all of it into a 512 MB instance to draw one page.
 *
 * <p><b>This is a bound, not pagination.</b> 500 is far more than an admin can work through in a
 * sitting, so in practice nothing is ever cut; it exists so that "the queue is small" stops being
 * load-bearing. The moment a queue legitimately exceeds it, the answer is real pagination and
 * pushing the reason filter into SQL — not a larger constant here.
 */
public final class AdminListLimit {

    public static final int MAX_ROWS = 500;

    /** Newest first, capped. Ordering comes from the query's own {@code OrderBy} clause. */
    public static final Pageable NEWEST = PageRequest.of(0, MAX_ROWS);

    private AdminListLimit() {
    }
}
