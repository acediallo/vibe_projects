import { useState, useEffect } from 'react'
import type { Surah } from '@/types/quran'

const QURAN_CDN = 'https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/quran.json'
const CACHE_KEY = 'hifdh-quran-data'

export function useQuranData() {
  const [surahs, setSurahs] = useState<Surah[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        // Try localStorage cache first
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          setSurahs(JSON.parse(cached))
          setLoading(false)
          return
        }

        // Fetch from CDN
        const res = await fetch(QURAN_CDN)
        if (!res.ok) throw new Error(`Failed to fetch Quran data: ${res.status}`)
        const data: Surah[] = await res.json()

        // Cache in localStorage for offline use
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data))
        } catch {
          // localStorage might be full — that's okay, we still have the data in memory
        }

        setSurahs(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Quran data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return { surahs, loading, error }
}
