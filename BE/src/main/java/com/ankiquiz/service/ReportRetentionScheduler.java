package com.ankiquiz.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Deletes closed reports once their fifteen days are up (V37), daily at 04:15 UTC.
 *
 * <p><b>On by default</b>, unlike the media GC — that one deletes files out of Storage on evidence
 * it infers, so it earns a dry run first. This deletes rows that already carry an explicit expiry
 * written when an admin closed them, and an OPEN report has no expiry at all, so the worst case is
 * that nothing matches.
 *
 * <p>Failures are logged, never rethrown: a transient database hiccup must not kill the timer, and
 * there is nothing urgent about a report lingering one more day.
 */
@Component
public class ReportRetentionScheduler {

    private static final Logger log = LoggerFactory.getLogger(ReportRetentionScheduler.class);

    private final ReportService deckReports;
    private final ReviewReportService noteReports;

    public ReportRetentionScheduler(ReportService deckReports, ReviewReportService noteReports) {
        this.deckReports = deckReports;
        this.noteReports = noteReports;
    }

    @Scheduled(cron = "${reports.retention.cron:0 15 4 * * *}", zone = "UTC")
    public void sweep() {
        try {
            int decks = deckReports.purgeExpired();
            int notes = noteReports.purgeExpired();
            if (decks > 0 || notes > 0) {
                log.info("Report retention: purged {} deck reports and {} note reports", decks, notes);
            }
        } catch (Exception e) {
            log.error("Report retention sweep failed (will retry next run)", e);
        }
    }
}
