package com.cadence.app.calendar

import android.content.Context
import android.content.pm.PackageManager
import android.provider.CalendarContract
import androidx.core.content.ContextCompat

data class DeviceCalendar(
    val id: String,
    val displayName: String,
    val accountName: String,
)

data class CalendarEvent(
    val id: Long,
    val title: String,
    val startMillis: Long,
    val endMillis: Long,
    val calendarId: String,
) {
    val durationMinutes: Int get() = ((endMillis - startMillis) / 60000L).toInt().coerceAtLeast(0)
}

/**
 * Reads the schedule already present on the device (Google, Exchange, local, etc.)
 * through Android's CalendarContract. Used as the "baseline" plan to compare against
 * what the user actually logged. Requires READ_CALENDAR.
 */
class CalendarReader(private val context: Context) {

    fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, android.Manifest.permission.READ_CALENDAR) ==
            PackageManager.PERMISSION_GRANTED

    fun listCalendars(): List<DeviceCalendar> {
        if (!hasPermission()) return emptyList()
        val projection = arrayOf(
            CalendarContract.Calendars._ID,
            CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
            CalendarContract.Calendars.ACCOUNT_NAME,
        )
        val result = mutableListOf<DeviceCalendar>()
        context.contentResolver.query(
            CalendarContract.Calendars.CONTENT_URI, projection, null, null, null,
        )?.use { c ->
            while (c.moveToNext()) {
                result.add(
                    DeviceCalendar(
                        id = c.getLong(0).toString(),
                        displayName = c.getString(1) ?: "(unnamed)",
                        accountName = c.getString(2) ?: "",
                    ),
                )
            }
        }
        return result
    }

    /**
     * Events overlapping [start, end). When [calendarIds] is empty, all calendars are
     * included. Uses the Instances table so recurring events are expanded.
     */
    fun eventsBetween(start: Long, end: Long, calendarIds: Set<String>): List<CalendarEvent> {
        if (!hasPermission()) return emptyList()
        val projection = arrayOf(
            CalendarContract.Instances.EVENT_ID,
            CalendarContract.Instances.TITLE,
            CalendarContract.Instances.BEGIN,
            CalendarContract.Instances.END,
            CalendarContract.Instances.CALENDAR_ID,
        )
        val uri = CalendarContract.Instances.CONTENT_URI.buildUpon()
            .appendPath(start.toString())
            .appendPath(end.toString())
            .build()

        val result = mutableListOf<CalendarEvent>()
        context.contentResolver.query(uri, projection, null, null, "${CalendarContract.Instances.BEGIN} ASC")
            ?.use { c ->
                while (c.moveToNext()) {
                    val calId = c.getLong(4).toString()
                    if (calendarIds.isNotEmpty() && calId !in calendarIds) continue
                    result.add(
                        CalendarEvent(
                            id = c.getLong(0),
                            title = c.getString(1) ?: "(no title)",
                            startMillis = c.getLong(2),
                            endMillis = c.getLong(3),
                            calendarId = calId,
                        ),
                    )
                }
            }
        return result
    }
}
