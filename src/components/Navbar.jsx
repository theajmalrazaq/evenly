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
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-bg-card/90 backdrop-blur-md border border-accent/20 z-50 rounded-full shadow-lg w-[90%] max-w-md transition-colors duration-300">
        <div className="flex items-center justify-around py-1.5 px-3">
          {menuItems.map(item => {
            const IconComponent = item.Icon
            const isActive = currentPage === item.id
            return (
              <Link
                key={item.id}
                to={item.path}
                className="flex flex-col items-center justify-center transition-all duration-200"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-0.5 transition-all duration-200 ${
                  isActive
                    ? 'text-accent bg-accent/15 scale-105 border border-accent/20'
                    : 'text-text-secondary hover:text-accent hover:bg-accent/5'
                }`}>
                  <IconComponent className="w-[18px] h-[18px]" />
                </div>
                <span className={`text-[10px] font-semibold transition-all duration-200 ${
                  isActive ? 'text-accent font-bold' : 'text-text-secondary'
                }`}>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
