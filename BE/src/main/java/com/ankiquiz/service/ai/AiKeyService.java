package com.ankiquiz.service.ai;

import com.ankiquiz.dto.response.AiKeyStatusResponse;
import com.ankiquiz.entity.UserAiKey;
import com.ankiquiz.exception.AiKeyInvalidException;
import com.ankiquiz.repository.UserAiKeyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Stores and retrieves a user's own provider API key.
 *
 * Three rules hold everywhere in this class: the plaintext key is never persisted (see
 * {@link AiKeyCipher}), never returned to a client (only {@link AiKeyStatusResponse}, which carries
 * a four-character hint), and never logged — including inside exception messages.
 */
@Service
public class AiKeyService {

    /** Shortest and longest thing we will accept as a key, to catch obvious paste accidents. */
    private static final int MIN_KEY_LENGTH = 8;
    private static final int MAX_KEY_LENGTH = 512;
    private static final int HINT_LENGTH = 4;

    private final UserAiKeyRepository repository;
    private final AiKeyCipher cipher;
    private final Clock clock;

    public AiKeyService(UserAiKeyRepository repository, AiKeyCipher cipher, Clock clock) {
        this.repository = repository;
        this.cipher = cipher;
        this.clock = clock;
    }

    /** False when the server has no encryption key — then we refuse to store anyone's key at all. */
    public boolean isSupported() {
        return cipher.isConfigured();
    }

    @Transactional(readOnly = true)
    public AiKeyStatusResponse status(String userId) {
        if (!isSupported()) {
            return new AiKeyStatusResponse(false, false, null, null);
        }
        return repository.findById(userId)
                .map(key -> new AiKeyStatusResponse(true, true, key.getProvider(), key.getKeyHint()))
                .orElseGet(() -> new AiKeyStatusResponse(true, false, null, null));
    }

    @Transactional
    public AiKeyStatusResponse save(String userId, String provider, String rawKey) {
        if (!isSupported()) {
            // Storing a third-party credential in plaintext is never an acceptable fallback.
            throw new AiKeyInvalidException("This server can't store API keys right now.");
        }
        String key = rawKey == null ? "" : rawKey.trim();
        if (key.length() < MIN_KEY_LENGTH || key.length() > MAX_KEY_LENGTH) {
            throw new AiKeyInvalidException("That doesn't look like an API key.");
        }
        if (key.chars().anyMatch(Character::isWhitespace)) {
            throw new AiKeyInvalidException("An API key can't contain spaces — check the paste.");
        }

        UserAiKey stored = repository.findById(userId).orElseGet(() -> {
            UserAiKey fresh = new UserAiKey();
            fresh.setUserId(userId);
            fresh.setCreatedAt(OffsetDateTime.now(clock));
            return fresh;
        });
        stored.setProvider(provider);
        stored.setKeyCiphertext(cipher.encrypt(key));
        stored.setKeyHint(hint(key));
        stored.setUpdatedAt(OffsetDateTime.now(clock));
        repository.save(stored);

        return new AiKeyStatusResponse(true, true, provider, stored.getKeyHint());
    }

    @Transactional
    public void delete(String userId) {
        repository.deleteById(userId);
    }

    /**
     * The decrypted key, for server-side use on this request only. Callers must not return it,
     * log it, or put it in an error message.
     */
    @Transactional(readOnly = true)
    public Optional<String> resolveKey(String userId) {
        if (!isSupported()) {
            return Optional.empty();
        }
        return repository.findById(userId).map(key -> cipher.decrypt(key.getKeyCiphertext()));
    }

    private static String hint(String key) {
        return key.length() <= HINT_LENGTH ? key : key.substring(key.length() - HINT_LENGTH);
    }
}
