package com.cadence.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(entities = [Category::class, CheckIn::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun categoryDao(): CategoryDao
    abstract fun checkInDao(): CheckInDao

    companion object {
        @Volatile
        private var instance: AppDatabase? = null

        fun get(context: Context, scope: CoroutineScope): AppDatabase =
            instance ?: synchronized(this) {
                instance ?: build(context.applicationContext, scope).also { instance = it }
            }

        private fun build(context: Context, scope: CoroutineScope): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, "cadence.db")
                .addCallback(object : Callback() {
                    override fun onCreate(db: SupportSQLiteDatabase) {
                        super.onCreate(db)
                        // Seed default categories the first time the DB is created.
                        scope.launch(Dispatchers.IO) {
                            instance?.categoryDao()?.let { dao ->
                                DefaultCategories.seed.forEach { dao.insert(it) }
                            }
                        }
                    }
                })
                .build()
    }
}

object DefaultCategories {
    val seed = listOf(
        Category(name = "Deep Work", colorHex = "#1E88E5", dailyGoalMinutes = 180, sortOrder = 0),
        Category(name = "PMP Study", colorHex = "#8E24AA", dailyGoalMinutes = 60, sortOrder = 1),
        Category(name = "Meetings", colorHex = "#FB8C00", dailyGoalMinutes = 0, sortOrder = 2),
        Category(name = "Breaks", colorHex = "#43A047", dailyGoalMinutes = 0, sortOrder = 3),
        Category(name = "Idle / Unaccounted", colorHex = "#9E9E9E", dailyGoalMinutes = 0, isIdle = true, sortOrder = 99),
    )
}
