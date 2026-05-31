package com.cadence.app.repo

import com.cadence.app.calendar.CalendarEvent
import com.cadence.app.data.Category
import com.cadence.app.data.CheckIn

data class CategorySummary(
    val category: Category,
    val loggedMinutes: Int,
) {
    val goalMinutes: Int get() = category.dailyGoalMinutes
    /** 0f..1f progress toward the daily goal, or null when no goal is set. */
    val goalProgress: Float?
        get() = if (goalMinutes > 0) (loggedMinutes.toFloat() / goalMinutes).coerceIn(0f, 1f) else null
}

data class DaySummary(
    val categories: List<CategorySummary>,
    val totalLoggedMinutes: Int,
    val elapsedActiveMinutes: Int,
    val unaccountedMinutes: Int,
    val baselineEvents: List<CalendarEvent>,
    val checkIns: List<CheckIn>,
)

/**
 * Pure aggregation of a single day's data. Kept free of Android/IO dependencies so it
 * is straightforward to unit test.
 */
object SummaryRepository {

    fun buildDaySummary(
        nowMillis: Long,
        activeStartHour: Int,
        activeEndHour: Int,
        categories: List<Category>,
        checkIns: List<CheckIn>,
        baselineEvents: List<CalendarEvent>,
    ): DaySummary {
        val loggedByCategory = checkIns.groupBy { it.categoryId }
            .mapValues { (_, list) -> list.sumOf { it.coveredMinutes } }

        val summaries = categories
            .map { CategorySummary(it, loggedByCategory[it.id] ?: 0) }
            .sortedWith(compareBy({ it.category.sortOrder }, { it.category.id }))

        val totalLogged = checkIns.sumOf { it.coveredMinutes }
        val elapsedActive = elapsedActiveMinutes(nowMillis, activeStartHour, activeEndHour)
        val unaccounted = (elapsedActive - totalLogged).coerceAtLeast(0)

        return DaySummary(
            categories = summaries,
            totalLoggedMinutes = totalLogged,
            elapsedActiveMinutes = elapsedActive,
            unaccountedMinutes = unaccounted,
            baselineEvents = baselineEvents.sortedBy { it.startMillis },
            checkIns = checkIns.sortedByDescending { it.timestampMillis },
        )
    }

    /** Minutes elapsed in today's active window up to now (clamped to the window). */
    fun elapsedActiveMinutes(nowMillis: Long, activeStartHour: Int, activeEndHour: Int): Int {
        val windowStart = TimeUtils.hourOfDay(nowMillis, activeStartHour)
        val windowEnd = TimeUtils.hourOfDay(nowMillis, activeEndHour)
        val clampedNow = nowMillis.coerceIn(windowStart, windowEnd)
        return ((clampedNow - windowStart) / TimeUtils.MINUTE_MILLIS).toInt().coerceAtLeast(0)
    }
}
