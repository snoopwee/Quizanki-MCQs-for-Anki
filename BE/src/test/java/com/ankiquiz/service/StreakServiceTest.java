package com.ankiquiz.service;

import com.ankiquiz.dto.response.StreakResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StreakServiceTest {

    private static final String USER = "user-1";
    private static final ZoneId HO_CHI_MINH = ZoneId.of("Asia/Ho_Chi_Minh");

    @Mock private EntityManager entityManager;
    @Mock private Query query;

    private StreakService serviceAt(String instant) {
        return new StreakService(entityManager, Clock.fixed(Instant.parse(instant), ZoneOffset.UTC));
    }

    @Test
    void today_isTheUsersLocalDate_notUtcs() {
        // 20:00 UTC on the 13th is already 03:00 on the 14th in Ho Chi Minh City.
        StreakService service = serviceAt("2026-09-13T20:00:00Z");

        assertThat(service.todayIn(HO_CHI_MINH)).isEqualTo(LocalDate.of(2026, 9, 14));
        assertThat(service.todayIn(ZoneOffset.UTC)).isEqualTo(LocalDate.of(2026, 9, 13));
    }

    @Test
    void today_isCorrectEitherSideOfADaylightSavingChange() {
        ZoneId newYork = ZoneId.of("America/New_York");
        // US daylight saving starts 2026-03-08 at 02:00 local time (07:00 UTC).
        assertThat(serviceAt("2026-03-08T04:30:00Z").todayIn(newYork))
                .isEqualTo(LocalDate.of(2026, 3, 7)); // 23:30 EST
        assertThat(serviceAt("2026-03-08T07:30:00Z").todayIn(newYork))
                .isEqualTo(LocalDate.of(2026, 3, 8)); // 03:30 EDT
    }

    @Test
    void markStudied_insertsTodaysLocalDate_andIgnoresRepeatsOnTheSameDay() {
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);

        serviceAt("2026-09-13T20:00:00Z").markStudied(USER, HO_CHI_MINH, "learn");

        verify(entityManager).createNativeQuery(contains("ON CONFLICT (user_id, local_date) DO NOTHING"));
        verify(query).setParameter("userId", USER);
        verify(query).setParameter("localDate", LocalDate.of(2026, 9, 14));
        verify(query).setParameter("source", "learn");
        verify(query).executeUpdate();
    }

    @Test
    void getStreak_readsStoredDates_andCountsInTheUsersZone() {
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        // One row as java.sql.Date (Hibernate's default for DATE) and one as LocalDate.
        when(query.getResultList()).thenReturn(List.of(
                java.sql.Date.valueOf(LocalDate.of(2026, 9, 13)),
                LocalDate.of(2026, 9, 14)));

        StreakResponse r = serviceAt("2026-09-13T20:00:00Z").getStreak(USER, HO_CHI_MINH);

        assertThat(r.studiedToday()).isTrue();
        assertThat(r.current()).isEqualTo(2);
        verify(query).setParameter("userId", USER);
    }

    @Test
    void getStreak_theSameRowsInUtc_treatTheLaterDateAsTomorrow() {
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.getResultList()).thenReturn(List.of(
                java.sql.Date.valueOf(LocalDate.of(2026, 9, 13)),
                LocalDate.of(2026, 9, 14)));

        // In UTC it is still the 13th, so the 14th is ahead of today and doesn't extend the streak.
        StreakResponse r = serviceAt("2026-09-13T20:00:00Z").getStreak(USER, ZoneOffset.UTC);

        assertThat(r.studiedToday()).isTrue();
        assertThat(r.current()).isEqualTo(1);
    }
}
