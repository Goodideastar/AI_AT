import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Menu, X } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260713_234424_b1332b69-2e69-4302-8dbc-40f86846afbd.mp4'

const NAV_LINKS = ['About Us', 'Programs', 'Reviews', 'FAQ', 'Contacts']

function Logo() {
  return (
    <div className="flex items-center">
      <div className="grid grid-cols-2 gap-0.5">
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
      </div>
      <span className="text-white font-bold text-lg sm:text-xl ml-1">TinyTrails</span>
    </div>
  )
}

export default function NotFound() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scaleY, setScaleY] = useState(1)
  const textRef = useRef<HTMLDivElement>(null)
  const { lang, toggleLang, t } = useI18n()

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  // Measure the background "404" text height and compute the vertical scale
  // (window.innerHeight / offsetHeight) * 1.4, re-running on resize.
  useEffect(() => {
    const updateScale = () => {
      const el = textRef.current
      if (!el) return
      const height = el.offsetHeight
      if (height > 0) {
        setScaleY((window.innerHeight / height) * 1.4)
      }
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col relative">
      {/* Page gradient background */}
      <div
        className="absolute inset-0 -z-10"
        style={{ background: 'linear-gradient(to bottom, #FF8233 0%, #FDAC55 100%)' }}
      />

      {/* Background "404" text + oval effect */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        style={{
          opacity: 0.8,
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 95%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 95%)',
        }}
      >
        <div
          ref={textRef}
          className="text-white font-black leading-none tracking-tighter whitespace-nowrap"
          style={{
            fontSize: 'clamp(200px, 48vw, 800px)',
            transform: `scale(1.15, ${scaleY * 1.4})`,
          }}
        >
          404
        </div>
        <div
          className="absolute bg-white rounded-full"
          style={{
            height: 'var(--oval-h)',
            width: 'clamp(120px, 20vw, 400px)',
            transform: `scaleY(${scaleY})`,
            transformOrigin: 'center',
          }}
        />
      </div>
      {/* Responsive oval height via inline style vars (Tailwind arbitrary values can't
          be set dynamically, so we mirror the spec's breakpoints here). */}
      <style>{`
        :root { --oval-h: 22vh; }
        @media (min-width: 640px) { :root { --oval-h: 26vh; } }
        @media (min-width: 768px) { :root { --oval-h: 50vh; } }
      `}</style>

      {/* Navigation bar */}
      <nav className="relative z-20 flex flex-row items-center justify-between px-4 sm:px-6 md:px-12 py-4 sm:py-5">
        <Logo />

        <div className="hidden md:flex gap-1">
          {NAV_LINKS.map((label) => (
            <a
              key={label}
              href="/"
              className="px-4 py-1.5 text-sm font-medium rounded-full bg-white hover:opacity-90 transition-colors"
              style={{ color: '#F16524' }}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleLang}
            className="px-3 py-2 rounded-full text-white text-sm font-medium border border-white/40 hover:bg-white/10 transition-colors"
            title={lang === 'zh' ? t('lang.toggleToEn') : t('lang.toggleToZh')}
          >
            <span className="opacity-60">{lang === 'zh' ? '中' : 'EN'}</span>
            <span className="opacity-40 mx-0.5">/</span>
            <span>{lang === 'zh' ? 'EN' : '中'}</span>
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-white hover:opacity-90 transition-colors"
            style={{ background: '#F16524' }}
          >
            <Menu className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">{t('notfound.menu')}</span>
          </button>
        </div>
      </nav>

      {/* Center video */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ marginTop: 'calc(-6vh - 40px)' }}
      >
        <div className="w-[120vw] h-[85vh] sm:w-[70vw] sm:h-[70vh] md:w-[62vw] md:h-[78vh]">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-contain pointer-events-none mix-blend-darken"
          >
            <source src={VIDEO_SRC} type="video/mp4" />
          </video>
        </div>
      </div>

      {/* Bottom content */}
      <div className="relative z-30 mt-auto pb-8 sm:pb-16 flex flex-col items-center text-center px-4">
        <h1 className="text-white text-lg sm:text-xl md:text-2xl font-medium mb-3 sm:mb-4">
          {t('notfound.title')}
        </h1>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 rounded-full text-white font-semibold text-sm sm:text-base hover:scale-105 hover:shadow-lg transition-all"
          style={{ background: '#F16524' }}
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          {t('notfound.back')}
        </a>
      </div>

      {/* Mobile menu overlay */}
      <div
        className={`fixed inset-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          menuOpen ? 'visible' : 'invisible'
        }`}
      >
        {/* Backdrop */}
        <div
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-500 ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Panel */}
        <div
          className={`absolute top-0 right-0 h-full w-full sm:w-[380px] flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            menuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{
            background: 'linear-gradient(135deg, #FF6B1A 0%, #FF9642 100%)',
          }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between p-6">
            <Logo />
            <button
              onClick={() => setMenuOpen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Menu items */}
          <div className="flex flex-col gap-3 px-6 mt-4">
            {NAV_LINKS.map((label, i) => (
              <a
                key={label}
                href="/"
                className="px-6 py-4 text-lg font-semibold text-white rounded-2xl bg-white/10 hover:bg-white/20 transition-all duration-300"
                style={{
                  opacity: menuOpen ? 1 : 0,
                  transform: menuOpen ? 'translateY(0)' : 'translateY(1rem)',
                  transitionDelay: menuOpen ? `${150 + i * 60}ms` : '0ms',
                }}
              >
                {label}
              </a>
            ))}
          </div>

          {/* Bottom CTA */}
          <a
            href="/"
            className="absolute bottom-0 left-0 right-0 p-6"
            style={{
              opacity: menuOpen ? 1 : 0,
              transition: 'opacity 450ms',
              transitionDelay: menuOpen ? '450ms' : '0ms',
            }}
          >
            <span className="w-full py-4 rounded-full bg-white font-semibold text-base flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
              style={{ color: '#F16524' }}
            >
              <ArrowLeft className="w-4 h-4" />
              {t('notfound.back')}
            </span>
          </a>
        </div>
      </div>
    </div>
  )
}
