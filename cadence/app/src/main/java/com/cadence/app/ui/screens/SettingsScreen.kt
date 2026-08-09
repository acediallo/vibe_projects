package com.cadence.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cadence.app.calendar.DeviceCalendar
import com.cadence.app.ui.MainViewModel
import com.cadence.app.ui.formatMinutes
import kotlin.math.roundToInt

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen(vm: MainViewModel) {
    val settings by vm.settings.collectAsStateWithLifecycle()
    var calendars by remember { mutableStateOf<List<DeviceCalendar>>(emptyList()) }

    LaunchedEffect(Unit) { calendars = vm.availableCalendars() }

    Column(
        Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Settings", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Check-in interval", fontWeight = FontWeight.Medium)
                Text("Every ${formatMinutes(settings.checkInIntervalMinutes)}")
                // Discrete options avoid spamming WorkManager on every drag frame.
                androidx.compose.foundation.layout.FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    listOf(15, 30, 45, 60, 90, 120).forEach { m ->
                        FilterPill(
                            label = formatMinutes(m),
                            selected = settings.checkInIntervalMinutes == m,
                            onClick = { vm.updateInterval(m) },
                        )
                    }
                }
            }
        }

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Active hours", fontWeight = FontWeight.Medium)
                Text("Prompts only fire between these hours.")
                HourRow("Start", settings.activeStartHour) {
                    vm.updateActiveHours(it, settings.activeEndHour)
                }
                HourRow("End", settings.activeEndHour) {
                    vm.updateActiveHours(settings.activeStartHour, it)
                }
            }
        }

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Calendars to include", fontWeight = FontWeight.Medium)
                if (calendars.isEmpty()) {
                    Text(
                        "No calendars found. Grant calendar permission, then reopen this screen.",
                        style = MaterialTheme.typography.bodySmall,
                    )
                } else {
                    Text(
                        "None selected = include all.",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    calendars.forEach { cal ->
                        val checked = cal.id in settings.selectedCalendarIds
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = checked,
                                onCheckedChange = { on ->
                                    val next = settings.selectedCalendarIds.toMutableSet()
                                    if (on) next.add(cal.id) else next.remove(cal.id)
                                    vm.updateSelectedCalendars(next)
                                },
                            )
                            Spacer(Modifier.width(4.dp))
                            Column {
                                Text(cal.displayName)
                                Text(cal.accountName, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HourRow(label: String, hour: Int, onChange: (Int) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, modifier = Modifier.width(56.dp))
        Slider(
            value = hour.toFloat(),
            onValueChange = { onChange(it.roundToInt()) },
            valueRange = 0f..24f,
            steps = 23,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(8.dp))
        Text(String.format("%02d:00", hour), modifier = Modifier.width(56.dp))
    }
}

@Composable
private fun FilterPill(label: String, selected: Boolean, onClick: () -> Unit) {
    androidx.compose.material3.FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
    )
}
