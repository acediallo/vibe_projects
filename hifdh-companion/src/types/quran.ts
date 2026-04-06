export interface Surah {
  id: number
  name: string
  transliteration: string
  type: 'meccan' | 'medinan'
  total_verses: number
  verses: Verse[]
}

export interface Verse {
  id: number
  text: string
}
