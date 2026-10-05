package com.ankiquiz.config;

import com.ankiquiz.exception.PayloadTooLargeException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * A byte ceiling on non-multipart request bodies.
 *
 * <p><b>Why this exists.</b> {@code DeckService.replaceDeckContents} refuses more than
 * {@code MAX_NOTES} (5,000) cards — but only after Jackson has already read the entire body and
 * built every {@code NoteEntry} in it. The count is checked on an object graph that is already on
 * the heap, which makes it a business rule, not a defence. Nothing capped the bytes: Tomcat's
 * {@code maxPostSize} governs {@code application/x-www-form-urlencoded} only, and Spring Boot has
 * no equivalent for {@code application/json}.
 *
 * <p>{@code MAX_NOTES}' own comment assumes "each parsed note is ~1–3 KB of JSON", which is what
 * makes 5,000 safe on a free-tier heap. That assumption is the thing an attacker breaks: 5,000
 * notes is a count, and a note's {@code fields} map had no length bound, so a single "valid" deck
 * could be arbitrarily many megabytes. On a 512 MB SerialGC instance one request is enough.
 *
 * <p><b>Multipart is skipped deliberately.</b> Those routes — {@code .apkg} upload and audio
 * import — are already bounded by {@code spring.servlet.multipart.max-file-size} (50 MB) and
 * {@code max-request-size} (55 MB), and the parser adds its own decompression and time budgets.
 * Applying this limit to them would break a legitimate 20 MB deck file.
 *
 * <p><b>Both paths are closed.</b> A declared {@code Content-Length} over the cap is refused
 * without reading a byte. A request that omits it (chunked transfer encoding — which is exactly
 * what somebody would use to get past a header-only check) gets its stream wrapped and counted, and
 * fails the moment it crosses the cap rather than at the end.
 */
public class RequestSizeLimitFilter extends OncePerRequestFilter {

    /**
     * Ceiling on a JSON body, in bytes.
     *
     * <p>Sized from the largest legitimate save. The biggest deck the app accepts is 5,000 notes;
     * at the ~1–3 KB per note {@code MAX_NOTES} is reasoned against, plus media URLs, a full deck
     * commit is around 5 MB. 10 MB leaves roughly double that headroom while staying far below
     * what would threaten the instance's heap. The editor sends media as URLs, never as inlined
     * bytes (the URL fields are {@code @Size(max = 2000)}), so image and audio data never counts
     * toward this.
     */
    static final long MAX_BODY_BYTES = 10L * 1024 * 1024;

    private static final String MESSAGE =
            "That request is too large (limit: 10 MB). If this is one deck, split it into smaller decks.";

    /** Spring's configured mapper, so the refusal body is serialised the same way every other one is. */
    private final ObjectMapper json;

    public RequestSizeLimitFilter(ObjectMapper json) {
        this.json = json;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        // Declared length over the cap: refuse before reading a byte.
        //
        // Written here rather than thrown, because a filter runs OUTSIDE DispatcherServlet — an
        // exception escaping this method never reaches @RestControllerAdvice and would surface as
        // a container 500 instead of this 413. The stream path below is different: it throws from
        // inside Jackson's read, which IS within the dispatch, so the global handler sees it.
        if (request.getContentLengthLong() > MAX_BODY_BYTES) {
            refuse(response);
            return;
        }
        // Length absent or understated — count the bytes as they arrive.
        chain.doFilter(new CountingRequest(request), response);
    }

    /** The same body shape {@code GlobalExceptionHandler.error} produces, so clients see one format. */
    private void refuse(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.PAYLOAD_TOO_LARGE.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now().toString());
        body.put("status", HttpStatus.PAYLOAD_TOO_LARGE.value());
        body.put("error", HttpStatus.PAYLOAD_TOO_LARGE.getReasonPhrase());
        body.put("message", MESSAGE);
        json.writeValue(response.getOutputStream(), body);
    }

    /**
     * Only bodies we parse ourselves. Multipart has its own limits (see the class comment); a
     * request with no body has nothing to measure.
     */
    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String type = request.getContentType();
        if (type != null && type.toLowerCase(Locale.ROOT).startsWith("multipart/")) {
            return true;
        }
        // 0 = explicitly empty. -1 = unknown, which includes chunked, so that must NOT be skipped.
        return request.getContentLengthLong() == 0;
    }

    /** Hands out a stream that refuses to yield more than the cap. */
    private static final class CountingRequest extends HttpServletRequestWrapper {

        private CountingRequest(HttpServletRequest request) {
            super(request);
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            return new CountingStream(super.getInputStream());
        }
    }

    /**
     * Counts what it hands out and throws once the total passes the cap.
     *
     * <p>{@link PayloadTooLargeException} is unchecked on purpose: thrown from inside Jackson's
     * read it would be wrapped by an {@code IOException}, and the handler for that reports a
     * generic malformed-body error. The global handler unwraps for this reason.
     */
    private static final class CountingStream extends ServletInputStream {

        private final ServletInputStream delegate;
        private long seen;

        private CountingStream(ServletInputStream delegate) {
            this.delegate = delegate;
        }

        private void count(int bytes) {
            if (bytes <= 0) {
                return;
            }
            seen += bytes;
            if (seen > MAX_BODY_BYTES) {
                throw new PayloadTooLargeException(MESSAGE);
            }
        }

        @Override
        public int read() throws IOException {
            int b = delegate.read();
            count(b == -1 ? 0 : 1);
            return b;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            int read = delegate.read(buffer, offset, length);
            count(read);
            return read;
        }

        @Override
        public int read(byte[] buffer) throws IOException {
            int read = delegate.read(buffer);
            count(read);
            return read;
        }

        @Override
        public boolean isFinished() {
            return delegate.isFinished();
        }

        @Override
        public boolean isReady() {
            return delegate.isReady();
        }

        @Override
        public void setReadListener(ReadListener listener) {
            delegate.setReadListener(listener);
        }

        @Override
        public int available() throws IOException {
            return delegate.available();
        }

        @Override
        public void close() throws IOException {
            delegate.close();
        }

        /** The delegate is a {@link InputStream}; keep its skip/mark semantics rather than the default. */
        @Override
        public long skip(long n) throws IOException {
            long skipped = delegate.skip(n);
            count((int) Math.min(skipped, Integer.MAX_VALUE));
            return skipped;
        }
    }
}
