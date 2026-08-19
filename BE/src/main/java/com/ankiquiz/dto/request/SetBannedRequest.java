package com.ankiquiz.dto.request;

/** Ban / unban a user from the admin users list. */
public record SetBannedRequest(boolean banned) {
}
