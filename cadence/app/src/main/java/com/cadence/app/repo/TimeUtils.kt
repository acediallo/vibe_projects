package com.cadence.app.repo

import java.util.Calendar

object TimeUtils {

    fun startOfDay(nowMillis: Long): Long {
        val c = Calendar.getInstance().apply {
            timeInMillis = nowMillis
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        return c.timeInMillis
    }

    fun endOfDay(nowMillis: Long): Long = startOfDay(nowMillis) + DAY_MILLIS

    /** Millis for [hour]:00 on the same calendar day as [nowMillis]. hour may be 24. */
    fun hourOfDay(nowMillis: Long, hour: Int): Long = startOfDay(nowMillis) + hour * HOUR_MILLIS

    fun currentHour(nowMillis: Long): Int {
        val c = Calendar.getInstance().apply { timeInMillis = nowMillis }
        return c.get(Calendar.HOUR_OF_DAY)
    }

    const val MINUTE_MILLIS = 60_000L
    const val HOUR_MILLIS = 3_600_000L
    const val DAY_MILLIS = 86_400_000L
}
