import { useRef } from 'react'
import { motion, useScroll, useSpring, useTransform, useMotionTemplate } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext'

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_092455_089c54f8-3b03-4966-9df1-e9746063d0ef.mp4'

export default function CinematicText() {
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const smooth = useSpring(scrollYProgress, { stiffness: 15, damping: 32, mass: 1.8 })
  const yValue = useTransform(smooth, [0, 1], [60, -120])
  const opacity = useTransform(smooth, [0.3, 0.5], [0, 1])
  const transform = useMotionTemplate`rotateX(24deg) translateY(${yValue}px) translateZ(15px)`

  return (
    <section ref={ref} className="relative h-screen h-[100dvh] w-full overflow-hidden">
      <video
        src={VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Top gradient overlay */}
      <div
        className="absolute top-0 left-0 right-0 h-[180px] z-10"
        style={{ background: 'linear-gradient(to bottom, #010103, transparent)' }}
      />

      <div className="relative z-20 h-full flex items-center justify-center" style={{ perspective: 400 }}>
        <motion.p
          className="max-w-5xl font-sans font-normal text-[22px] sm:text-[30px] md:text-[36px] lg:text-[42px] text-white leading-[1.35] tracking-[-0.02em] select-none px-6 sm:px-12 text-center"
          style={{ transform, opacity }}
        >
          {t('cinematic.body')}
        </motion.p>
      </div>
    </section>
  )
}
