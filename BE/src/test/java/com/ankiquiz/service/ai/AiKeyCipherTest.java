package com.ankiquiz.service.ai;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The cipher that stands between a user's API key and the database. The properties that matter:
 * a dump must not reveal the key, tampering must fail loudly rather than yield a wrong key, and
 * an unconfigured server must switch the feature off instead of storing anything in the clear.
 */
class AiKeyCipherTest {

    private static final String MASTER_KEY = Base64.getEncoder().encodeToString(new byte[32]);
    private final AiKeyCipher cipher = new AiKeyCipher(MASTER_KEY);

    @Test
    void encryptsAndDecryptsBackToTheSameKey() {
        String key = "AIzaSy-not-a-real-key-000";

        String sealed = cipher.encrypt(key);

        assertThat(sealed).doesNotContain(key);
        assertThat(cipher.decrypt(sealed)).isEqualTo(key);
    }

    @Test
    void theSamePlaintextEncryptsDifferentlyEveryTime() {
        // A fresh IV per encryption: two users with the same key must not produce equal rows.
        assertThat(cipher.encrypt("same-key-value")).isNotEqualTo(cipher.encrypt("same-key-value"));
    }

    @Test
    void refusesToDecryptSomethingThatWasTamperedWith() {
        byte[] sealed = Base64.getDecoder().decode(cipher.encrypt("AIzaSy-not-a-real-key-000"));
        sealed[sealed.length - 1] ^= 0x01; // flip one bit of the GCM tag
        String tampered = Base64.getEncoder().encodeToString(sealed);

        assertThatThrownBy(() -> cipher.decrypt(tampered))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("decrypt");
    }

    @Test
    void refusesGarbageCiphertext() {
        assertThatThrownBy(() -> cipher.decrypt("not-base64-at-all!!"))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> cipher.decrypt(Base64.getEncoder().encodeToString(new byte[4])))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void withNoMasterKeyTheFeatureIsOff_notInsecure() {
        AiKeyCipher unconfigured = new AiKeyCipher("");

        assertThat(unconfigured.isConfigured()).isFalse();
        // It must never quietly fall back to storing the key as-is.
        assertThatThrownBy(() -> unconfigured.encrypt("some-key"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not configured");
    }

    @Test
    void rejectsAMasterKeyOfTheWrongShapeAtStartup() {
        assertThatThrownBy(() -> new AiKeyCipher("short"))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new AiKeyCipher(Base64.getEncoder().encodeToString(new byte[16])))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32 bytes");
    }
}
