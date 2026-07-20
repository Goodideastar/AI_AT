import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translations, type Lang, type TranslationKey } from './translations'

// Re-export types so consumers can import everything from one module
export type { Lang, TranslationKey }

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'app.lang'

function detectInitialLang(): Lang {
  // 1. localStorage
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'zh' || stored === 'en') return stored
  // 2. 浏览器语言
  const navLang = navigator.language.toLowerCase()
  if (navLang.startsWith('zh')) return 'zh'
  if (navLang.startsWith('en')) return 'en'
  // 3. 默认中文
  return 'zh'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang)

  // 同步到 <html lang="..."> 和 localStorage
  useEffect(() => {
    document.documentElement.lang = lang
    localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  const setLang = useCallback((next: Lang) => setLangState(next), [])
  const toggleLang = useCallback(() => setLangState(prev => (prev === 'zh' ? 'en' : 'zh')), [])

  const t = useCallback(
    (key: TranslationKey) => {
      const entry = translations[key]
      if (!entry) return key
      return entry[lang]
    },
    [lang],
  )

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, toggleLang, t }),
    [lang, setLang, toggleLang, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider')
  return ctx
}
