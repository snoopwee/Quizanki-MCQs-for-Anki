package com.ankiquiz.dto.response;

/**
 * Outcome of a post-save .apkg audio import: how many notes had a clip attached and
 * how many distinct clips were uploaded to storage. Both can be less than requested
 * — missing, oversized, or unsupported media is skipped, not an error.
 */
public record AudioImportResponse(int notesUpdated, int clipsImported) {
}
