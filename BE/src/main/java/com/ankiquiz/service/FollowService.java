package com.ankiquiz.service;

import com.ankiquiz.dto.response.FollowStatusResponse;
import com.ankiquiz.dto.response.FollowedAuthorResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Follow;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.FollowRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Following an author.
 *
 * <p>A follow is a subscription to an author page, not a friendship: nothing is mutual, the author
 * is never asked to accept it, and unfollowing tells them nothing. That is why there is no request
 * state here and no notification when somebody follows you.
 *
 * <p>An author only exists as far as this app is concerned if they have published something —
 * author pages are built from public decks — so that is the test for whether one can be followed.
 * Their decks going private later does not undo the follow.
 */
@Service
public class FollowService {

    private final FollowRepository follows;
    private final DeckRepository decks;
    private final NotificationService notifications;
    private final Clock clock;

    public FollowService(FollowRepository follows, DeckRepository decks,
                         NotificationService notifications, Clock clock) {
        this.follows = follows;
        this.decks = decks;
        this.notifications = notifications;
        this.clock = clock;
    }

    /** Idempotent: following twice leaves one row and is not an error. */
    @Transactional
    public FollowStatusResponse follow(String followerId, String authorId) {
        if (followerId.equals(authorId)) {
            // The database refuses it too; this is the readable version.
            throw new ConflictException("You can't follow yourself.");
        }
        requirePublishedAuthor(authorId);

        if (!follows.existsByFollowerIdAndAuthorId(followerId, authorId)) {
            Follow follow = new Follow();
            follow.setFollowerId(followerId);
            follow.setAuthorId(authorId);
            follow.setCreatedAt(OffsetDateTime.now(clock));
            follows.save(follow);
        }
        return status(followerId, authorId);
    }

    /** Idempotent: unfollowing someone you never followed is the state you asked for. */
    @Transactional
    public FollowStatusResponse unfollow(String followerId, String authorId) {
        follows.deleteByFollowerIdAndAuthorId(followerId, authorId);
        return status(followerId, authorId);
    }

    @Transactional(readOnly = true)
    public FollowStatusResponse status(String viewerId, String authorId) {
        boolean self = viewerId != null && viewerId.equals(authorId);
        boolean following = !self && viewerId != null
                && follows.existsByFollowerIdAndAuthorId(viewerId, authorId);
        return new FollowStatusResponse(following, follows.countByAuthorId(authorId), self);
    }

    /** Just the number under an author's name — public, so the author page can show it to guests. */
    @Transactional(readOnly = true)
    public long followerCount(String authorId) {
        return follows.countByAuthorId(authorId);
    }

    /** Who the caller follows, newest first, with the name and avatar their decks credit. */
    @Transactional(readOnly = true)
    public List<FollowedAuthorResponse> following(String followerId) {
        List<String> authorIds = follows.authorsFollowedBy(followerId);
        if (authorIds.isEmpty()) {
            return List.of();
        }
        // One query for every followed author's public decks, then grouped in memory — a handful
        // of rows per author, and it keeps this to a single round trip.
        Map<String, List<Deck>> byAuthor = decks.findPublicByAuthors(authorIds).stream()
                .collect(Collectors.groupingBy(Deck::getAuthorId));

        return authorIds.stream().map(id -> {
            List<Deck> published = byAuthor.getOrDefault(id, List.of());
            Deck latest = published.isEmpty() ? null : published.getFirst();
            return new FollowedAuthorResponse(
                    id,
                    latest == null ? null : latest.getAuthorName(),
                    latest == null ? null : latest.getAuthorAvatarUrl(),
                    published.size());
        }).toList();
    }

    /**
     * Tell an author's followers they have published something. Called on the transition to public,
     * never on a deck that was already shared.
     *
     * @return how many people were notified.
     */
    @Transactional
    public int announcePublished(Deck deck) {
        if (deck == null || deck.getAuthorId() == null) {
            return 0;
        }
        List<String> followers = follows.followersOf(deck.getAuthorId());
        if (followers.isEmpty()) {
            return 0;
        }
        // The batched path: this is the one write whose cost grows with how popular someone is.
        return notifications.authorPublishedToMany(followers, deck.getAuthorId(),
                deck.getAuthorName(), deck.getId(), deck.getName());
    }

    private void requirePublishedAuthor(String authorId) {
        if (decks.findPublicByAuthor(authorId).isEmpty()) {
            // Nothing public means no author page to follow, and a 404 keeps an arbitrary user id
            // from being confirmed by trying to follow it.
            throw new NotFoundException("Author not found: " + authorId);
        }
    }

}
