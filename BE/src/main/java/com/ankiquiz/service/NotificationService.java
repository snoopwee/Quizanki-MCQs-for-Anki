package com.ankiquiz.service;

import com.ankiquiz.dto.response.NotificationPage;
import com.ankiquiz.dto.response.NotificationResponse;
import com.ankiquiz.entity.Notification;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * The notification centre: the read side the bell uses, and the small write side other features
 * call to tell someone something.
 *
 * Three rules hold throughout.
 * <ul>
 *   <li><b>A notification is only ever reached with its recipient</b> — never by id alone — and
 *       someone else's id is a 404, not a 403.</li>
 *   <li><b>Nobody is notified about their own action.</b> An author publishing a deck must not get
 *       their own "new deck" row, so {@code deliver} drops it at the source rather than making
 *       every caller remember to.</li>
 *   <li><b>Unread rows about the same deck do not stack.</b> Two shares of one deck while the
 *       first is still unread is one row; once read, a later one is news again and gets through.</li>
 * </ul>
 *
 * The write methods join the caller's transaction on purpose: if sharing a deck rolls back, the
 * notification claiming it happened should roll back with it. (That is the opposite of
 * {@code AiUsageLogger}, which uses REQUIRES_NEW precisely so a failed generation still books its
 * budget.)
 */
@Service
public class NotificationService {

    static final int DEFAULT_PAGE_SIZE = 20;
    static final int MAX_PAGE_SIZE = 50;
    /** Bounds what an admin broadcast can paste into a row the client has to render. */
    static final int MAX_TITLE = 120;
    static final int MAX_BODY = 500;
    static final int RETENTION_DAYS = 90;

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notifications;
    private final Clock clock;

    public NotificationService(NotificationRepository notifications, Clock clock) {
        this.notifications = notifications;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public NotificationPage page(String userId, int limit, int offset) {
        int size = Math.max(1, Math.min(limit, MAX_PAGE_SIZE));
        // Spring Data pages by page number, so translate the caller's row offset. id breaks ties
        // on created_at: a broadcast can write many rows in one instant, and without the tiebreak
        // the second page could skip one.
        Pageable pageable = PageRequest.of(Math.max(0, offset) / size, size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));

        Page<Notification> found = notifications.findByUserId(userId, pageable);
        List<NotificationResponse> items = found.getContent().stream()
                .map(NotificationService::toResponse)
                .toList();
        return new NotificationPage(items, found.getNumber(), size, found.getTotalElements(),
                found.getTotalPages(), notifications.countByUserIdAndReadAtIsNull(userId));
    }

    @Transactional(readOnly = true)
    public long unreadCount(String userId) {
        return notifications.countByUserIdAndReadAtIsNull(userId);
    }

    /** Idempotent: marking a read notification read again is not an error and writes nothing. */
    @Transactional
    public void markRead(String userId, UUID notificationId) {
        Notification notification = notifications.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new NotFoundException("Notification not found: " + notificationId));
        if (notification.getReadAt() != null) {
            return;
        }
        notification.setReadAt(OffsetDateTime.now(clock));
        notifications.save(notification);
    }

    /** @return how many were still unread. */
    @Transactional
    public int markAllRead(String userId) {
        return notifications.markAllRead(userId, OffsetDateTime.now(clock));
    }

    /**
     * Remove one notification. Deliberately NOT a 404 when nothing matches: unlike marking read,
     * a delete that finds nothing has already achieved what the caller wanted, and answering the
     * same way for "already gone" and "never yours" keeps another user's id unconfirmable.
     *
     * @return whether a row was actually removed.
     */
    @Transactional
    public boolean delete(String userId, UUID notificationId) {
        return notifications.deleteByIdAndUserId(notificationId, userId) > 0;
    }

    /** Empty this user's bell. @return how many were removed. */
    @Transactional
    public int clear(String userId) {
        return notifications.deleteAllForUser(userId);
    }

    // ── the write side: what other features call ─────────────────────────────────────────────
    // Nothing produces notifications yet. The producers are Phase 10 S5 (admin broadcast) and
    // Phase 11 (share a deck to a user, follow an author), which is why these take the actor and
    // the deck name as arguments rather than looking them up: the caller already has them loaded,
    // and the row is a snapshot anyway.

    /** Someone sent a deck straight to this user. */
    @Transactional
    public boolean deckShared(String recipientId, String actorId, String actorName,
                              UUID deckId, String deckName) {
        String who = hasText(actorName) ? actorName.strip() : "Someone";
        return deliver(recipientId, NotificationKind.DECK_SHARED,
                who + " shared a deck with you", deckName,
                deckId == null ? null : "/decks/" + deckId, actorId, actorName, deckId);
    }

    /** An author this user follows published something new. */
    @Transactional
    public boolean authorPublished(String recipientId, String actorId, String actorName,
                                   UUID deckId, String deckName) {
        String who = hasText(actorName) ? actorName.strip() : "An author you follow";
        return deliver(recipientId, NotificationKind.AUTHOR_PUBLISHED,
                who + " published a new deck", deckName,
                deckId == null ? null : "/decks/" + deckId, actorId, actorName, deckId);
    }

    /**
     * Somebody left a note with their rating. Carries no actor: the feedback page shows no names,
     * so the notification must not leak one either.
     */
    @Transactional
    public boolean deckReviewed(String authorId, UUID deckId, String deckName) {
        return deliver(authorId, NotificationKind.DECK_REVIEWED,
                "New feedback on your deck", deckName,
                deckId == null ? null : "/decks/" + deckId + "/feedback", null, null, deckId);
    }

    /**
     * An admin has finished with something this user reported. Without it the moderation queue is
     * a black hole: the reporter never learns whether anything happened.
     */
    @Transactional
    public boolean reportReviewed(String reporterId, UUID deckId, String deckName, boolean actioned) {
        String outcome = actioned
                ? "We removed what you reported"
                : "We looked at your report";
        return deliver(reporterId, NotificationKind.REPORT_REVIEWED, outcome, deckName,
                deckId == null ? null : "/decks/" + deckId + "/feedback", null, null, deckId);
    }

    /**
     * An admin announcement, fanned out to the recipients the caller names. There is deliberately
     * no "everyone" row: the read side stays one indexed query per user, and per-user read state
     * comes for free.
     *
     * @return how many rows were written.
     */
    @Transactional
    public int announce(Collection<String> recipientIds, String title, String body, String link) {
        if (!hasText(title)) {
            throw new IllegalArgumentException("An announcement needs a title");
        }
        if (recipientIds == null) {
            return 0;
        }
        int sent = 0;
        for (String recipientId : recipientIds.stream().filter(NotificationService::hasText).distinct().toList()) {
            // No actor: the app itself is speaking, so there is nobody to suppress a self-notify
            // against, and no deck to de-duplicate on.
            if (deliver(recipientId, NotificationKind.ANNOUNCEMENT, title, body, link, null, null, null)) {
                sent++;
            }
        }
        return sent;
    }

    /** @return false when the notification was deliberately dropped rather than written. */
    private boolean deliver(String recipientId, NotificationKind kind, String title, String body,
                            String link, String actorId, String actorName, UUID deckId) {
        if (!hasText(recipientId)) {
            return false;
        }
        // You already know what you just did.
        if (actorId != null && actorId.equals(recipientId)) {
            return false;
        }
        if (deckId != null
                && notifications.existsByUserIdAndKindAndDeckIdAndReadAtIsNull(recipientId, kind.wire(), deckId)) {
            return false;
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        // Opportunistic retention: one indexed delete that usually removes nothing. A user who
        // stops getting notifications keeps their old ones, which is harmless — the panel pages.
        notifications.deleteOlderThan(recipientId, now.minusDays(RETENTION_DAYS));

        Notification notification = new Notification();
        notification.setUserId(recipientId);
        notification.setKind(kind.wire());
        notification.setTitle(clip(title, MAX_TITLE));
        notification.setBody(clip(body, MAX_BODY));
        notification.setLink(inAppLink(link));
        notification.setActorId(actorId);
        notification.setActorName(clip(actorName, MAX_TITLE));
        notification.setDeckId(deckId);
        notification.setCreatedAt(now);
        notifications.save(notification);
        return true;
    }

    private static NotificationResponse toResponse(Notification n) {
        return new NotificationResponse(
                n.getId(),
                n.getKind(),
                n.getTitle(),
                n.getBody(),
                n.getLink(),
                n.getActorId(),
                n.getActorName(),
                n.getDeckId(),
                n.getReadAt() != null,
                n.getCreatedAt());
    }

    /**
     * A notification may only point somewhere inside the app. The admin endpoint already refuses a
     * bad link with a 400, so this is the backstop for every other producer: anything absolute,
     * scheme-relative ("//host") or backslashed is dropped rather than shipped to a user's bell.
     * The notification is still worth sending without it. Mirrors the client's `inAppHref`.
     */
    private static String inAppLink(String link) {
        if (!hasText(link)) {
            return null;
        }
        String href = link.strip();
        if (!href.startsWith("/") || href.startsWith("//") || href.contains("\\")) {
            log.warn("Dropped a notification link that is not an in-app path");
            return null;
        }
        return href;
    }

    private static String clip(String text, int max) {
        if (text == null) {
            return null;
        }
        String trimmed = text.strip();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max).strip() + "…";
    }

    private static boolean hasText(String text) {
        return text != null && !text.isBlank();
    }
}
