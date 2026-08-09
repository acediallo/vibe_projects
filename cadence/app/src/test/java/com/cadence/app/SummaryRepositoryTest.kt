package com.cadence.app

import com.cadence.app.data.Category
import com.cadence.app.data.CheckIn
import com.cadence.app.repo.SummaryRepository
import com.cadence.app.repo.TimeUtils
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SummaryRepositoryTest {

    private val cats = listOf(
        Category(id = 1, name = "Deep Work", colorHex = "#000", dailyGoalMinutes = 120, sortOrder = 0),
        Category(id = 2, name = "Idle", colorHex = "#999", isIdle = true, sortOrder = 99),
    )

    @Test
    fun aggregatesLoggedMinutesPerCategory() {
        val dayStart = TimeUtils.startOfDay(System.currentTimeMillis())
        val checkIns = listOf(
            CheckIn(id = 1, timestampMillis = dayStart + TimeUtils.HOUR_MILLIS, categoryId = 1, coveredMinutes = 60),
            CheckIn(id = 2, timestampMillis = dayStart + 2 * TimeUtils.HOUR_MILLIS, categoryId = 1, coveredMinutes = 30),
        )
        val summary = SummaryRepository.buildDaySummary(
            nowMillis = System.currentTimeMillis(),
            activeStartHour = 0,
            activeEndHour = 24,
            categories = cats,
            checkIns = checkIns,
            baselineEvents = emptyList(),
        )
        val deepWork = summary.categories.first { it.category.id == 1L }
        assertEquals(90, deepWork.loggedMinutes)
        assertEquals(90, summary.totalLoggedMinutes)
    }

    @Test
    fun elapsedActiveMinutesNeverNegative() {
        // now is before the active window starts → 0 elapsed.
        val now = TimeUtils.startOfDay(System.currentTimeMillis()) + 3 * TimeUtils.HOUR_MILLIS
        val elapsed = SummaryRepository.elapsedActiveMinutes(now, activeStartHour = 8, activeEndHour = 22)
        assertEquals(0, elapsed)
    }

    @Test
    fun goalProgressIsClampedAndNullWithoutGoal() {
        val withGoal = SummaryRepository.buildDaySummary(
            nowMillis = System.currentTimeMillis(),
            activeStartHour = 0,
            activeEndHour = 24,
            categories = cats,
            checkIns = listOf(
                CheckIn(id = 1, timestampMillis = 0, categoryId = 1, coveredMinutes = 300),
            ),
            baselineEvents = emptyList(),
        )
        val deepWork = withGoal.categories.first { it.category.id == 1L }
        assertEquals(1f, deepWork.goalProgress!!, 0.0001f)
        val idle = withGoal.categories.first { it.category.id == 2L }
        assertNull(idle.goalProgress)
    }
}
