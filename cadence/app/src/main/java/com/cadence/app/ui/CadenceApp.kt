package com.cadence.app.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Category
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Today
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.cadence.app.ui.screens.CalendarScreen
import com.cadence.app.ui.screens.CategoriesScreen
import com.cadence.app.ui.screens.CheckInScreen
import com.cadence.app.ui.screens.SettingsScreen
import com.cadence.app.ui.screens.TodayScreen

private enum class Dest(val route: String, val label: String, val icon: ImageVector) {
    Today("today", "Today", Icons.Filled.Today),
    Categories("categories", "Goals", Icons.Filled.Category),
    Calendar("calendar", "Calendar", Icons.Filled.CalendarMonth),
    Settings("settings", "Settings", Icons.Filled.Settings),
}

@Composable
fun CadenceApp(vm: MainViewModel, startOnCheckIn: Boolean) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDest = backStackEntry?.destination

    Scaffold(
        bottomBar = {
            NavigationBar {
                Dest.entries.forEach { dest ->
                    val selected = currentDest?.hierarchy?.any { it.route == dest.route } == true
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            navController.navigate(dest.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(dest.icon, contentDescription = dest.label) },
                        label = { Text(dest.label) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = if (startOnCheckIn) "checkin" else Dest.Today.route,
            modifier = Modifier.padding(padding),
        ) {
            composable(Dest.Today.route) {
                TodayScreen(vm, onAddCheckIn = { navController.navigate("checkin") })
            }
            composable(Dest.Categories.route) { CategoriesScreen(vm) }
            composable(Dest.Calendar.route) { CalendarScreen(vm) }
            composable(Dest.Settings.route) { SettingsScreen(vm) }
            composable("checkin") {
                CheckInScreen(vm, onDone = {
                    if (!navController.popBackStack()) {
                        navController.navigate(Dest.Today.route)
                    }
                })
            }
        }
    }
}
