package com.ankiquiz.service.ai;

import com.ankiquiz.exception.AiKeyInvalidException;
import com.ankiquiz.exception.AiUnavailableException;
import com.ankiquiz.exception.RateLimitExceededException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * The provider call, against canned responses — no network, so this runs in CI.
 *
 * What's worth pinning: the key travels in a header (not a logged query string), a provider
 * failure becomes one of OUR typed errors rather than leaking upstream detail, and an answer with
 * no usable text is a failure rather than an empty deck.
 */
class GeminiProviderTest {

    private static final String BASE = "https://gemini.test";
    private static final String MODEL = "gemini-2.5-flash";
    private static final String URL = BASE + "/v1beta/models/" + MODEL + ":generateContent";
    private static final String KEY = "a-user-api-key";

    private MockRestServiceServer server;
    private GeminiProvider provider;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        provider = new GeminiProvider(builder, new ObjectMapper(), BASE, MODEL);
    }

    private AiPrompt prompt() {
        return new AiPrompt("Make flashcards.", "犬 = dog", 2048, true);
    }

    @Test
    void sendsTheKeyAsAHeader_notInTheUrl() {
        server.expect(requestTo(URL))
                .andExpect(method(org.springframework.http.HttpMethod.POST))
                .andExpect(header("x-goog-api-key", KEY))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("犬 = dog")))
                .andRespond(withSuccess("""
                        {"candidates":[{"content":{"parts":[{"text":"[{\\"term\\":\\"犬\\"}]"}]}}],
                         "usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":34}}
                        """, MediaType.APPLICATION_JSON));

        AiCompletion completion = provider.complete(prompt(), KEY);

        assertThat(completion.text()).contains("term");
        assertThat(completion.inputTokens()).isEqualTo(12);
        assertThat(completion.outputTokens()).isEqualTo(34);
        server.verify();
    }

    @Test
    void reportsTheModelAndProviderItLogsUnder() {
        assertThat(provider.name()).isEqualTo("gemini");
        assertThat(provider.model()).isEqualTo(MODEL);
    }

    @Test
    void missingTokenCountsAreNotFatal() {
        server.expect(requestTo(URL)).andRespond(withSuccess(
                """
                {"candidates":[{"content":{"parts":[{"text":"cards"}]}}]}
                """, MediaType.APPLICATION_JSON));

        AiCompletion completion = provider.complete(prompt(), KEY);

        assertThat(completion.text()).isEqualTo("cards");
        assertThat(completion.inputTokens()).isNull();
        assertThat(completion.outputTokens()).isNull();
    }

    @Test
    void aRejectedKeyIsItsOwnError_soSettingsCanSayWhichThingIsWrong() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                      {"error":{"code":400,"status":"INVALID_ARGUMENT","message":"API key not valid"}}
                      """));

        assertThatThrownBy(() -> provider.complete(prompt(), KEY))
                .isInstanceOf(AiKeyInvalidException.class)
                .hasMessageContaining("rejected that API key")
                // The upstream message must not be echoed verbatim.
                .hasMessageNotContaining("INVALID_ARGUMENT");
    }

    @Test
    void providerRateLimitingBecomesOurRateLimitError() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                      {"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}
                      """));

        assertThatThrownBy(() -> provider.complete(prompt(), KEY))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void anUpstreamOutageIsUnavailable_notAConfusingSuccess() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{}"));

        assertThatThrownBy(() -> provider.complete(prompt(), KEY))
                .isInstanceOf(AiUnavailableException.class);
    }

    @Test
    void anAnswerWithNoTextIsAFailure_notAnEmptyDeck() {
        // What a safety block looks like: a candidate with a finishReason and no parts.
        server.expect(requestTo(URL)).andRespond(withSuccess("""
                {"candidates":[{"finishReason":"SAFETY"}]}
                """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> provider.complete(prompt(), KEY))
                .isInstanceOf(AiUnavailableException.class)
                .hasMessageContaining("didn't return anything usable");
    }

    @Test
    void unreadableJsonIsAFailure() {
        server.expect(requestTo(URL))
                .andRespond(withSuccess("not json at all", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> provider.complete(prompt(), KEY))
                .isInstanceOf(AiUnavailableException.class);
    }
}
