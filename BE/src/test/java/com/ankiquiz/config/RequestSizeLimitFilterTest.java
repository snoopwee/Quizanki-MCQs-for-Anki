package com.ankiquiz.config;

import com.ankiquiz.exception.PayloadTooLargeException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The byte ceiling on a JSON request body.
 *
 * <p>Both refusal paths matter and they work differently — a declared {@code Content-Length} is
 * refused by the filter itself (it must WRITE the 413, because a filter runs outside
 * DispatcherServlet and a thrown exception would never reach the handler), while a body whose
 * length is unknown or understated is caught inside the stream.
 */
class RequestSizeLimitFilterTest {

    private final RequestSizeLimitFilter filter = new RequestSizeLimitFilter(new ObjectMapper());

    private static MockHttpServletRequest jsonRequest(int bytes) {
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/v1/decks/x/contents");
        request.setContentType("application/json");
        request.setContent(new byte[bytes]);
        return request;
    }

    /** A body whose size the request does not declare — i.e. chunked transfer encoding. */
    private static MockHttpServletRequest undeclaredLength() {
        return new MockHttpServletRequest("PUT", "/api/v1/decks/x/contents") {
            @Override
            public long getContentLengthLong() {
                return -1;
            }

            @Override
            public int getContentLength() {
                return -1;
            }
        };
    }

    @Test
    void aBodyUnderTheCapIsPassedThrough() throws Exception {
        MockHttpServletRequest request = jsonRequest(1_024);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void aDeclaredLengthOverTheCapIsRefusedWithoutReachingTheChain() throws Exception {
        // Declared, not actually allocated — the point is that no body is read.
        MockHttpServletRequest oversized = new MockHttpServletRequest("PUT", "/api/v1/decks/x/contents") {
            @Override
            public long getContentLengthLong() {
                return RequestSizeLimitFilter.MAX_BODY_BYTES + 1;
            }
        };
        oversized.setContentType("application/json");
        MockHttpServletResponse response = new MockHttpServletResponse();
        RecordingChain chain = new RecordingChain();

        filter.doFilter(oversized, response, chain);

        assertThat(chain.called).isFalse();
        assertThat(response.getStatus()).isEqualTo(413);
        assertThat(response.getContentType()).contains("application/json");
        assertThat(response.getContentAsString())
                .contains("\"status\":413")
                .contains("too large");
    }

    @Test
    void anUndeclaredBodyIsRefusedFromInsideTheStreamOnceItCrossesTheCap() throws Exception {
        // This is the path a header-only check would miss entirely.
        MockHttpServletRequest request = undeclaredLength();
        request.setContentType("application/json");
        request.setContent(new byte[(int) RequestSizeLimitFilter.MAX_BODY_BYTES + 64]);
        MockHttpServletResponse response = new MockHttpServletResponse();

        // The chain stands in for Jackson: it reads the body, and the read is what fails.
        FilterChain readingChain = (req, res) -> req.getInputStream().readAllBytes();

        assertThatThrownBy(() -> filter.doFilter(request, response, readingChain))
                .isInstanceOf(PayloadTooLargeException.class)
                .hasMessageContaining("too large");
    }

    @Test
    void anUndeclaredBodyUnderTheCapReadsNormally() throws Exception {
        MockHttpServletRequest request = undeclaredLength();
        request.setContentType("application/json");
        request.setContent("{\"name\":\"a deck\"}".getBytes());
        MockHttpServletResponse response = new MockHttpServletResponse();

        byte[][] seen = new byte[1][];
        FilterChain readingChain = (req, res) -> seen[0] = req.getInputStream().readAllBytes();

        assertThatCode(() -> filter.doFilter(request, response, readingChain)).doesNotThrowAnyException();
        assertThat(new String(seen[0])).isEqualTo("{\"name\":\"a deck\"}");
    }

    @Test
    void multipartIsLeftAloneSoALegitimateApkgUploadStillWorks() throws Exception {
        // .apkg and audio import are bounded by spring.servlet.multipart.* (50/55 MB) and by the
        // parser's own budgets. Applying a 10 MB JSON cap to them would break a real deck file.
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/decks/parse");
        request.setContentType("multipart/form-data; boundary=----abc");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThat(filter.shouldNotFilter(request)).isTrue();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void multipartDetectionIsNotCaseSensitive() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/decks/parse");
        request.setContentType("Multipart/Form-Data; boundary=----abc");

        assertThat(filter.shouldNotFilter(request)).isTrue();
    }

    @Test
    void aRequestWithNoBodyIsNotWorthWrapping() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/decks");
        request.setContent(new byte[0]);

        assertThat(filter.shouldNotFilter(request)).isTrue();
    }

    private static final class RecordingChain implements FilterChain {
        private boolean called;

        @Override
        public void doFilter(jakarta.servlet.ServletRequest request, jakarta.servlet.ServletResponse response)
                throws IOException {
            called = true;
        }
    }
}
