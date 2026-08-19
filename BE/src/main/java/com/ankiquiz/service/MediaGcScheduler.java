package com.ankiquiz.service;

import com.ankiquiz.dto.response.MediaGcResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Runs the orphan-media GC automatically on a schedule (default 03:30 UTC daily).
 * <b>Off by default</b> ({@code media.gc.enabled=false}) — flip it on only after the
 * read-only dry run ({@code GET /api/v1/admin/media/orphans}) looks right. Failures
 * are logged, never rethrown, so a transient Storage/DB hiccup can't kill the timer.
 * The same {@link MediaGcService} still backs the manual admin endpoints, so this is
 * purely an automatic trigger on top.
 */
@Component
public class MediaGcScheduler {

    private static final Logger log = LoggerFactory.getLogger(MediaGcScheduler.class);

    private final MediaGcService gc;
    private final boolean enabled;

    public MediaGcScheduler(MediaGcService gc, @Value("${media.gc.enabled:false}") boolean enabled) {
        this.gc = gc;
        this.enabled = enabled;
    }

    @Scheduled(cron = "${media.gc.cron:0 30 3 * * *}", zone = "UTC")
    public void sweep() {
        if (!enabled) {
            return; // dormant until explicitly turned on
        }
        try {
            MediaGcResult r = gc.collect(null);
            log.info("Scheduled media GC: deleted {} orphaned objects ({} bytes), {} failed",
                    r.deleted(), r.reclaimedBytes(), r.failed());
        } catch (Exception e) {
            log.error("Scheduled media GC failed (will retry next run)", e);
        }
    }
}
