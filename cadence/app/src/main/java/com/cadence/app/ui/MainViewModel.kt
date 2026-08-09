package com.cadence.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cadence.app.calendar.CalendarEvent
import com.cadence.app.calendar.DeviceCalendar
import com.cadence.app.data.AppSettings
import com.cadence.app.data.Category
import com.cadence.app.data.CheckIn
import com.cadence.app.di.Graph
import com.cadence.app.repo.DaySummary
import com.cadence.app.repo.SummaryRepository
import com.cadence.app.repo.TimeUtils
import com.cadence.app.work.CheckInWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainViewModel : ViewModel() {

    private val categoryDao = Graph.database.categoryDao()
    private val checkInDao = Graph.database.checkInDao()
    private val settingsStore = Graph.settingsStore
    private val calendarReader = Graph.calendarReader

    private val dayStart = TimeUtils.startOfDay(System.currentTimeMillis())
    private val dayEnd = dayStart + TimeUtils.DAY_MILLIS

    private val baselineEvents = MutableStateFlow<List<CalendarEvent>>(emptyList())

    val categories: StateFlow<List<Category>> =
        categoryDao.observeActive().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val settings: StateFlow<AppSettings> =
        settingsStore.settings.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), AppSettings())

    val daySummary: StateFlow<DaySummary?> =
        combine(
            categoryDao.observeActive(),
            checkInDao.observeBetween(dayStart, dayEnd),
            settingsStore.settings,
            baselineEvents,
        ) { cats, checkIns, settings, events ->
            SummaryRepository.buildDaySummary(
                nowMillis = System.currentTimeMillis(),
                activeStartHour = settings.activeStartHour,
                activeEndHour = settings.activeEndHour,
                categories = cats,
                checkIns = checkIns,
                baselineEvents = events,
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    init {
        refreshCalendar()
    }

    fun refreshCalendar() {
        viewModelScope.launch {
            val selected = settings.value.selectedCalendarIds
            val events = withContext(Dispatchers.IO) {
                calendarReader.eventsBetween(dayStart, dayEnd, selected)
            }
            baselineEvents.value = events
        }
    }

    fun logCheckIn(categoryId: Long, note: String? = null, source: String = CheckIn.SOURCE_MANUAL) {
        viewModelScope.launch(Dispatchers.IO) {
            val interval = settings.value.checkInIntervalMinutes
            checkInDao.insert(
                CheckIn(
                    timestampMillis = System.currentTimeMillis(),
                    categoryId = categoryId,
                    note = note?.takeIf { it.isNotBlank() },
                    coveredMinutes = interval,
                    source = source,
                ),
            )
        }
    }

    fun deleteCheckIn(checkIn: CheckIn) {
        viewModelScope.launch(Dispatchers.IO) { checkInDao.delete(checkIn) }
    }

    fun saveCategory(category: Category) {
        viewModelScope.launch(Dispatchers.IO) {
            if (category.id == 0L) categoryDao.insert(category) else categoryDao.update(category)
        }
    }

    fun archiveCategory(category: Category) {
        viewModelScope.launch(Dispatchers.IO) { categoryDao.update(category.copy(archived = true)) }
    }

    suspend fun availableCalendars(): List<DeviceCalendar> =
        withContext(Dispatchers.IO) { calendarReader.listCalendars() }

    fun updateInterval(minutes: Int) {
        viewModelScope.launch {
            settingsStore.setInterval(minutes)
            CheckInWorker.schedule(Graph.appContext, minutes)
        }
    }

    fun updateActiveHours(start: Int, end: Int) {
        viewModelScope.launch { settingsStore.setActiveHours(start, end) }
    }

    fun updateSelectedCalendars(ids: Set<String>) {
        viewModelScope.launch {
            settingsStore.setSelectedCalendars(ids)
            refreshCalendar()
        }
    }
}
