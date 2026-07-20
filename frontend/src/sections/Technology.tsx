import { motion } from 'framer-motion'
import { useI18n, type TranslationKey } from '../i18n/I18nContext'

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_095750_32a52ce0-2005-45c9-9093-41f03fde9530.mp4'

interface TechItem {
  titleKey: TranslationKey
  descKey: TranslationKey
}

const ITEMS: TechItem[] = [
  { titleKey: 'tech.cortical.title', descKey: 'tech.cortical.desc' },
  { titleKey: 'tech.signal.title', descKey: 'tech.signal.desc' },
  { titleKey: 'tech.state.title', descKey: 'tech.state.desc' },
  { titleKey: 'tech.loop.title', descKey: 'tech.loop.desc' },
]

export default function Technology() {
  const { t } = useI18n()
  return (
    <section className="relative h-screen h-[100dvh] w-full overflow-hidden">
      <video
        src={VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="relative z-10 flex flex-col h-full px-8 sm:px-12 md:px-16 py-12 sm:py-16">
        {/* Top area */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
          <motion.h2
            className="text-white font-light text-[clamp(36px,8vw,72px)] leading-[0.95] tracking-[-0.03em]"
            initial={{ y: 40, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.0 }}
          >
            {t('tech.title1')}
            <br />
            {t('tech.title2')}
          </motion.h2>

          <motion.p
            className="text-white/50 text-[13px] sm:text-[15px] leading-relaxed max-w-xs md:text-right md:pt-2"
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.0, delay: 0.2 }}
          >
            {t('tech.desc')}
          </motion.p>
        </div>

        <div className="flex-1" />

        {/* Bottom grid */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.0, delay: 0.3 }}
        >
          {ITEMS.map((item, i) => (
            <motion.div
              key={item.titleKey}
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, delay: i * 0.1 }}
            >
              <h3 className="text-white text-[14px] sm:text-[16px] font-normal mb-2">{t(item.titleKey)}</h3>
              <p className="text-white/40 text-[12px] sm:text-[14px] leading-relaxed">{t(item.descKey)}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
