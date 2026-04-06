import { useState } from 'react'
import type { Surah } from '@/types/quran'
import { ArrowLeft, Check, CheckCheck } from 'lucide-react'

interface Props {
  surah: Surah
  onBack: () => void
}

export default function SurahDetail({ surah, onBack }: Props) {
  // Track which verses the user has selected in this session
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saved, setSaved] = useState(false)

  const toggleVerse = (verseId: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(verseId)) {
        next.delete(verseId)
      } else {
        next.add(verseId)
      }
      return next
    })
    setSaved(false)
  }

  const selectAll = () => {
    if (selected.size === surah.verses.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(surah.verses.map(v => v.id)))
    }
    setSaved(false)
  }

  const selectRange = (start: number, end: number) => {
    const next = new Set(selected)
    for (let i = start; i <= end; i++) {
      next.add(i)
    }
    setSelected(next)
    setSaved(false)
  }

  const handleSave = () => {
    if (selected.size === 0) return

    // For now, save to localStorage (will connect to Supabase later)
    const storageKey = 'hifdh-memorized'
    const existing = JSON.parse(localStorage.getItem(storageKey) || '[]') as Array<{
      surah_number: number
      verse_number: number
    }>

    const newVerses = Array.from(selected)
      .filter(v => !existing.some(
        (e: { surah_number: number; verse_number: number }) =>
          e.surah_number === surah.id && e.verse_number === v
      ))
      .map(verseId => ({
        surah_number: surah.id,
        verse_number: verseId,
        memorized_at: new Date().toISOString(),
        next_review_date: new Date(Date.now() + 86400000).toISOString(),
        interval_days: 1,
        review_count: 0,
        retention_strength: 0.5,
        last_performance: null,
      }))

    localStorage.setItem(storageKey, JSON.stringify([...existing, ...newVerses]))
    setSaved(true)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-teal-100 rounded-xl transition-colors">
          <ArrowLeft size={20} className="text-teal-700" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">{surah.transliteration}</h1>
          <p className="text-xs text-gray-500">{surah.total_verses} verses • {surah.name}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <button onClick={selectAll} className="btn-secondary text-xs py-2 px-3 flex-1">
          {selected.size === surah.verses.length ? 'Deselect All' : 'Select All'}
        </button>
        <button
          onClick={() => selectRange(1, Math.min(5, surah.total_verses))}
          className="btn-secondary text-xs py-2 px-3 flex-1"
        >
          First 5
        </button>
        <button
          onClick={() => selectRange(1, Math.min(10, surah.total_verses))}
          className="btn-secondary text-xs py-2 px-3 flex-1"
        >
          First 10
        </button>
      </div>

      {/* Verse list */}
      <div className="space-y-2">
        {surah.verses.map(verse => {
          const isSelected = selected.has(verse.id)
          return (
            <button
              key={verse.id}
              onClick={() => toggleVerse(verse.id)}
              className={`card w-full text-right transition-all ${
                isSelected
                  ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500/20'
                  : 'hover:border-teal-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isSelected ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {isSelected ? <Check size={14} /> : verse.id}
                </div>
                <p className="text-lg leading-loose font-arabic text-gray-900 flex-1" dir="rtl">
                  {verse.text}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Save button - sticky at bottom */}
      {selected.size > 0 && (
        <div className="sticky bottom-20 z-40">
          <button
            onClick={handleSave}
            className={`w-full py-4 rounded-xl font-semibold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
              saved
                ? 'bg-emerald-600'
                : 'bg-teal-700 hover:bg-teal-800 active:bg-teal-900'
            }`}
          >
            {saved ? (
              <>
                <CheckCheck size={20} />
                Saved {selected.size} verse{selected.size > 1 ? 's' : ''}!
              </>
            ) : (
              <>
                Mark {selected.size} verse{selected.size > 1 ? 's' : ''} as memorized
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
