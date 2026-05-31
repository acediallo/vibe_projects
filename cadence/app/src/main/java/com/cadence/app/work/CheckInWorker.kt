package com.cadence.app.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.cadence.app.di.Graph
import com.cadence.app.notify.CheckInNotifier
import com.cadence.app.repo.TimeUtils
import kotlinx.coroutines.flow.first
import java.util.concurrent.TimeUnit

/**
 * Periodic worker that fires a check-in prompt when the current time is inside the
 * user's active window. WorkManager's minimum period is 15 minutes; longer intervals
 * are approximated by only prompting on runs that fall on the chosen cadence.
 */
class CheckInWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        Graph.init(applicationContext)
        val settings = Graph.settingsStore.settings.first()

        val now = System.currentTimeMillis()
        val hour = TimeUtils.currentHour(now)
        if (hour < settings.activeStartHour || hour >= settings.activeEndHour) {
            return Result.success()
        }

        val categories = Graph.database.categoryDao().getActive().filter { !it.isIdle }
        if (categories.isEmpty()) return Result.success()

        // Order quick actions by most-recently used, falling back to default order.
        val recentIds = Graph.database.checkInDao().recentCategoryIds(3)
        val byId = categories.associateBy { it.id }
        val quick = (recentIds.mapNotNull { byId[it] } + categories).distinct().take(3)

        CheckInNotifier.showCheckIn(applicationContext, quick)
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "cadence_checkin"

        /** (Re)schedules the periodic worker. Period is clamped to WorkManager's 15-min floor. */
        fun schedule(context: Context, intervalMinutes: Int) {
            val period = intervalMinutes.toLong().coerceAtLeast(15)
            val request = PeriodicWorkRequestBuilder<CheckInWorker>(period, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request,
            )
        }
    }
}
