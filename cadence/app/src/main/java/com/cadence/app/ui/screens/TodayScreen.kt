package com.cadence.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Card
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cadence.app.repo.CategorySummary
import com.cadence.app.repo.DaySummary
import com.cadence.app.ui.MainViewModel
import com.cadence.app.ui.formatClock
import com.cadence.app.ui.formatMinutes
import com.cadence.app.ui.parseColor

@Composable
fun TodayScreen(vm: MainViewModel, onAddCheckIn: () -> Unit) {
    val summary by vm.daySummary.collectAsStateWithLifecycle()

    Scaffold(
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onAddCheckIn,
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text("Log now") },
            )
        },
    ) { padding ->
        val data = summary
        if (data == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Loading…") }
            return@Scaffold
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { OverviewCard(data) }
            item {
                Text(
                    "Goals & time today",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            items(data.categories) { cs -> CategoryRow(cs) }
            item {
                Text(
                    "Recent check-ins",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            if (data.checkIns.isEmpty()) {
                item { Text("No check-ins yet today.", style = MaterialTheme.typography.bodyMedium) }
            } else {
                items(data.checkIns) { ci ->
                    val cat = data.categories.firstOrNull { it.category.id == ci.categoryId }?.category
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(formatClock(ci.timestampMillis), style = MaterialTheme.typography.labelLarge)
                        Spacer(Modifier.width(12.dp))
                        Box(
                            Modifier.size(10.dp).clip(CircleShape)
                                .background(parseColor(cat?.colorHex ?: "#9E9E9E")),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(cat?.name ?: "Unknown")
                        ci.note?.let {
                            Spacer(Modifier.width(8.dp))
                            Text("— $it", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(72.dp)) }
        }
    }
}

@Composable
private fun OverviewCard(data: DaySummary) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Today at a glance", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text("Logged: ${formatMinutes(data.totalLoggedMinutes)}")
            Text("Active window elapsed: ${formatMinutes(data.elapsedActiveMinutes)}")
            Text(
                "Idle / unaccounted: ${formatMinutes(data.unaccountedMinutes)}",
                color = MaterialTheme.colorScheme.error,
            )
            Text("Calendar plan: ${data.baselineEvents.size} event(s)")
        }
    }
}

@Composable
private fun CategoryRow(cs: CategorySummary) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(14.dp).clip(CircleShape).background(parseColor(cs.category.colorHex)),
                )
                Spacer(Modifier.width(10.dp))
                Text(cs.category.name, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                val goalText = if (cs.goalMinutes > 0) {
                    "${formatMinutes(cs.loggedMinutes)} / ${formatMinutes(cs.goalMinutes)}"
                } else {
                    formatMinutes(cs.loggedMinutes)
                }
                Text(goalText, style = MaterialTheme.typography.labelLarge)
            }
            cs.goalProgress?.let { progress ->
                Spacer(Modifier.height(8.dp))
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth().height(6.dp).clip(CircleShape),
                    color = parseColor(cs.category.colorHex),
                )
            }
        }
    }
}
