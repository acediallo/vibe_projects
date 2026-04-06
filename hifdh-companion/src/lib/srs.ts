/**
 * Simplified SM-2 Spaced Repetition Algorithm
 * Adapted for Quran memorization
 */

export type Performance = 'forgot' | 'hard' | 'good' | 'easy'

export interface SRSResult {
  nextIntervalDays: number
  retentionStrength: number // 0.0 - 1.0
}

const BASE_INTERVALS = [1, 3, 7, 15, 30, 60, 120]

export function calculateNextReview(
  currentIntervalDays: number,
  reviewCount: number,
  performance: Performance,
  currentStrength: number
): SRSResult {
  let nextInterval: number
  let strength: number

  switch (performance) {
    case 'forgot':
      // Reset to beginning
      nextInterval = 1
      strength = Math.max(0, currentStrength - 0.3)
      break

    case 'hard':
      // Keep same interval, slight strength decrease
      nextInterval = Math.max(1, Math.round(currentIntervalDays * 0.8))
      strength = Math.max(0, currentStrength - 0.1)
      break

    case 'good': {
      // Move to next interval in the sequence
      const currentIndex = BASE_INTERVALS.findIndex(i => i >= currentIntervalDays)
      const nextIndex = Math.min(currentIndex + 1, BASE_INTERVALS.length - 1)
      nextInterval = BASE_INTERVALS[nextIndex] ?? currentIntervalDays * 2
      strength = Math.min(1, currentStrength + 0.1)
      break
    }

    case 'easy': {
      // Skip ahead in the sequence
      const easyIndex = BASE_INTERVALS.findIndex(i => i >= currentIntervalDays)
      const skipIndex = Math.min(easyIndex + 2, BASE_INTERVALS.length - 1)
      nextInterval = BASE_INTERVALS[skipIndex] ?? currentIntervalDays * 3
      strength = Math.min(1, currentStrength + 0.2)
      break
    }
  }

  // Bonus for high review counts (established memories are more stable)
  if (reviewCount > 10 && performance !== 'forgot') {
    nextInterval = Math.round(nextInterval * 1.2)
  }

  return {
    nextIntervalDays: nextInterval,
    retentionStrength: Math.round(strength * 100) / 100,
  }
}

export function getNextReviewDate(intervalDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + intervalDays)
  return date.toISOString()
}
