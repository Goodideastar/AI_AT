import { useEffect, useState } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import Navbar from './sections/Navbar'
import Hero from './sections/Hero'
import CinematicText from './sections/CinematicText'
import Metrics from './sections/Metrics'
import Technology from './sections/Technology'
import Architecture from './sections/Architecture'
import Footer from './sections/Footer'
import AuthModal from './components/AuthModal'
import NotFound from './pages/NotFound'
import UserAgreement from './pages/UserAgreement'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Dashboard from './pages/Dashboard'

export default function App() {
  // Hero entrance drives the Navbar fade-in.
  const [entranceComplete, setEntranceComplete] = useState(false)

  // Auth modal state
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  // Keep the 404 route in sync with the browser URL so back/forward works.
  const [pathname, setPathname] = useState(window.location.pathname)
  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  // 协议类页面（用户协议 / 隐私政策）
  if (pathname === '/privacy-agreement') {
    return <UserAgreement />
  }
  if (pathname === '/privacy-policy') {
    return <PrivacyPolicy />
  }

  // Dashboard route
  if (pathname === '/dashboard') {
    return (
      <AuthProvider>
        <Dashboard entranceComplete={true} onOpenAuth={openAuth} />
        <AuthModal
          open={authOpen}
          initialMode={authMode}
          onClose={() => setAuthOpen(false)}
        />
      </AuthProvider>
    )
  }

  // Anything other than "/" renders the 404 page.
  const isNotFound = pathname !== '/' && pathname !== ''

  if (isNotFound) {
    return <NotFound />
  }

  return (
    <AuthProvider>
      <div
        className="w-full bg-black text-white relative"
        style={{ fontFamily: '"Space Mono", monospace' }}
      >
        <Navbar entranceComplete={entranceComplete} onOpenAuth={openAuth} />

        <Hero onEntrance={setEntranceComplete} />

        <CinematicText />
        <Metrics />
        <Technology />
        <Architecture />
        <Footer />

        <AuthModal
          open={authOpen}
          initialMode={authMode}
          onClose={() => setAuthOpen(false)}
        />
      </div>
    </AuthProvider>
  )
}
