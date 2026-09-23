package com.ankiquiz.service;

import com.ankiquiz.dto.response.FollowStatusResponse;
import com.ankiquiz.dto.response.FollowerResponse;
import com.ankiquiz.dto.response.FollowedAuthorResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Follow;
import com.ankiquiz.entity.Profile;
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
 * <p>Anybody the app knows can be followed — that is, anybody with a {@code profiles} row or a
 * published deck. It used to require a published deck, because author pages were built from deck
 * rows and there was nothing to subscribe to otherwise; since V33 every signed-in user has a page,
 * and following somebody back off your follower list has to work whether or not they have published
 * anything yet. Their decks going private later does not undo the follow.
 */
@Service
public class FollowService {

    private final FollowRepository follows;
    private final DeckRepository decks;
    private final NotificationService notifications;
    private final ProfileService profiles;
    private final Clock clock;

    public FollowService(FollowRepository follows, DeckRepository decks,
                         NotificationService notifications, ProfileService profiles, Clock clock) {
        this.follows = follows;
        this.decks = decks;
        this.notifications = notifications;
        this.profiles = profiles;
        this.clock = clock;
    }

    /** Idempotent: following twice leaves one row and is not an error. */
    @Transactional
    public FollowStatusResponse follow(String followerId, String authorId) {
        if (followerId.equals(authorId)) {
            // The database refuses it too; this is the readable version.
            throw new ConflictException("You can't follow yourself.");
        }
        requireKnownUser(authorId);

        if (!follows.existsByFollowerIdAndAuthorId(followerId, authorId)) {
            Follow follow = new Follow();
            follow.setFollowerId(followerId);
            follow.setAuthorId(authorId);
            follow.setCreatedAt(OffsetDateTime.now(clock));
            follows.save(follow);

            // Only on a NEW row: following is idempotent, and pressing the button twice must not
            // announce you twice. The name is their USERNAME — the one name this app has — which
            // exists even for somebody who has never published anything.
            String followerName = profiles.find(followerId)
                    .map(Profile::getUsername)
                    .orElse(null);
            notifications.newFollower(authorId, followerId, followerName);
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

    /** Who the caller follows, newest first, with each one's current name and deck count. */
    @Transactional(readOnly = true)
    public List<FollowedAuthorResponse> following(String followerId) {
        List<String> authorIds = follows.authorsFollowedBy(followerId);
        if (authorIds.isEmpty()) {
            return List.of();
        }
        // One query for every followed author's public decks, then grouped in memory — a handful
        // of rows per author, and it keeps this to a single round trip. One more for their names.
        Map<String, List<Deck>> byAuthor = decks.findPublicByAuthors(authorIds).stream()
                .collect(Collectors.groupingBy(Deck::getAuthorId));
        Map<String, Profile> named = profiles.findAll(authorIds);

        return authorIds.stream().map(id -> {
            List<Deck> published = byAuthor.getOrDefault(id, List.of());
            Deck latest = published.isEmpty() ? null : published.getFirst();
            // The username IS the name. A deck's author_name is a credit snapshot and only the
            // fallback — and it does not exist at all for somebody you followed back off your
            // follower list who has never published.
            Profile profile = named.get(id);
            String name = profile != null && profile.getUsername() != null
                    ? profile.getUsername()
                    : (latest == null ? null : latest.getAuthorName());
            String avatar = profile != null && profile.getAvatarUrl() != null
                    ? profile.getAvatarUrl()
                    : (latest == null ? null : latest.getAuthorAvatarUrl());
            return new FollowedAuthorResponse(id,
                    profile == null ? null : profile.getUsername(),
                    name, avatar, published.size());
        }).toList();
    }

    /**
     * Who follows this author — <b>for that author alone</b>.
     *
     * <p>Public counts, private lists: the number sits under anybody's name, but who those people
     * are is the author's business. Somebody else's list is a 404, not a 403, matching the rest of
     * the app.
     */
    @Transactional(readOnly = true)
    public List<FollowerResponse> followers(String viewerId, String authorId) {
        if (viewerId == null || !viewerId.equals(authorId)) {
            throw new NotFoundException("Author not found: " + authorId);
        }
        List<String> followerIds = follows.followersOf(authorId);
        if (followerIds.isEmpty()) {
            return List.of();
        }
        // One query for every follower's name, not one each — and profiles is the only place that
        // can name a learner who has never published.
        Map<String, Profile> named = profiles.findAll(followerIds);
        return followerIds.stream()
                .map(id -> {
                    Profile profile = named.get(id);
                    return new FollowerResponse(id,
                            profile == null ? null : profile.getUsername(),
                            // Same value as the username, deliberately: one name, and the DTO
                            // keeps both fields so a client can render either without a lookup.
                            profile == null ? null : profile.getUsername(),
                            profile == null ? null : profile.getAvatarUrl());
                })
                .toList();
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

    private void requireKnownUser(String userId) {
        // A profile row is the cheap test and covers everyone who has signed in since V33; the deck
        // lookup is the fallback for an author whose row somehow predates the backfill. A user we
        // have never heard of is a 404, which also keeps a made-up id from being confirmed here.
        if (profiles.find(userId).isPresent()) {
            return;
        }
        if (decks.findPublicByAuthor(userId).isEmpty()) {
            throw new NotFoundException("Author not found: " + userId);
        }
    }

}
