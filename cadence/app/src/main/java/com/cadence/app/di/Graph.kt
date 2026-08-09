package com.cadence.app.di

import android.content.Context
import com.cadence.app.calendar.CalendarReader
import com.cadence.app.data.AppDatabase
import com.cadence.app.data.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob

/**
 * Tiny manual service locator. Avoids pulling in a DI framework for a small app while
 * still giving workers, receivers, and view models a single place to reach shared
 * singletons.
 */
object Graph {
    lateinit var appContext: Context
        private set

    val applicationScope = CoroutineScope(SupervisorJob())

    val database: AppDatabase by lazy { AppDatabase.get(appContext, applicationScope) }
    val settingsStore: SettingsStore by lazy { SettingsStore(appContext) }
    val calendarReader: CalendarReader by lazy { CalendarReader(appContext) }

    fun init(context: Context) {
        appContext = context.applicationContext
    }
}
