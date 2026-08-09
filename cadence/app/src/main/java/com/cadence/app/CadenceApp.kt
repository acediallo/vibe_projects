package com.cadence.app

import android.app.Application
import com.cadence.app.di.Graph
import com.cadence.app.notify.CheckInNotifier
import com.cadence.app.work.CheckInWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class CadenceApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Graph.init(this)
        CheckInNotifier.ensureChannel(this)

        // Ensure the periodic check-in worker is scheduled with the saved interval.
        Graph.applicationScope.launch(Dispatchers.IO) {
            val settings = Graph.settingsStore.settings.first()
            CheckInWorker.schedule(this@CadenceApp, settings.checkInIntervalMinutes)
        }
    }
}
