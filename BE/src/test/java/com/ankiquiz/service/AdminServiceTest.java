package com.ankiquiz.service;

import com.ankiquiz.dto.response.AdminStatsResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock private EntityManager entityManager;
    @Mock private Query query;

    @Test
    void getStats_mapsTheAggregateRow_normalisingNumericTypesAndNulls() {
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        // COUNT can come back as Long or BigInteger depending on the driver, and a
        // null (no rows) must read as 0 — cover all three in one row.
        when(query.getSingleResult()).thenReturn(new Object[]{
                42L, BigInteger.valueOf(12), 3800L, 9L, 15L, 5000L, 4L, null,
        });

        AdminService service = new AdminService(entityManager);
        AdminStatsResponse stats = service.getStats();

        assertThat(stats.decks()).isEqualTo(42);
        assertThat(stats.publicDecks()).isEqualTo(12);
        assertThat(stats.notes()).isEqualTo(3800);
        assertThat(stats.creators()).isEqualTo(9);
        assertThat(stats.learners()).isEqualTo(15);
        assertThat(stats.answers()).isEqualTo(5000);
        assertThat(stats.decksLast30Days()).isEqualTo(4);
        assertThat(stats.answersLast7Days()).isZero(); // null → 0
    }
}
