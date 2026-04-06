export interface Surah {
  id: number
  name: string
  transliteration: string
  translation: string
  type: 'meccan' | 'medinan'
  total_verses: number
  verses: Verse[]
}

export interface Verse {
  id: number
  text: string
  translation: string
}

export interface QuranMeta {
  id: number
  name: string
  transliteration: string
  translation: string
  type: string
  total_verses: number
}
