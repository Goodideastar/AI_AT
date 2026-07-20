import { motion } from 'framer-motion'
import { useI18n, type TranslationKey } from '../i18n/I18nContext'

const LAYER_NAME_KEYS: TranslationKey[] = [
  'arch.layer1',
  'arch.layer2',
  'arch.layer3',
]

export default function Architecture() {
  const { t } = useI18n()
  return (
    <section className="relative min-h-screen min-h-[100dvh] w-full bg-black flex items-center justify-center">
      <div className="max-w-3xl w-full px-6 py-32">
        {/* Heading block */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1.0 }}
        >
          <p className="text-white/40 text-[13px] sm:text-[14px] tracking-[0.2em] uppercase mb-8">
            {t('arch.eyebrow')}
          </p>
          <h2 className="text-white font-light text-[clamp(28px,6vw,56px)] leading-[1.15] tracking-[-0.02em] mb-10">
            {t('arch.title')}
          </h2>
          <p className="text-white/45 text-[15px] sm:text-[17px] leading-relaxed max-w-xl mx-auto">
            {t('arch.desc')}
          </p>
        </motion.div>

        {/* Layer cards */}
        <motion.div
          className="mt-20 flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1.2, delay: 0.4 }}
        >
          {LAYER_NAME_KEYS.map((nameKey, i) => (
            <div
              key={nameKey}
              className="max-w-md w-full h-[72px] border border-white/10 rounded-lg flex items-center justify-between px-6"
            >
              <span className="text-white/30 text-[12px] tracking-[0.15em] uppercase">
                {`Layer ${i + 1}`}
              </span>
              <span className="text-white text-[16px] sm:text-[18px] font-light">
                {t(nameKey)}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
