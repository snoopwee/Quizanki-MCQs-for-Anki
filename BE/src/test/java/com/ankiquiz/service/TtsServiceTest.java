package com.ankiquiz.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TtsServiceTest {

    @Test
    void mapsPrimarySubtagsToGoogleLanguageCodes() {
        assertEquals("vi-VN", TtsService.googleLanguageCode("vi"));
        assertEquals("ja-JP", TtsService.googleLanguageCode("ja"));
        assertEquals("cmn-CN", TtsService.googleLanguageCode("zh"));
        assertEquals("ko-KR", TtsService.googleLanguageCode("ko"));
    }

    @Test
    void passesThroughRegionQualifiedTags() {
        assertEquals("zh-TW", TtsService.googleLanguageCode("zh-TW"));
        assertEquals("en-GB", TtsService.googleLanguageCode("en-GB"));
    }

    @Test
    void fallsBackToEnglishForUnknownOrBlank() {
        assertEquals("en-US", TtsService.googleLanguageCode("xx"));
        assertEquals("en-US", TtsService.googleLanguageCode(""));
        assertEquals("en-US", TtsService.googleLanguageCode(null));
    }
}
