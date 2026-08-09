package com.cadence.app.ui

import androidx.compose.ui.graphics.Color
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

fun parseColor(hex: String): Color = try {
    Color(android.graphics.Color.parseColor(hex))
} catch (_: IllegalArgumentException) {
    Color(0xFF607D8B)
}

fun formatMinutes(total: Int): String {
    val h = total / 60
    val m = total % 60
    return when {
        h > 0 && m > 0 -> "${h}h ${m}m"
        h > 0 -> "${h}h"
        else -> "${m}m"
    }
}

private val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())

fun formatClock(millis: Long): String = timeFormat.format(Date(millis))
