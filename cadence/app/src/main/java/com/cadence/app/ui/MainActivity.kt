package com.cadence.app.ui

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.viewmodel.compose.viewModel
import com.cadence.app.ui.theme.CadenceTheme

class MainActivity : ComponentActivity() {

    private val openCheckInOnLaunch = mutableStateOf(false)

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { /* result handled reactively */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        openCheckInOnLaunch.value = intent?.getBooleanExtra(EXTRA_OPEN_CHECKIN, false) == true
        requestNeededPermissions()

        setContent {
            CadenceTheme {
                val vm: MainViewModel = viewModel()
                CadenceApp(vm = vm, startOnCheckIn = openCheckInOnLaunch.value)
            }
        }
    }

    private fun requestNeededPermissions() {
        val perms = mutableListOf(Manifest.permission.READ_CALENDAR)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        permissionLauncher.launch(perms.toTypedArray())
    }

    companion object {
        const val EXTRA_OPEN_CHECKIN = "open_checkin"
    }
}
