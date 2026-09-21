package com.ankiquiz.dto.response;

import java.time.LocalDate;
import java.util.List;

/**
 * The caller's daily study streak, computed in their own timezone.
 *
 * @param current      consecutive study days ending today — or ending yesterday, because a
 *                     streak stays alive until the end of a day you haven't studied yet
 * @param longest      the longest run of consecutive study days ever
 * @param studiedToday whether today already counts
 * @param last7Days    today and the six days before it, oldest first
 */
public record StreakResponse(int current, int longest, boolean studiedToday, List<Day> last7Days) {

    public record Day(LocalDate date, boolean studied) {
    }
}
