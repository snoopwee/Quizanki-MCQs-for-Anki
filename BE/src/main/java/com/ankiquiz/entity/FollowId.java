package com.ankiquiz.entity;

import java.io.Serializable;
import java.util.Objects;

/** Composite key for {@link Follow}: one row per (follower, author). */
public class FollowId implements Serializable {

    private String followerId;
    private String authorId;

    public FollowId() {
    }

    public FollowId(String followerId, String authorId) {
        this.followerId = followerId;
        this.authorId = authorId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof FollowId other)) {
            return false;
        }
        return Objects.equals(followerId, other.followerId) && Objects.equals(authorId, other.authorId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(followerId, authorId);
    }
}
