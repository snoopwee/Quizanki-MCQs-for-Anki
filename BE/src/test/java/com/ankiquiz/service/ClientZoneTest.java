package com.ankiquiz.service;

import org.junit.jupiter.api.Test;

import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class ClientZoneTest {

    @Test
    void parsesAnIanaZone() {
        assertThat(ClientZone.parse("Asia/Ho_Chi_Minh")).isEqualTo(ZoneId.of("Asia/Ho_Chi_Minh"));
    }

    @Test
    void trimsSurroundingWhitespace() {
        assertThat(ClientZone.parse("  Europe/London ")).isEqualTo(ZoneId.of("Europe/London"));
    }

    @Test
    void missingOrBlank_fallsBackToUtc() {
        assertThat(ClientZone.parse(null)).isEqualTo(ZoneOffset.UTC);
        assertThat(ClientZone.parse("   ")).isEqualTo(ZoneOffset.UTC);
    }

    @Test
    void unknownZone_fallsBackToUtc_insteadOfFailing() {
        assertThat(ClientZone.parse("Mars/Olympus_Mons")).isEqualTo(ZoneOffset.UTC);
    }

    @Test
    void oversizedValue_fallsBackToUtc() {
        assertThat(ClientZone.parse("A".repeat(ClientZone.MAX_LENGTH + 1))).isEqualTo(ZoneOffset.UTC);
    }
}
