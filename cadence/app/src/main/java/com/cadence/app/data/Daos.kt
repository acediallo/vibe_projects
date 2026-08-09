package com.cadence.app.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface CategoryDao {
    @Query("SELECT * FROM categories WHERE archived = 0 ORDER BY sortOrder ASC, id ASC")
    fun observeActive(): Flow<List<Category>>

    @Query("SELECT * FROM categories WHERE archived = 0 ORDER BY sortOrder ASC, id ASC")
    suspend fun getActive(): List<Category>

    @Query("SELECT * FROM categories WHERE id = :id")
    suspend fun getById(id: Long): Category?

    @Query("SELECT * FROM categories WHERE isIdle = 1 LIMIT 1")
    suspend fun getIdle(): Category?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(category: Category): Long

    @Update
    suspend fun update(category: Category)

    @Delete
    suspend fun delete(category: Category)

    @Query("SELECT COUNT(*) FROM categories")
    suspend fun count(): Int
}

@Dao
interface CheckInDao {
    @Query("SELECT * FROM checkins WHERE timestampMillis BETWEEN :start AND :end ORDER BY timestampMillis DESC")
    fun observeBetween(start: Long, end: Long): Flow<List<CheckIn>>

    @Query("SELECT * FROM checkins WHERE timestampMillis BETWEEN :start AND :end ORDER BY timestampMillis ASC")
    suspend fun getBetween(start: Long, end: Long): List<CheckIn>

    /** Category ids ordered by most-recently used, for notification quick actions. */
    @Query("SELECT categoryId FROM checkins GROUP BY categoryId ORDER BY MAX(timestampMillis) DESC LIMIT :limit")
    suspend fun recentCategoryIds(limit: Int): List<Long>

    @Insert
    suspend fun insert(checkIn: CheckIn): Long

    @Delete
    suspend fun delete(checkIn: CheckIn)
}
