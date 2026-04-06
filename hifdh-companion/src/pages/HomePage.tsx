import { Link } from 'react-router-dom'
import { BookOpen, CalendarCheck } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center pt-2">
        <h1 className="text-xl font-bold text-gray-900">
          Bismillah <span className="text-teal-700">📖</span>
        </h1>
        <p className="text-gray-500 text-sm mt-1">What would you like to do today?</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <p className="text-3xl font-bold text-teal-700">0</p>
          <p className="text-xs text-gray-500 mt-1">Verses Memorized</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-amber-600">0</p>
          <p className="text-xs text-gray-500 mt-1">Due for Review</p>
        </div>
      </div>

      {/* Action Cards */}
      <div className="space-y-3">
        <Link to="/review" className="card flex items-center gap-4 hover:border-teal-300 transition-colors">
          <div className="bg-teal-100 text-teal-700 p-3 rounded-xl">
            <CalendarCheck size={24} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">Start Review</h3>
            <p className="text-sm text-gray-500">Review your memorized verses</p>
          </div>
        </Link>

        <Link to="/quran" className="card flex items-center gap-4 hover:border-teal-300 transition-colors">
          <div className="bg-emerald-100 text-emerald-700 p-3 rounded-xl">
            <BookOpen size={24} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">Add Verses</h3>
            <p className="text-sm text-gray-500">Mark new verses as memorized</p>
          </div>
        </Link>
      </div>

      {/* Streak */}
      <div className="card text-center">
        <p className="text-sm text-gray-500">Current Streak</p>
        <p className="text-4xl font-bold text-teal-700 my-2">0</p>
        <p className="text-xs text-gray-400">Complete a review to start your streak!</p>
      </div>
    </div>
  )
}
