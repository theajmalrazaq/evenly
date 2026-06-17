import { Link } from 'react-router-dom'
import { Home, Users, Layers, PiggyBank, User } from 'lucide-react'

export default function Navbar({ currentPage = 'home' }) {
  const menuItems = [
    { id: 'home', label: 'Home', Icon: Home, path: '/home' },
    { id: 'friends', label: 'Friends', Icon: Users, path: '/friends' },
    { id: 'groups', label: 'Groups', Icon: Layers, path: '/groups' },
    { id: 'spending', label: 'Spending', Icon: PiggyBank, path: '/spending' },
    { id: 'profile', label: 'Profile', Icon: User, path: '/profile' },
  ]

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-5 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md border border-accent/20 z-50 rounded-full shadow-lg w-[90%] max-w-md">
        <div className="flex items-center justify-around py-3 px-2">
          {menuItems.map(item => {
            const IconComponent = item.Icon
            const isActive = currentPage === item.id
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'text-accent bg-accent/10'
                    : 'text-white/70 hover:text-accent hover:bg-accent/5'
                }`}
              >
                <IconComponent className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
