package com.ankiquiz.entity;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/** Composite key for {@link DeckRating}: one rating per person per deck. */
public class DeckRatingId implements Serializable {

    private UUID deckId;
    private String userId;

    public DeckRatingId() {
    }

    public DeckRatingId(UUID deckId, String userId) {
        this.deckId = deckId;
        this.userId = userId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof DeckRatingId other)) {
            return false;
        }
        return Objects.equals(deckId, other.deckId) && Objects.equals(userId, other.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(deckId, userId);
    }
}
