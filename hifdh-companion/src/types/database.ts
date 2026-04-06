export interface Database {
  public: {
    Tables: {
      memorized_verses: {
        Row: MemorizedVerse
        Insert: Omit<MemorizedVerse, 'id' | 'memorized_at'>
        Update: Partial<MemorizedVerse>
      }
      review_history: {
        Row: ReviewHistory
        Insert: Omit<ReviewHistory, 'id' | 'reviewed_at'>
        Update: Partial<ReviewHistory>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export interface MemorizedVerse {
  id: string
  user_id: string
  surah_number: number
  verse_number: number
  page_number: number
  memorized_at: string
  next_review_date: string
  review_count: number
  retention_strength: number
  last_performance: string | null
  interval_days: number
}

export interface ReviewHistory {
  id: string
  user_id: string
  verse_id: string
  reviewed_at: string
  performance: string
  interval_days: number
}
