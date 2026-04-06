import { useState } from 'react'
import { useQuranData } from '@/hooks/useQuranData'
import { Search, BookOpen, ChevronRight } from 'lucide-react'
import SurahDetail from '@/components/SurahDetail'

export default function QuranPage() {
  const { surahs, loading, error } = useQuranData()
  const [search, setSearch] = useState('')
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null)

  if (selectedSurah !== null) {
    const surah = surahs.find(s => s.id === selectedSurah)
    if (surah) {
      return <SurahDetail surah={surah} onBack={() => setSelectedSurah(null)} />
    }
  }

  const filtered = surahs.filter(s =>
    s.transliteration.toLowerCase().includes(search.toLowerCase()) ||
    s.name.includes(search) ||
    s.id.toString() === search
  )

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Add Verses</h1>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search surah by name or number..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-700 border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading Quran data...</p>
        </div>
      )}

      {error && (
        <div className="card text-center py-8">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Surah List */}
      {!loading && !error && (
        <div className="space-y-2">
          {filtered.map(surah => (
            <button
              key={surah.id}
              onClick={() => setSelectedSurah(surah.id)}
              className="card w-full flex items-center gap-3 hover:border-teal-300 transition-colors text-left"
            >
              <div className="bg-teal-100 text-teal-700 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0">
                {surah.id}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 text-sm">{surah.transliteration}</h3>
                  <span className="text-lg text-gray-700 font-arabic">{surah.name}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {surah.total_verses} verses • {surah.type === 'meccan' ? 'Meccan' : 'Medinan'}
                </p>
              </div>
              <ChevronRight size={18} className="text-gray-300 shrink-0" />
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="card text-center py-8">
              <BookOpen size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No surahs found</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
