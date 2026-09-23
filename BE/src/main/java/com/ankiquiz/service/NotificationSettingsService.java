package com.ankiquiz.service;

import com.ankiquiz.dto.response.NotificationSettingResponse;
import com.ankiquiz.entity.NotificationMute;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.NotificationMuteRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

/**
 * Which notifications a person wants.
 *
 * <p>Stored as a mute list: a row means "don't send me this", and no row means send. Somebody who
 * has never opened their settings therefore has no rows at all, and a kind added later is on for
 * everyone with no backfill.
 */
@Service
public class NotificationSettingsService {

    private final NotificationMuteRepository mutes;
    private final Clock clock;

    public NotificationSettingsService(NotificationMuteRepository mutes, Clock clock) {
        this.mutes = mutes;
        this.clock = clock;
    }

    /** Every kind this person may switch off, with its current state. */
    @Transactional(readOnly = true)
    public List<NotificationSettingResponse> settings(String userId) {
        Set<String> muted = Set.copyOf(mutes.kindsMutedBy(userId));
        return java.util.Arrays.stream(NotificationKind.values())
                .filter(NotificationKind::mutable)
                .map(kind -> new NotificationSettingResponse(kind.wire(), muted.contains(kind.wire())))
                .toList();
    }

    /** Idempotent in both directions: muting twice leaves one row, unmuting nothing is fine. */
    @Transactional
    public void setMuted(String userId, String wire, boolean muted) {
        NotificationKind kind = NotificationKind.fromWire(wire)
                .orElseThrow(() -> new NotFoundException("No such notification kind: " + wire));
        if (!kind.mutable()) {
            // Better a plain refusal than a switch that silently does nothing.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That kind of notification can't be switched off.");
        }

        if (!muted) {
            mutes.deleteByUserIdAndKind(userId, kind.wire());
            return;
        }
        if (mutes.existsByUserIdAndKind(userId, kind.wire())) {
            return;
        }
        NotificationMute mute = new NotificationMute();
        mute.setUserId(userId);
        mute.setKind(kind.wire());
        mute.setMutedAt(OffsetDateTime.now(clock));
        mutes.save(mute);
    }
}
