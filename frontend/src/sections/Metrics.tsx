import { motion } from 'framer-motion'
import { useI18n, type TranslationKey } from '../i18n/I18nContext'

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_095810_ecea3dd2-fc5e-4e41-8696-4219290b6589.mp4'

const METRICS: { value: string; labelKey: TranslationKey }[] = [
  { value: '2.4ms', labelKey: 'metrics.latency' },
  { value: '99.7%', labelKey: 'metrics.accuracy' },
  { value: '140B', labelKey: 'metrics.params' },
]

export default function Metrics() {
  const { t } = useI18n()
  return (
    <section className="relative min-h-screen min-h-[100dvh] w-full overflow-hidden">
      <video
        src={VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen min-h-[100dvh] pt-32 pb-32 px-6">
        <div className="max-w-6xl w-full">
          <motion.h2
            className="text-white/40 text-[13px] sm:text-[14px] tracking-[0.2em] uppercase mb-20 text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.2 }}
          >
            {t('metrics.title')}
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8">
            {METRICS.map((m, i) => (
              <motion.div
                key={m.labelKey}
                className="flex flex-col items-center text-center"
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.8, delay: i * 0.15 }}
              >
                <div className="text-white text-[clamp(48px,10vw,96px)] font-light tracking-[-0.04em] leading-none">
                  {m.value}
                </div>
                <div className="text-white/40 text-[13px] sm:text-[15px] mt-4 tracking-wide">
                  {t(m.labelKey)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
