import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  return (
    <header className="bg-blue-700 text-white shadow-md z-50 relative">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-90 transition-opacity">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="7" fill="white" fillOpacity="0.2"/>
            <rect x="7" y="9" width="18" height="2.5" rx="1.25" fill="white"/>
            <rect x="7" y="14.75" width="18" height="2.5" rx="1.25" fill="white"/>
            <rect x="7" y="20.5" width="11" height="2.5" rx="1.25" fill="white"/>
          </svg>
          <span>FormBuilder</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isHome ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10'
            }`}
          >
            My Forms
          </Link>
          <a
            href="#"
            className="px-3 py-1.5 rounded-md text-sm font-medium text-blue-100 hover:bg-white/10 transition-colors"
            onClick={e => e.preventDefault()}
          >
            Docs
          </a>
        </nav>
      </div>
    </header>
  )
}
