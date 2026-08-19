package com.ankiquiz.dto.response;

/**
 * Orphan-media dry-run: how much the GC would reclaim right now, without deleting
 * anything. {@code graceDays} echoes the window used so the caller sees why an
 * object might not be counted yet.
 */
public record MediaGcReport(int graceDays, long orphanCount, long reclaimableBytes) {
}
