package com.cadence.app.work

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.cadence.app.di.Graph
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/** Re-schedules the check-in worker after the device reboots. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        Graph.init(context)
        val pending = goAsync()
        Graph.applicationScope.launch(Dispatchers.IO) {
            try {
                val settings = Graph.settingsStore.settings.first()
                CheckInWorker.schedule(context, settings.checkInIntervalMinutes)
            } finally {
                pending.finish()
            }
        }
    }
}
