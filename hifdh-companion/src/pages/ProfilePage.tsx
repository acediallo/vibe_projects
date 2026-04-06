import { useAuth } from '@/context/AuthContext'
import { LogOut, User } from 'lucide-react'

export default function ProfilePage() {
  const { user, signOut } = useAuth()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Profile</h1>

      <div className="card flex items-center gap-4">
        <div className="bg-teal-100 text-teal-700 p-3 rounded-full">
          <User size={24} />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{user?.email}</p>
          <p className="text-sm text-gray-500">
            Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : ''}
          </p>
        </div>
      </div>

      <button
        onClick={signOut}
        className="btn-secondary w-full flex items-center justify-center gap-2"
      >
        <LogOut size={18} />
        Sign Out
      </button>
    </div>
  )
}
