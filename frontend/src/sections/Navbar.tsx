import { useState } from 'react'
import { motion } from 'framer-motion'
import SynapseXLogo from '../components/SynapseXLogo'
import SquashHamburger from '../components/SquashHamburger'
import ScrambleText from '../components/ScrambleText'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nContext'

interface NavbarProps {
  entranceComplete: boolean
  onOpenAuth: (mode: 'login' | 'register') => void
}

export default function Navbar({ entranceComplete, onOpenAuth }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [hoveredLink, setHoveredLink] = useState<string | null>(null)
  const { isLoggedIn, username, logout } = useAuth()
  const { lang, toggleLang, t } = useI18n()

  const scrollTo = (vhMultiplier: number) => {
    window.scrollTo({ top: window.innerHeight * vhMultiplier, behavior: 'smooth' })
  }

  // 语言切换按钮：显示当前可切换到的语言
  const LangToggle = ({ className = '' }: { className?: string }) => (
    <motion.button
      onClick={toggleLang}
      className={`h-9 sm:h-12 px-2.5 sm:px-3 bg-white/15 backdrop-blur-md rounded-full text-white text-xs sm:text-sm font-medium hover:bg-white/25 transition-colors flex items-center gap-1 ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={lang === 'zh' ? t('lang.toggleToEn') : t('lang.toggleToZh')}
    >
      <span className="opacity-50">{lang === 'zh' ? '中' : 'EN'}</span>
      <span className="opacity-30 text-[10px]">/</span>
      <span>{lang === 'zh' ? 'EN' : '中'}</span>
    </motion.button>
  )

  // 量化平台导航链接（仅登录用户可见）
  const quantNavItems = [
    { key: 'nav.dashboard', label: t('nav.dashboard'), path: '/dashboard' },
    { key: 'nav.aiAnalysis', label: t('nav.aiAnalysis'), path: '/ai-analysis' },
    { key: 'nav.strategy', label: t('nav.strategy'), path: '/strategy' },
    { key: 'nav.backtest', label: t('nav.backtest'), path: '/backtest' },
    { key: 'nav.trade', label: t('nav.trade'), path: '/trade' },
    { key: 'nav.market', label: t('nav.market'), path: '/strategy-market' },
  ]

  const navigateTo = (path: string) => {
    window.location.href = path
  }

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 h-20 px-4 sm:px-6 md:px-8 flex items-center justify-between"
      animate={{ opacity: entranceComplete ? 1 : 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* ── Desktop ── */}
      <div className="hidden sm:flex items-center gap-2">
        <motion.button
          className={`h-12 px-5 bg-white/15 backdrop-blur-md rounded-[14px] flex items-center gap-2 ${
            menuOpen ? 'hidden md:flex' : 'flex'
          }`}
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.22)' }}
          whileTap={{ scale: 0.98 }}
        >
          <SynapseXLogo size={18} />
          <span className="text-white text-[16px] font-medium tracking-tight">SynapseX</span>
        </motion.button>

        <motion.div
          className="h-12 bg-white/15 backdrop-blur-md rounded-[14px] flex items-center overflow-hidden"
          animate={{ width: menuOpen ? 290 : 48 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        >
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex items-center justify-center h-12 w-12 ${
              menuOpen ? 'w-9 h-9 ml-1.5 rounded-[11px] bg-white/10 hover:bg-white/20' : 'rounded-[14px]'
            } transition-colors`}
          >
            <SquashHamburger open={menuOpen} />
          </button>

          <motion.div
            className="flex items-center gap-5 ml-3 whitespace-nowrap"
            animate={{ opacity: menuOpen ? 1 : 0, x: menuOpen ? 0 : 15 }}
            transition={{ duration: 0.3 }}
          >
            {[{ key: 'nav.about', label: t('nav.about'), vh: 1 }, { key: 'nav.metrics', label: t('nav.metrics'), vh: 2 }].map((item) => (
              <button
                key={item.key}
                onMouseEnter={() => setHoveredLink(item.key)}
                onMouseLeave={() => setHoveredLink(null)}
                onClick={() => scrollTo(item.vh)}
                className="text-white/85 hover:text-white text-[16px] font-normal transition-colors"
              >
                <ScrambleText text={item.label} isHovered={hoveredLink === item.key} />
              </button>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* ── Desktop right: lang/auth/download ── */}
      <div className="hidden sm:flex items-center gap-2">
        {isLoggedIn && (
          <div className="flex items-center gap-1 mr-2">
            {quantNavItems.map((item) => (
              <button
                key={item.key}
                onClick={() => navigateTo(item.path)}
                className="text-white/85 hover:text-white text-sm px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        <LangToggle />
        {isLoggedIn ? (
          <div className="flex items-center gap-2">
            <span className="text-white/70 text-sm px-3 hidden md:inline">{username}</span>
            <motion.button
              onClick={logout}
              className="h-12 px-6 bg-white rounded-full text-black font-medium hover:bg-[#e2e2e6] transition-colors text-sm"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {t('nav.logout')}
            </motion.button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => onOpenAuth('login')}
              className="h-12 px-5 bg-white/10 backdrop-blur-md rounded-full text-white text-sm hover:bg-white/20 transition-colors"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {t('nav.login')}
            </motion.button>
            <motion.button
              onClick={() => onOpenAuth('register')}
              className="h-12 px-6 bg-white rounded-full text-black text-sm flex items-center gap-2"
              whileHover={{ scale: 1.03, backgroundColor: '#e2e2e6' }}
              whileTap={{ scale: 0.97 }}
            >
              <i className="bi bi-apple" />
              <ScrambleText text={t('nav.download')} isHovered={false} />
            </motion.button>
          </div>
        )}
      </div>

      {/* ── Mobile ── */}
      <div className="flex sm:hidden items-center gap-2 w-full justify-between">
        <motion.button
          className="h-9 px-3 bg-white/15 backdrop-blur-md rounded-[10px] flex items-center gap-1.5"
          animate={{ width: menuOpen ? 0 : 'auto', opacity: menuOpen ? 0 : 1 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          style={{ overflow: 'hidden' }}
        >
          <SynapseXLogo size={14} />
          <span className="text-white text-[13px] font-medium">SynapseX</span>
        </motion.button>

        <div className="flex items-center gap-2">
          <LangToggle />
          {isLoggedIn ? (
            <motion.button
              onClick={logout}
              className="h-9 px-3.5 bg-white rounded-full text-black text-xs font-medium"
              whileTap={{ scale: 0.97 }}
            >
              {t('nav.logoutShort')}
            </motion.button>
          ) : (
            <motion.button
              onClick={() => onOpenAuth('login')}
              className="h-9 px-3.5 bg-white rounded-full text-black text-xs font-medium"
              whileTap={{ scale: 0.97 }}
            >
              {t('nav.login')}
            </motion.button>
          )}

          <motion.button
            onClick={() => setMenuOpen((v) => !v)}
            className="h-9 px-3 bg-white/15 backdrop-blur-md rounded-[10px] flex items-center justify-center"
            animate={{ width: menuOpen ? '100%' : 36 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            style={{ minWidth: 36 }}
          >
            <SquashHamburger open={menuOpen} />
          </motion.button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <motion.div
          className="absolute top-20 left-4 right-4 bg-white/10 backdrop-blur-md rounded-[14px] p-2 flex flex-col gap-1 sm:hidden max-h-[80vh] overflow-y-auto"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {[{ key: 'nav.about', label: t('nav.about'), vh: 1 }, { key: 'nav.metrics', label: t('nav.metrics'), vh: 2 }].map((item) => (
            <button
              key={item.key}
              onClick={() => {
                scrollTo(item.vh)
                setMenuOpen(false)
              }}
              className="text-left text-white/85 text-sm px-4 py-3 rounded-lg hover:bg-white/10"
            >
              {item.label}
            </button>
          ))}
          {isLoggedIn && quantNavItems.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                navigateTo(item.path)
                setMenuOpen(false)
              }}
              className="text-left text-white/85 text-sm px-4 py-3 rounded-lg hover:bg-white/10"
            >
              {item.label}
            </button>
          ))}
        </motion.div>
      )}
    </motion.nav>
  )
}
