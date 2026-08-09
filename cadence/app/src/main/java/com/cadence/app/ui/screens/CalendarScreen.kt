package com.cadence.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cadence.app.ui.MainViewModel
import com.cadence.app.ui.formatClock
import com.cadence.app.ui.formatMinutes

@Composable
fun CalendarScreen(vm: MainViewModel) {
    val summary by vm.daySummary.collectAsStateWithLifecycle()
    val events = summary?.baselineEvents ?: emptyList()

    LazyColumn(
        Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Column {
                Text(
                    "Today's plan (calendar)",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "Your device calendar is the baseline you compare against.",
                    style = MaterialTheme.typography.bodySmall,
                )
                Spacer(Modifier.width(8.dp))
                Button(onClick = { vm.refreshCalendar() }) { Text("Refresh") }
            }
        }
        if (events.isEmpty()) {
            item {
                Text(
                    "No calendar events for today, or calendar permission not granted. " +
                        "Grant calendar access and pick calendars in Settings.",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        } else {
            items(events) { ev ->
                Card(Modifier.fillMaxWidth()) {
                    Row(Modifier.fillMaxWidth().padding(12.dp)) {
                        Text(
                            "${formatClock(ev.startMillis)}–${formatClock(ev.endMillis)}",
                            style = MaterialTheme.typography.labelLarge,
                        )
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(ev.title, fontWeight = FontWeight.Medium)
                            Text(formatMinutes(ev.durationMinutes), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
}
