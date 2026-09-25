package com.ankiquiz.dto.response;

/**
 * How much moderation work is outstanding, for the admin sidebar badge and the two queue tabs.
 *
 * <p>Open only: a badge counts what still needs somebody, and a closed report needs nobody.
 */
public record ReportCountsResponse(
        long deckReports,
        long noteReports,
        long total
) {
}
