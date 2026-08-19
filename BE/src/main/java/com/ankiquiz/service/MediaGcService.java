package com.ankiquiz.service;

import com.ankiquiz.dto.response.MediaGcReport;
import com.ankiquiz.dto.response.MediaGcResult;
import com.ankiquiz.entity.MediaObject;
import com.ankiquiz.repository.MediaObjectRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Reclaims orphaned media — Storage objects that no note references any more (a
 * deleted deck, a replaced image, an abandoned save). This is the <em>only</em> safe
 * way to delete deduped media: because objects are shared by content hash across
 * users and clones, an object is removed only when it's referenced by
 * <b>no note anywhere</b> (a global check) and has been so past a grace window — so
 * shared/cloned bytes are never deleted out from under another user, and a clip
 * uploaded moments before its note is saved isn't reaped mid-import.
 *
 * <p>{@link #report()} is a dry run (counts only). {@link #collect} is the delete,
 * bounded per run so a large backlog clears over several (e.g. cron) runs and no
 * single run runs away. Storage is deleted first, then the registry row — and only
 * if the Storage delete succeeded — so a transient Storage failure just leaves the
 * object to be retried next run, never a dangling registry row.
 */
@Service
public class MediaGcService {

    private static final Logger log = LoggerFactory.getLogger(MediaGcService.class);

    private final MediaObjectRepository repo;
    private final StorageObjectDeleter deleter;
    private final int graceDays;
    private final int maxPerRun;

    public MediaGcService(MediaObjectRepository repo,
                          StorageObjectDeleter deleter,
                          @Value("${media.gc.grace-days:7}") int graceDays,
                          @Value("${media.gc.max-per-run:2000}") int maxPerRun) {
        this.repo = repo;
        this.deleter = deleter;
        this.graceDays = graceDays;
        this.maxPerRun = maxPerRun;
    }

    private OffsetDateTime cutoff() {
        return OffsetDateTime.now().minusDays(graceDays);
    }

    /** Dry run: how many objects are reclaimable and how many bytes. Deletes nothing. */
    public MediaGcReport report() {
        OffsetDateTime cut = cutoff();
        return new MediaGcReport(graceDays, repo.countOrphans(cut), repo.sumOrphanBytes(cut));
    }

    /**
     * Delete up to {@code max} orphaned objects (default {@code media.gc.max-per-run}).
     * Storage object first, then its row — only when the delete succeeded.
     */
    public MediaGcResult collect(Integer max) {
        int limit = (max != null && max > 0) ? max : maxPerRun;
        List<MediaObject> orphans = repo.findOrphanBatch(cutoff(), limit);

        long reclaimedBytes = 0;
        long failed = 0;
        List<String> deletedHashes = new ArrayList<>();
        for (MediaObject o : orphans) {
            if (deleter.delete(o.getBucket(), o.getHash())) {
                deletedHashes.add(o.getHash());
                reclaimedBytes += o.getByteSize();
            } else {
                failed++;
            }
        }
        if (!deletedHashes.isEmpty()) {
            repo.deleteAllById(deletedHashes);
        }
        log.info("Media GC: deleted {} orphaned objects ({} bytes), {} failed",
                deletedHashes.size(), reclaimedBytes, failed);
        return new MediaGcResult(deletedHashes.size(), reclaimedBytes, failed);
    }
}
