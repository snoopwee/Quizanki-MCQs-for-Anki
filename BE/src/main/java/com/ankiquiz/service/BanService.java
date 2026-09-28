package com.ankiquiz.service;

import com.ankiquiz.entity.UserBan;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.UserBanRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Suspending an account, and telling the person why.
 *
 * <p>Enforced here rather than at Supabase (see V39). Supabase's own ban blocks sign-in outright,
 * which makes the reason undeliverable: with no session there is no way to know who is asking, and
 * an endpoint that returned a ban reason for a typed email would be a leak and a harassment tool.
 *
 * <p>The cost is that a suspended person still holds a valid token. There is nothing they can do
 * with it — every read and write goes through this backend, which refuses them.
 */
@Service
public class BanService {

    /**
     * How long an answer is reused. This is checked on EVERY authenticated request, and the
     * database is a network hop away, so an uncached lookup would roughly double the latency of
     * every call in the app. A minute of staleness on a ban is the trade; an explicit invalidation
     * on ban and lift means the common case is not stale at all.
     */
    private static final Duration CACHE_TTL = Duration.ofSeconds(60);

    private final UserBanRepository bans;
    private final NotificationService notifications;
    private final Clock clock;

    /** userId → (answer, when it was computed). Absent means "not looked up recently". */
    private final Map<String, CachedBan> cache = new ConcurrentHashMap<>();

    public BanService(UserBanRepository bans, NotificationService notifications, Clock clock) {
        this.bans = bans;
        this.notifications = notifications;
        this.clock = clock;
    }

    private record CachedBan(UserBan ban, Instant at) {
    }

    /**
     * The ban in force for this person, or empty. Cached — called on every request.
     *
     * <p>Read-only and deliberately forgiving: the caller is a security filter, and a database
     * hiccup must not lock everybody out of the app.
     */
    @Transactional(readOnly = true)
    public Optional<UserBan> activeBan(String userId) {
        if (userId == null || userId.isBlank()) {
            return Optional.empty();
        }
        Instant now = clock.instant();
        CachedBan cached = cache.get(userId);
        if (cached != null && cached.at().plus(CACHE_TTL).isAfter(now)) {
            return Optional.ofNullable(cached.ban());
        }
        Optional<UserBan> found = bans.findByUserIdAndLiftedAtIsNull(userId);
        cache.put(userId, new CachedBan(found.orElse(null), now));
        return found;
    }

    /** Every suspension this person has ever had, newest first. */
    @Transactional(readOnly = true)
    public List<UserBan> history(String userId) {
        return bans.findByUserIdOrderByBannedAtDesc(userId);
    }

    /** Active bans for a page of users, one query — the admin list must not be N+1. */
    @Transactional(readOnly = true)
    public Map<String, UserBan> activeBans(List<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Map.of();
        }
        Map<String, UserBan> byUser = new java.util.HashMap<>();
        for (UserBan ban : bans.findByUserIdInAndLiftedAtIsNull(userIds)) {
            byUser.put(ban.getUserId(), ban);
        }
        return byUser;
    }

    /**
     * Suspend an account.
     *
     * @throws ConflictException if they are already suspended — re-banning would otherwise
     *                           overwrite the standing reason with a new one and lose the first.
     */
    @Transactional
    public UserBan ban(String userId, String reason, String adminId) {
        String why = reason == null ? "" : reason.trim();
        if (why.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Say why — the person suspended is shown this.");
        }
        if (userId == null || userId.isBlank()) {
            throw new NotFoundException("User not found");
        }
        if (bans.findByUserIdAndLiftedAtIsNull(userId).isPresent()) {
            throw new ConflictException("That account is already suspended.");
        }
        if (userId.equals(adminId)) {
            // The one mistake with no way back: the admin panel is behind the same gate.
            throw new ConflictException("You can't suspend your own account.");
        }

        UserBan ban = new UserBan();
        ban.setUserId(userId);
        ban.setReason(why);
        ban.setBannedAt(OffsetDateTime.now(clock));
        ban.setBannedBy(adminId);
        UserBan saved = bans.save(ban);
        cache.remove(userId);
        return saved;
    }

    /**
     * Lift a suspension. The row stays — a lifted ban is history, not a mistake to erase — and the
     * person is told they are back, which is the first thing they will see on return.
     */
    @Transactional
    public void lift(String userId, String adminId, String note) {
        UserBan ban = bans.findByUserIdAndLiftedAtIsNull(userId)
                .orElseThrow(() -> new NotFoundException("That account isn't suspended."));

        ban.setLiftedAt(OffsetDateTime.now(clock));
        ban.setLiftedBy(adminId);
        ban.setLiftNote(note == null || note.isBlank() ? null : note.trim());
        bans.save(ban);
        cache.remove(userId);

        notifications.accountRestored(userId, ban.getLiftNote());
    }
}
