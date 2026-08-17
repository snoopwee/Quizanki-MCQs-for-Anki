package com.ankiquiz.dto.response;

/**
 * Outcome of an orphan-media sweep: how many objects were deleted, how many bytes
 * that freed, and how many failed to delete (kept for retry on the next run).
 */
public record MediaGcResult(long deleted, long reclaimedBytes, long failed) {
}
