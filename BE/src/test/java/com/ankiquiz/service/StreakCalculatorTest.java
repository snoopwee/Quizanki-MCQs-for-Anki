package com.ankiquiz.service;

import com.ankiquiz.dto.response.StreakResponse;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class StreakCalculatorTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 14);

    private static LocalDate daysAgo(int n) {
        return TODAY.minusDays(n);
    }

    @Test
    void noStudy_isAllZero() {
        StreakResponse r = StreakCalculator.compute(List.of(), TODAY);

        assertThat(r.current()).isZero();
        assertThat(r.longest()).isZero();
        assertThat(r.studiedToday()).isFalse();
    }

    @Test
    void studiedOnlyToday_isAStreakOfOne() {
        StreakResponse r = StreakCalculator.compute(List.of(TODAY), TODAY);

        assertThat(r.current()).isEqualTo(1);
        assertThat(r.longest()).isEqualTo(1);
        assertThat(r.studiedToday()).isTrue();
    }

    @Test
    void consecutiveDaysEndingToday_allCount() {
        StreakResponse r = StreakCalculator.compute(List.of(TODAY, daysAgo(1), daysAgo(2)), TODAY);

        assertThat(r.current()).isEqualTo(3);
    }

    @Test
    void notStudiedYetToday_keepsYesterdaysStreakAlive() {
        StreakResponse r = StreakCalculator.compute(List.of(daysAgo(1), daysAgo(2)), TODAY);

        assertThat(r.studiedToday()).isFalse();
        assertThat(r.current()).isEqualTo(2);
    }

    @Test
    void aFullyMissedDay_breaksTheStreak() {
        // Studied two and three days ago, but not yesterday and not (yet) today.
        StreakResponse r = StreakCalculator.compute(List.of(daysAgo(2), daysAgo(3)), TODAY);

        assertThat(r.current()).isZero();
        assertThat(r.longest()).isEqualTo(2);
    }

    @Test
    void longest_isTheBestRunEvenWhenTheCurrentRunIsShorter() {
        StreakResponse r = StreakCalculator.compute(
                List.of(TODAY, daysAgo(5), daysAgo(6), daysAgo(7), daysAgo(8)), TODAY);

        assertThat(r.current()).isEqualTo(1);
        assertThat(r.longest()).isEqualTo(4);
    }

    @Test
    void duplicatesAndOrder_doNotMatter() {
        StreakResponse r = StreakCalculator.compute(List.of(daysAgo(1), TODAY, TODAY, daysAgo(1)), TODAY);

        assertThat(r.current()).isEqualTo(2);
        assertThat(r.longest()).isEqualTo(2);
    }

    @Test
    void aDateAheadOfToday_fromATimezoneChange_doesNotInflateTheCurrentStreak() {
        // "Tomorrow" was recorded in a zone further east than the one the user is in now.
        StreakResponse r = StreakCalculator.compute(List.of(TODAY.plusDays(1), TODAY), TODAY);

        assertThat(r.current()).isEqualTo(1);
    }

    @Test
    void lastSevenDays_isTodayAndTheSixBefore_oldestFirst() {
        StreakResponse r = StreakCalculator.compute(List.of(TODAY, daysAgo(3)), TODAY);

        assertThat(r.last7Days()).hasSize(7);
        assertThat(r.last7Days().get(0).date()).isEqualTo(daysAgo(6));
        assertThat(r.last7Days().get(6).date()).isEqualTo(TODAY);
        assertThat(r.last7Days()).extracting(StreakResponse.Day::studied)
                .containsExactly(false, false, false, true, false, false, true);
    }
}
