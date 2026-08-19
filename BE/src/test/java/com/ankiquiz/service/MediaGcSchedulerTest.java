package com.ankiquiz.service;

import com.ankiquiz.dto.response.MediaGcResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MediaGcSchedulerTest {

    @Mock
    MediaGcService gc;

    @Test
    void sweep_whenEnabled_runsTheGc() {
        when(gc.collect(null)).thenReturn(new MediaGcResult(2, 300, 0));
        new MediaGcScheduler(gc, true).sweep();
        verify(gc).collect(null);
    }

    @Test
    void sweep_whenDisabled_doesNothing() {
        new MediaGcScheduler(gc, false).sweep();
        verifyNoInteractions(gc); // dormant until the flag is flipped on
    }

    @Test
    void sweep_swallowsFailures_soTheTimerSurvives() {
        when(gc.collect(null)).thenThrow(new RuntimeException("storage down"));
        assertDoesNotThrow(() -> new MediaGcScheduler(gc, true).sweep());
    }
}
