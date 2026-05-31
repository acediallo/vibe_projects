package com.cadence.app.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.cadence.app.R
import com.cadence.app.data.Category
import com.cadence.app.ui.MainActivity

object CheckInNotifier {
    const val CHANNEL_ID = "checkins"
    const val NOTIFICATION_ID = 1001

    fun ensureChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.checkin_channel_name),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = context.getString(R.string.checkin_channel_desc) }
            manager.createNotificationChannel(channel)
        }
    }

    /** Posts the "what are you doing?" prompt with quick-action buttons for [quickCategories]. */
    fun showCheckIn(context: Context, quickCategories: List<Category>) {
        ensureChannel(context)

        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(MainActivity.EXTRA_OPEN_CHECKIN, true)
        }
        val openPending = PendingIntent.getActivity(
            context, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_checkin)
            .setContentTitle(context.getString(R.string.checkin_title))
            .setContentText(context.getString(R.string.checkin_text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openPending)

        quickCategories.take(3).forEach { category ->
            builder.addAction(0, category.name, CheckInActionReceiver.pendingFor(context, category.id))
        }

        NotificationManagerCompat.from(context).also { nm ->
            try {
                nm.notify(NOTIFICATION_ID, builder.build())
            } catch (_: SecurityException) {
                // POST_NOTIFICATIONS not granted yet; nothing else to do.
            }
        }
    }

    fun cancel(context: Context) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }
}
