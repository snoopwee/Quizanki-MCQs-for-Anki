package com.ankiquiz.service;

import com.ankiquiz.dto.response.StreakResponse;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.TreeSet;

/**
 * Pure streak math over the local dates a user studied. No clock and no database — the
 * caller supplies "today" in the user's own timezone — so every rule is unit-testable.
 */
public final class StreakCalculator {

    static final int RECENT_DAYS = 7;

    private StreakCalculator() {
    }

    public static StreakResponse compute(Collection<LocalDate> studiedDates, LocalDate today) {
        TreeSet<LocalDate> days = new TreeSet<>(studiedDates);
        boolean studiedToday = days.contains(today);

        // A streak stays alive through a day you haven't studied YET: when today isn't in,
        // count back from yesterday. Only a fully missed day (yesterday absent too) breaks it.
        // Counting back from today also ignores any date AHEAD of today, which a later move
        // to a zone further west can produce.
        LocalDate anchor = studiedToday ? today : today.minusDays(1);
        int current = 0;
        for (LocalDate d = anchor; days.contains(d); d = d.minusDays(1)) {
            current++;
        }

        int longest = 0;
        int run = 0;
        LocalDate previous = null;
        for (LocalDate d : days) {
            run = (previous != null && d.equals(previous.plusDays(1))) ? run + 1 : 1;
            longest = Math.max(longest, run);
            previous = d;
        }

        List<StreakResponse.Day> recent = new ArrayList<>(RECENT_DAYS);
        for (int i = RECENT_DAYS - 1; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            recent.add(new StreakResponse.Day(d, days.contains(d)));
        }

        return new StreakResponse(current, longest, studiedToday, recent);
    }
}
