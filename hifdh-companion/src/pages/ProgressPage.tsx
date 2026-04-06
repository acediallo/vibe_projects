import { BarChart3 } from 'lucide-react'

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Progress</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-bold text-teal-700">0</p>
          <p className="text-xs text-gray-500">Memorized</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-emerald-600">0%</p>
          <p className="text-xs text-gray-500">Retention</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-amber-600">0</p>
          <p className="text-xs text-gray-500">Reviews</p>
        </div>
      </div>

      {/* Empty state */}
      <div className="card text-center py-12">
        <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="font-semibold text-gray-700">No data yet</h3>
        <p className="text-sm text-gray-500 mt-2">
          Start memorizing and reviewing to see your progress here.
        </p>
      </div>
    </div>
  )
}
