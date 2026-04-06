import { CalendarCheck } from 'lucide-react'

export default function ReviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Review Queue</h1>

      {/* Empty state */}
      <div className="card text-center py-12">
        <CalendarCheck size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="font-semibold text-gray-700">No reviews due</h3>
        <p className="text-sm text-gray-500 mt-2">
          Mark some verses as memorized to start your review schedule.
        </p>
      </div>
    </div>
  )
}
