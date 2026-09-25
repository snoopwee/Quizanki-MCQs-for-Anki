package com.ankiquiz.service.ai;

import com.ankiquiz.dto.response.AiKeyStatusResponse;
import com.ankiquiz.entity.UserAiKey;
import com.ankiquiz.exception.AiKeyInvalidException;
import com.ankiquiz.repository.UserAiKeyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiKeyServiceTest {

    private static final String USER = "user-1";
    private static final String KEY = "AIzaSy-not-a-real-key-ab12";

    @Mock private UserAiKeyRepository repository;

    private final AiKeyCipher cipher = new AiKeyCipher(Base64.getEncoder().encodeToString(new byte[32]));
    private final Clock clock = Clock.fixed(Instant.parse("2026-09-21T09:00:00Z"), ZoneOffset.UTC);
    private AiKeyService service;

    @BeforeEach
    void setUp() {
        service = new AiKeyService(repository, cipher, clock);
        when(repository.findById(USER)).thenReturn(Optional.empty());
    }

    @Test
    void storesTheKeyEncrypted_neverInTheClear() {
        service.save(USER, "gemini", KEY);

        ArgumentCaptor<UserAiKey> captor = ArgumentCaptor.forClass(UserAiKey.class);
        verify(repository).save(captor.capture());
        UserAiKey saved = captor.getValue();

        assertThat(saved.getKeyCiphertext()).isNotEqualTo(KEY).doesNotContain(KEY);
        assertThat(cipher.decrypt(saved.getKeyCiphertext())).isEqualTo(KEY);
        assertThat(saved.getUserId()).isEqualTo(USER);
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    void keepsOnlyTheLastFourCharactersForTheUiToRecognise() {
        AiKeyStatusResponse status = service.save(USER, "gemini", KEY);

        assertThat(status.hint()).isEqualTo("ab12");
        assertThat(status.configured()).isTrue();
        // The response type has no field that could carry the key itself.
        assertThat(status.toString()).doesNotContain(KEY);
    }

    @Test
    void statusNeverExposesTheKey() {
        UserAiKey stored = new UserAiKey();
        stored.setUserId(USER);
        stored.setProvider("gemini");
        stored.setKeyCiphertext(cipher.encrypt(KEY));
        stored.setKeyHint("ab12");
        when(repository.findById(USER)).thenReturn(Optional.of(stored));

        AiKeyStatusResponse status = service.status(USER);

        assertThat(status).isEqualTo(new AiKeyStatusResponse(true, true, "gemini", "ab12"));
    }

    @Test
    void anAccountWithNoKeyReportsSoWithoutFailing() {
        assertThat(service.status(USER)).isEqualTo(new AiKeyStatusResponse(true, false, null, null));
        assertThat(service.resolveKey(USER)).isEmpty();
    }

    @Test
    void resolvesTheKeyForServerSideUse() {
        UserAiKey stored = new UserAiKey();
        stored.setKeyCiphertext(cipher.encrypt(KEY));
        when(repository.findById(USER)).thenReturn(Optional.of(stored));

        assertThat(service.resolveKey(USER)).contains(KEY);
    }

    @Test
    void rejectsThingsThatArentKeys() {
        assertThatThrownBy(() -> service.save(USER, "gemini", "short"))
                .isInstanceOf(AiKeyInvalidException.class);
        assertThatThrownBy(() -> service.save(USER, "gemini", "key with spaces in it"))
                .isInstanceOf(AiKeyInvalidException.class);
        assertThatThrownBy(() -> service.save(USER, "gemini", null))
                .isInstanceOf(AiKeyInvalidException.class);
        verify(repository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void withNoEncryptionKeyConfiguredItRefusesToStoreAnything() {
        AiKeyService unsupported = new AiKeyService(repository, new AiKeyCipher(""), clock);

        assertThat(unsupported.isSupported()).isFalse();
        assertThat(unsupported.status(USER)).isEqualTo(new AiKeyStatusResponse(false, false, null, null));
        assertThat(unsupported.resolveKey(USER)).isEmpty();
        assertThatThrownBy(() -> unsupported.save(USER, "gemini", KEY))
                .isInstanceOf(AiKeyInvalidException.class);
        verify(repository, never()).save(org.mockito.ArgumentMatchers.any());
    }
}
