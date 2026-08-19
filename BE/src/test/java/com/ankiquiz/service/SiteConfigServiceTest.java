package com.ankiquiz.service;

import com.ankiquiz.dto.request.UpdateSiteConfigRequest;
import com.ankiquiz.dto.response.SiteConfigResponse;
import com.ankiquiz.entity.SiteConfig;
import com.ankiquiz.repository.SiteConfigRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SiteConfigServiceTest {

    @Mock private SiteConfigRepository repository;

    private SiteConfig existing() {
        SiteConfig c = new SiteConfig();
        c.setId(1);
        c.setMaintenanceMode(false);
        return c;
    }

    @Test
    void getConfig_readsTheSingletonRow() {
        SiteConfig c = existing();
        c.setMaintenanceMode(true);
        c.setAnnouncement("Heads up");
        when(repository.findById(1)).thenReturn(Optional.of(c));

        SiteConfigResponse res = new SiteConfigService(repository).getConfig();

        assertThat(res.maintenanceMode()).isTrue();
        assertThat(res.announcement()).isEqualTo("Heads up");
    }

    @Test
    void updateConfig_setsFields_andTrimsBlankMessagesToNull() {
        when(repository.findById(1)).thenReturn(Optional.of(existing()));
        when(repository.save(any(SiteConfig.class))).thenAnswer(i -> i.getArgument(0));

        SiteConfigResponse res = new SiteConfigService(repository).updateConfig(
                new UpdateSiteConfigRequest(true, "  Back at 5pm  ", "   "));

        assertThat(res.maintenanceMode()).isTrue();
        assertThat(res.maintenanceMessage()).isEqualTo("Back at 5pm"); // trimmed
        assertThat(res.announcement()).isNull();                        // blank → null
    }

    @Test
    void loadOrDefault_createsTheRow_whenItSomehowMissing() {
        when(repository.findById(1)).thenReturn(Optional.empty());
        when(repository.save(any(SiteConfig.class))).thenAnswer(i -> i.getArgument(0));

        SiteConfigResponse res = new SiteConfigService(repository).getConfig();

        assertThat(res.maintenanceMode()).isFalse();
    }
}
