package com.cadence.app.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "cadence_settings")

data class AppSettings(
    val checkInIntervalMinutes: Int = 60,
    val activeStartHour: Int = 8,
    val activeEndHour: Int = 22,
    val selectedCalendarIds: Set<String> = emptySet(),
)

class SettingsStore(private val context: Context) {

    val settings: Flow<AppSettings> = context.dataStore.data.map { p ->
        AppSettings(
            checkInIntervalMinutes = p[KEY_INTERVAL] ?: 60,
            activeStartHour = p[KEY_START] ?: 8,
            activeEndHour = p[KEY_END] ?: 22,
            selectedCalendarIds = p[KEY_CALENDARS] ?: emptySet(),
        )
    }

    suspend fun setInterval(minutes: Int) =
        context.dataStore.edit { it[KEY_INTERVAL] = minutes.coerceIn(15, 240) }

    suspend fun setActiveHours(startHour: Int, endHour: Int) =
        context.dataStore.edit {
            it[KEY_START] = startHour.coerceIn(0, 23)
            it[KEY_END] = endHour.coerceIn(1, 24)
        }

    suspend fun setSelectedCalendars(ids: Set<String>) =
        context.dataStore.edit { it[KEY_CALENDARS] = ids }

    companion object {
        private val KEY_INTERVAL = intPreferencesKey("check_in_interval_minutes")
        private val KEY_START = intPreferencesKey("active_start_hour")
        private val KEY_END = intPreferencesKey("active_end_hour")
        private val KEY_CALENDARS = stringSetPreferencesKey("selected_calendar_ids")
    }
}
