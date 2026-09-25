package com.ankiquiz.service.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Encrypts a user's own provider API key before it touches the database.
 *
 * AES-256-GCM, a fresh 12-byte IV per encryption, stored as base64(iv || ciphertext+tag). GCM is
 * authenticated, so a tampered or truncated ciphertext fails to decrypt rather than returning
 * rubbish that we would then send to a provider as someone's key.
 *
 * The master key lives only in the environment ({@code AI_KEY_ENCRYPTION_KEY}, base64 of 32 random
 * bytes), never in the repo or the database — so a database dump alone yields no usable keys.
 * Unconfigured, {@link #isConfigured()} is false and bring-your-own-key is simply switched off;
 * callers must check rather than let an exception escape to a user.
 */
@Component
public class AiKeyCipher {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final int KEY_BYTES = 32;

    private final SecretKeySpec masterKey;
    private final SecureRandom random = new SecureRandom();

    public AiKeyCipher(@Value("${ai.key-encryption-key:}") String encodedKey) {
        this.masterKey = parse(encodedKey);
    }

    private static SecretKeySpec parse(String encodedKey) {
        if (encodedKey == null || encodedKey.isBlank()) {
            return null;
        }
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(encodedKey.trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("ai.key-encryption-key must be base64", ex);
        }
        if (raw.length != KEY_BYTES) {
            throw new IllegalStateException(
                    "ai.key-encryption-key must decode to " + KEY_BYTES + " bytes, got " + raw.length);
        }
        return new SecretKeySpec(raw, "AES");
    }

    /** False when no master key is configured — bring-your-own-key stays off rather than failing. */
    public boolean isConfigured() {
        return masterKey != null;
    }

    public String encrypt(String plaintext) {
        requireConfigured();
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, masterKey, new GCMParameterSpec(TAG_BITS, iv));
            byte[] sealed = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            byte[] out = new byte[iv.length + sealed.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(sealed, 0, out, iv.length, sealed.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (Exception ex) {
            // Never include the plaintext (it is somebody's API key) in the message.
            throw new IllegalStateException("Could not encrypt the stored API key", ex);
        }
    }

    public String decrypt(String stored) {
        requireConfigured();
        try {
            byte[] raw = Base64.getDecoder().decode(stored);
            if (raw.length <= IV_BYTES) {
                throw new IllegalArgumentException("ciphertext too short");
            }
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, masterKey,
                    new GCMParameterSpec(TAG_BITS, raw, 0, IV_BYTES));
            byte[] plain = cipher.doFinal(raw, IV_BYTES, raw.length - IV_BYTES);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not decrypt the stored API key", ex);
        }
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw new IllegalStateException("ai.key-encryption-key is not configured");
        }
    }
}
