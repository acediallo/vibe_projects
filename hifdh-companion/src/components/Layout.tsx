import { Outlet, NavLink } from 'react-router-dom'
import { Home, BookOpen, CalendarCheck, BarChart3, User } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/quran', icon: BookOpen, label: 'Quran' },
  { to: '/review', icon: CalendarCheck, label: 'Review' },
  { to: '/progress', icon: BarChart3, label: 'Progress' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export default function Layout() {
  return (
    <div className="flex flex-col min-h-dvh max-w-lg mx-auto">
      {/* Main content */}
      <main className="flex-1 pb-20 px-4 pt-4">
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-teal-100 safe-bottom z-50">
        <div className="max-w-lg mx-auto flex justify-around py-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${
                  isActive
                    ? 'text-teal-700 font-semibold'
                    : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
