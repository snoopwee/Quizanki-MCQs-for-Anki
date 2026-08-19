package com.ankiquiz.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Turns on Spring's scheduler so {@code @Scheduled} jobs fire — currently just the
 * orphan-media GC sweep ({@code MediaGcScheduler}).
 *
 * <p>Note for Render's free tier: the instance is stopped when idle, and a stopped
 * process can't fire a timer, so the schedule is only reliable while the app is kept
 * awake (e.g. an UptimeRobot ping). If you don't keep it warm, drive GC from an
 * external cron hitting {@code POST /api/v1/admin/media/gc} instead — that request
 * wakes the instance itself.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
