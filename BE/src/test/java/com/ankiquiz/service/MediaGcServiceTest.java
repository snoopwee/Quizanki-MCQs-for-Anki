package com.ankiquiz.service;

import com.ankiquiz.dto.response.MediaGcReport;
import com.ankiquiz.dto.response.MediaGcResult;
import com.ankiquiz.entity.MediaObject;
import com.ankiquiz.repository.MediaObjectRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MediaGcServiceTest {

    @Mock
    MediaObjectRepository repo;
    @Mock
    StorageObjectDeleter deleter;

    private MediaGcService service() {
        return new MediaGcService(repo, deleter, 7, 2000);
    }

    @Test
    void report_isReadOnly_andEchoesGraceWindow() {
        when(repo.countOrphans(any())).thenReturn(3L);
        when(repo.sumOrphanBytes(any())).thenReturn(4096L);

        MediaGcReport r = service().report();

        assertEquals(7, r.graceDays());
        assertEquals(3L, r.orphanCount());
        assertEquals(4096L, r.reclaimableBytes());
        verifyNoInteractions(deleter); // dry run deletes nothing
    }

    @Test
    void collect_deletesStorageThenRows_andSumsReclaimedBytes() {
        when(repo.findOrphanBatch(any(), eq(2000)))
                .thenReturn(List.of(obj("h1", "card-images", 100), obj("h2", "card-audio", 200)));
        when(deleter.delete(anyString(), anyString())).thenReturn(true);

        MediaGcResult res = service().collect(null); // null → default max-per-run

        assertEquals(2, res.deleted());
        assertEquals(300L, res.reclaimedBytes());
        assertEquals(0L, res.failed());
        verify(deleter).delete("card-images", "h1");
        verify(deleter).delete("card-audio", "h2");
        verify(repo).deleteAllById(List.of("h1", "h2")); // only after Storage delete
    }

    @Test
    void collect_keepsTheRowWhenStorageDeleteFails() {
        when(repo.findOrphanBatch(any(), anyInt()))
                .thenReturn(List.of(obj("h1", "card-images", 100), obj("h2", "card-audio", 200)));
        when(deleter.delete("card-images", "h1")).thenReturn(true);
        when(deleter.delete("card-audio", "h2")).thenReturn(false); // transient failure

        MediaGcResult res = service().collect(null);

        assertEquals(1, res.deleted());
        assertEquals(100L, res.reclaimedBytes());
        assertEquals(1L, res.failed());
        // the failed object's row survives, so it's retried next run — never orphaned in the registry
        verify(repo).deleteAllById(List.of("h1"));
    }

    @Test
    void collect_withNoOrphans_doesNothing() {
        when(repo.findOrphanBatch(any(), anyInt())).thenReturn(List.of());

        MediaGcResult res = service().collect(null);

        assertEquals(0, res.deleted());
        assertEquals(0L, res.reclaimedBytes());
        assertEquals(0L, res.failed());
        verify(repo, never()).deleteAllById(any());
        verifyNoInteractions(deleter);
    }

    @Test
    void collect_honoursAnExplicitMax() {
        when(repo.findOrphanBatch(any(), eq(5))).thenReturn(List.of());
        service().collect(5);
        verify(repo).findOrphanBatch(any(), eq(5));
    }

    private static MediaObject obj(String hash, String bucket, long bytes) {
        MediaObject o = new MediaObject();
        o.setHash(hash);
        o.setBucket(bucket);
        o.setContentType("image/webp");
        o.setByteSize(bytes);
        return o;
    }
}
