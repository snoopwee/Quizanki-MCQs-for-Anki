package com.ankiquiz.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final String supabaseUrl;
    private final List<String> allowedOrigins;
    private final AdminAccess adminAccess;

    public SecurityConfig(
            @Value("${supabase.url}") String supabaseUrl,
            @Value("${app.cors.allowed-origins}") List<String> allowedOrigins,
            AdminAccess adminAccess
    ) {
        this.supabaseUrl = supabaseUrl;
        this.allowedOrigins = allowedOrigins;
        this.adminAccess = adminAccess;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(
                                "/actuator/health",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                // Public, unauthenticated reads:
                                //  * /public/parse-apkg  — guest try-before-signup; stateless
                                //    (persists nothing), per-IP rate limited.
                                //  * /public/shared/{id} — a deck its owner has shared; the
                                //    service 404s anything not currently shared.
                                "/api/v1/public/**"
                        ).permitAll()
                        // Admin-only surface. ROLE_ADMIN is granted below only to
                        // subjects on the app.admin.user-ids allowlist, so everyone
                        // else gets 403 here — the backend is the real gate; the
                        // frontend /admin guard is only UX.
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt
                        .decoder(jwtDecoder())
                        .jwtAuthenticationConverter(adminAwareConverter())))
                .build();
    }

    /**
     * Turns a validated Supabase JWT into an authentication, adding ROLE_ADMIN when
     * the subject is on the allowlist. Regular users carry no extra authority, so
     * only the admin matcher above is affected.
     */
    private Converter<Jwt, AbstractAuthenticationToken> adminAwareConverter() {
        return jwt -> new JwtAuthenticationToken(
                jwt, adminAccess.authoritiesFor(jwt.getSubject(), jwt.getClaimAsString("email")));
    }

    /**
     * Validates Supabase JWTs against the project's public JWKS endpoint.
     * Supabase signs access tokens with ES256 (EC P-256) under the current
     * API-key system, so the decoder is pinned to that algorithm. The issuer
     * check rejects tokens minted by any other Supabase project.
     */
    @Bean
    public JwtDecoder jwtDecoder() {
        String jwksUri = supabaseUrl + "/auth/v1/.well-known/jwks.json";
        String issuer = supabaseUrl + "/auth/v1";
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwksUri)
                .jwsAlgorithm(SignatureAlgorithm.ES256)
                .build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuer));
        return decoder;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
