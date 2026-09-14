package com.ankiquiz.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * One injectable clock, so time-dependent logic — the streak's "today" — can be tested
 * against a fixed instant instead of the real wall clock.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
