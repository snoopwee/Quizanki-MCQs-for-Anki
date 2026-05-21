package com.ankiquiz.repository;

import com.ankiquiz.entity.CardStats;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface CardStatsRepository extends JpaRepository<CardStats, UUID> {
}
