package com.cadence.app.notify

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.cadence.app.data.CheckIn
import com.cadence.app.di.Graph
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * Handles a tap on a category quick-action in the check-in notification: logs a
 * [CheckIn] for that category and dismisses the notification.
 */
class CheckInActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val categoryId = intent.getLongExtra(EXTRA_CATEGORY_ID, -1L)
        if (categoryId <= 0) return
        Graph.init(context)

        val pending = goAsync()
        Graph.applicationScope.launch(Dispatchers.IO) {
            try {
                val settings = Graph.settingsStore.settings.first()
                Graph.database.checkInDao().insert(
                    CheckIn(
                        timestampMillis = System.currentTimeMillis(),
                        categoryId = categoryId,
                        coveredMinutes = settings.checkInIntervalMinutes,
                        source = CheckIn.SOURCE_PROMPT,
                    ),
                )
                CheckInNotifier.cancel(context)
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        private const val ACTION = "com.cadence.app.LOG_CHECKIN"
        private const val EXTRA_CATEGORY_ID = "category_id"

        fun pendingFor(context: Context, categoryId: Long): PendingIntent {
            val intent = Intent(context, CheckInActionReceiver::class.java).apply {
                action = ACTION
                putExtra(EXTRA_CATEGORY_ID, categoryId)
            }
            return PendingIntent.getBroadcast(
                context,
                categoryId.toInt(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
    }
}
