package com.cadence.app.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * A user-defined bucket of time, e.g. "PMP study", "Project X", or the built-in
 * "Idle / Unaccounted" category. [dailyGoalMinutes] of 0 means no goal is set.
 */
@Entity(tableName = "categories")
data class Category(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val colorHex: String,
    val dailyGoalMinutes: Int = 0,
    val isIdle: Boolean = false,
    val sortOrder: Int = 0,
    val archived: Boolean = false,
)

/**
 * A single logged moment. Created when the user answers a check-in prompt or adds
 * a manual entry. [coveredMinutes] is roughly the slice of time this entry accounts
 * for (defaults to the current check-in interval).
 */
@Entity(
    tableName = "checkins",
    indices = [Index("timestampMillis"), Index("categoryId")],
)
data class CheckIn(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timestampMillis: Long,
    val categoryId: Long,
    val note: String? = null,
    val coveredMinutes: Int = 60,
    val source: String = SOURCE_PROMPT,
) {
    companion object {
        const val SOURCE_PROMPT = "prompt"
        const val SOURCE_MANUAL = "manual"
    }
}
