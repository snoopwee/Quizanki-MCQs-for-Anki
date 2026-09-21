package com.ankiquiz.service.ai;

import com.ankiquiz.exception.AiKeyInvalidException;
import com.ankiquiz.exception.AiUnavailableException;
import com.ankiquiz.exception.RateLimitExceededException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Google Gemini, via the {@code generateContent} REST endpoint.
 *
 * Chosen over Groq because it reads PDFs natively — Groq's free models are text-only, which would
 * cost us an extraction pipeline for the format students actually have.
 *
 * ⚠ Two things to know before switching this on:
 * <ul>
 *   <li>The free tier's quota is per ACCOUNT, so the shared key is a shared pool — see
 *       {@link AiQuotaService}.</li>
 *   <li>Google states free-tier prompts and responses may be used to improve their products, with
 *       human review. Users upload their own notes here, so the UI must say so at the point of
 *       upload (Phase 9 S4).</li>
 * </ul>
 *
 * The key travels in the {@code x-goog-api-key} header rather than the {@code ?key=} query
 * parameter the docs show first: query strings end up in access logs and error messages, and this
 * key may belong to the user.
 */
@Service
public class GeminiProvider implements AiProvider {

    private static final Logger log = LoggerFactory.getLogger(GeminiProvider.class);
    private static final String NAME = "gemini";

    private final RestClient http;
    private final ObjectMapper mapper;
    private final String model;

    public GeminiProvider(
            RestClient.Builder builder,
            ObjectMapper mapper,
            @Value("${ai.gemini.base-url:https://generativelanguage.googleapis.com}") String baseUrl,
            @Value("${ai.model:gemini-2.5-flash}") String model
    ) {
        this.http = builder.baseUrl(baseUrl).build();
        this.mapper = mapper;
        this.model = model;
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public String model() {
        return model;
    }

    @Override
    public AiCompletion complete(AiPrompt prompt, String apiKey) {
        String body;
        try {
            body = http.post()
                    .uri("/v1beta/models/{model}:generateContent", model)
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody(prompt))
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException ex) {
            throw translate(ex);
        } catch (Exception ex) {
            // Connection reset, DNS, timeout: upstream is simply not answering.
            throw new AiUnavailableException("The AI provider didn't respond. Try again shortly.", ex);
        }
        return parse(body);
    }

    private Map<String, Object> requestBody(AiPrompt prompt) {
        Map<String, Object> generationConfig = new HashMap<>();
        generationConfig.put("maxOutputTokens", prompt.maxOutputTokens());
        // Low temperature: we want faithful cards from the source, not invention.
        generationConfig.put("temperature", 0.2);
        if (prompt.jsonOutput()) {
            generationConfig.put("responseMimeType", "application/json");
        }

        Map<String, Object> body = new HashMap<>();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", prompt.systemInstruction()))));
        body.put("contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", prompt.userText())))));
        body.put("generationConfig", generationConfig);
        return body;
    }

    private AiCompletion parse(String body) {
        if (body == null || body.isBlank()) {
            throw new AiUnavailableException("The AI provider returned an empty response.");
        }
        try {
            JsonNode root = mapper.readTree(body);
            JsonNode candidate = root.path("candidates").path(0);
            String text = candidate.path("content").path("parts").path(0).path("text").asText("");
            if (text.isBlank()) {
                // A safety block or a truncated answer lands here; the reason is diagnostic only.
                String reason = candidate.path("finishReason").asText(
                        root.path("promptFeedback").path("blockReason").asText("no content"));
                log.warn("Gemini returned no text (finishReason={})", reason);
                throw new AiUnavailableException("The AI didn't return anything usable for that input.");
            }
            JsonNode usage = root.path("usageMetadata");
            return new AiCompletion(text, intOrNull(usage, "promptTokenCount"), intOrNull(usage, "candidatesTokenCount"));
        } catch (AiUnavailableException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new AiUnavailableException("Couldn't read the AI provider's response.", ex);
        }
    }

    private static Integer intOrNull(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.asInt() : null;
    }

    /**
     * Maps provider HTTP failures onto our own types. The provider's message is never passed
     * through verbatim — it can echo request content back at the user.
     */
    private RuntimeException translate(RestClientResponseException ex) {
        int status = ex.getStatusCode().value();
        String payload = ex.getResponseBodyAsString();
        boolean looksLikeKeyProblem = payload.contains("API_KEY_INVALID")
                || payload.contains("API key not valid")
                || payload.contains("PERMISSION_DENIED");

        if (status == 429) {
            return new RateLimitExceededException(
                    "The AI provider is rate-limiting us right now. Try again in a few minutes.");
        }
        if ((status == 400 || status == 401 || status == 403) && looksLikeKeyProblem) {
            return new AiKeyInvalidException("The AI provider rejected that API key.");
        }
        if (status == 400) {
            return new AiUnavailableException("The AI provider rejected that request.");
        }
        log.warn("Gemini call failed with status {}", status);
        return new AiUnavailableException("The AI provider is having trouble. Try again shortly.");
    }
}
