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
import AIAnalysis from './pages/AIAnalysis'
import Strategy from './pages/Strategy'
import Backtest from './pages/Backtest'
import Trade from './pages/Trade'
import StrategyMarket from './pages/StrategyMarket'

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

  // AI Analysis route
  if (pathname === '/ai-analysis') {
    return (
      <AuthProvider>
        <div className="w-full min-h-screen bg-gray-900 text-white" style={{ fontFamily: '"Space Mono", monospace' }}>
          <Navbar entranceComplete={true} onOpenAuth={openAuth} />
          <AIAnalysis />
        </div>
        <AuthModal
          open={authOpen}
          initialMode={authMode}
          onClose={() => setAuthOpen(false)}
        />
      </AuthProvider>
    )
  }

  // Strategy management route
  if (pathname === '/strategy') {
    return (
      <AuthProvider>
        <div className="w-full min-h-screen bg-gray-900 text-white" style={{ fontFamily: '"Space Mono", monospace' }}>
          <Navbar entranceComplete={true} onOpenAuth={openAuth} />
          <Strategy />
        </div>
        <AuthModal
          open={authOpen}
          initialMode={authMode}
          onClose={() => setAuthOpen(false)}
        />
      </AuthProvider>
    )
  }

  // Backtest route
  if (pathname === '/backtest') {
    return (
      <AuthProvider>
        <div className="w-full min-h-screen bg-gray-900 text-white" style={{ fontFamily: '"Space Mono", monospace' }}>
          <Navbar entranceComplete={true} onOpenAuth={openAuth} />
          <Backtest />
        </div>
        <AuthModal
          open={authOpen}
          initialMode={authMode}
          onClose={() => setAuthOpen(false)}
        />
      </AuthProvider>
    )
  }

  // Trade route
  if (pathname === '/trade') {
    return (
      <AuthProvider>
        <div className="w-full min-h-screen bg-gray-900 text-white" style={{ fontFamily: '"Space Mono", monospace' }}>
          <Navbar entranceComplete={true} onOpenAuth={openAuth} />
          <Trade />
        </div>
        <AuthModal
          open={authOpen}
          initialMode={authMode}
          onClose={() => setAuthOpen(false)}
        />
      </AuthProvider>
    )
  }

  // Strategy Market route
  if (pathname === '/strategy-market') {
    return (
      <AuthProvider>
        <div className="w-full min-h-screen bg-gray-900 text-white" style={{ fontFamily: '"Space Mono", monospace' }}>
          <Navbar entranceComplete={true} onOpenAuth={openAuth} />
          <StrategyMarket />
        </div>
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
