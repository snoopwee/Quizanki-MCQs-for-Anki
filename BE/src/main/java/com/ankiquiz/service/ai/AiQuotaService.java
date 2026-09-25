package com.ankiquiz.service.ai;

import com.ankiquiz.exception.AiUnavailableException;
import com.ankiquiz.exception.RateLimitExceededException;
import com.ankiquiz.repository.AiGenerationRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Optional;

/**
 * Decides whether a generation may run, and on whose key.
 *
 * The rule that shapes this whole class: **a free tier is billed per ACCOUNT, not per user.** One
 * shared key means every user draws from one pool, so without a per-user cap the first enthusiast
 * empties the day for everybody. Hence three limits:
 *
 * <ul>
 *   <li><b>shared, per user</b> — small (a handful a day). The point is to let a newcomer try the
 *       feature, not to be somebody's free API.</li>
 *   <li><b>shared, global</b> — the pool's own ceiling, kept below the provider's free quota so we
 *       degrade with our own message instead of the provider's 429.</li>
 *   <li><b>bring-your-own-key, per user</b> — they pay, so this is only an abuse backstop on OUR
 *       server (a stolen key shouldn't be burnable through us at machine speed).</li>
 * </ul>
 */
@Service
public class AiQuotaService {

    /**
     * Who pays for a generation and with which key. {@code apiKey} is live credential material:
     * use it for the call and drop it — never log it, never put it in a response.
     */
    public record AiAccess(String keyOwner, String apiKey, int remainingToday) {
        public static final String SHARED = "shared";
        public static final String USER = "user";

        public boolean isShared() {
            return SHARED.equals(keyOwner);
        }
    }

    private final AiKeyService keyService;
    private final AiGenerationRepository generations;
    private final Clock clock;

    private final boolean enabled;
    private final String sharedApiKey;
    private final int sharedPerDay;
    private final int globalPerDay;
    private final int byokPerDay;
    private final ZoneId poolResetZone;

    public AiQuotaService(
            AiKeyService keyService,
            AiGenerationRepository generations,
            Clock clock,
            @Value("${ai.enabled:false}") boolean enabled,
            @Value("${ai.api-key:}") String sharedApiKey,
            @Value("${ai.quota.shared-per-day:5}") int sharedPerDay,
            @Value("${ai.quota.global-per-day:200}") int globalPerDay,
            @Value("${ai.quota.byok-per-day:100}") int byokPerDay,
            @Value("${ai.quota.pool-reset-zone:America/Los_Angeles}") String poolResetZone
    ) {
        this.keyService = keyService;
        this.generations = generations;
        this.clock = clock;
        this.enabled = enabled;
        this.sharedApiKey = sharedApiKey == null ? "" : sharedApiKey.trim();
        this.sharedPerDay = sharedPerDay;
        this.globalPerDay = globalPerDay;
        this.byokPerDay = byokPerDay;
        // Gemini's free daily quota resets at midnight Pacific, so our pool ceiling uses the same
        // boundary — otherwise our "day" straddles theirs and the pool empties early.
        this.poolResetZone = ZoneId.of(poolResetZone);
    }

    /**
     * @param zone the caller's own timezone, for their personal daily reset (same reasoning as the
     *             study streak: a "day" should be the user's day)
     * @throws AiUnavailableException   the feature is off, or no key exists at all
     * @throws RateLimitExceededException a per-user or pool limit is spent
     */
    @Transactional(readOnly = true)
    public AiAccess authorize(String userId, ZoneId zone) {
        if (!enabled) {
            throw new AiUnavailableException("AI generation is switched off on this server.");
        }

        Optional<String> ownKey = keyService.resolveKey(userId);
        if (ownKey.isPresent()) {
            long used = generations.countChargeableForUserSince(userId, AiAccess.USER, startOfDay(zone));
            if (used >= byokPerDay) {
                throw new RateLimitExceededException(
                        "You've hit today's limit of " + byokPerDay + " generations. Try again tomorrow.");
            }
            return new AiAccess(AiAccess.USER, ownKey.get(), (int) (byokPerDay - used));
        }

        if (sharedApiKey.isEmpty()) {
            throw new AiUnavailableException(
                    "AI generation needs your own API key — add one in Settings.");
        }

        long usedByUser = generations.countChargeableForUserSince(userId, AiAccess.SHARED, startOfDay(zone));
        if (usedByUser >= sharedPerDay) {
            throw new RateLimitExceededException("You've used today's " + sharedPerDay
                    + " free generations. Add your own API key in Settings for more, or come back tomorrow.");
        }

        long usedByEveryone = generations.countChargeableOnSharedKeySince(startOfDay(poolResetZone));
        if (usedByEveryone >= globalPerDay) {
            throw new RateLimitExceededException("Free AI generation is maxed out for today across "
                    + "everyone using Quizanki. Add your own API key in Settings, or try tomorrow.");
        }

        return new AiAccess(AiAccess.SHARED, sharedApiKey, (int) (sharedPerDay - usedByUser));
    }

    private OffsetDateTime startOfDay(ZoneId zone) {
        return LocalDate.now(clock.withZone(zone)).atStartOfDay(zone).toOffsetDateTime();
    }
}
