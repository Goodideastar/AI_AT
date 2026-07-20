import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import ScrambleIn from '../components/ScrambleIn'
import { useI18n } from '../i18n/I18nContext'

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_083515_290e5a10-0b95-41af-a5e2-32b6389baa4d.mp4'

interface HeroProps {
  onEntrance?: (complete: boolean) => void
}

export default function Hero({ onEntrance }: HeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [entranceComplete, setEntranceComplete] = useState(false)
  const isSeekingRef = useRef(false)
  const lastXRef = useRef(0)
  const { t } = useI18n()

  // Entrance after 800ms; notify parent so the Navbar can fade in too.
  useEffect(() => {
    const timer = setTimeout(() => {
      setEntranceComplete(true)
      onEntrance?.(true)
    }, 800)
    return () => clearTimeout(timer)
  }, [onEntrance])

  // Mouse-scrub the paused hero video based on horizontal delta.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleMove = (e: MouseEvent) => {
      if (isSeekingRef.current) return
      const delta = (e.clientX - lastXRef.current) * 0.8
      lastXRef.current = e.clientX

      if (Math.abs(delta) < 1) return

      const duration = video.duration || 0
      if (!duration || !isFinite(duration)) return

      let next = video.currentTime + (delta / window.innerWidth) * duration
      if (next < 0) next = 0
      if (next > duration) next = duration

      isSeekingRef.current = true
      video.currentTime = next
    }

    const handleSeeked = () => {
      isSeekingRef.current = false
    }

    window.addEventListener('mousemove', handleMove)
    video.addEventListener('seeked', handleSeeked)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      video.removeEventListener('seeked', handleSeeked)
    }
  }, [])

  return (
    <section className="relative h-screen h-[100dvh] w-full overflow-hidden">
      {/* Background video (paused, scrubbed by mouse) */}
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        className="absolute inset-0 w-full h-full object-cover"
        muted
        playsInline
        preload="auto"
      />

      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Large background watermark text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className="font-['Anton_SC'] uppercase leading-none select-none"
          style={{
            fontSize: 'clamp(120px, 30vw, 521px)',
            letterSpacing: '-4px',
            opacity: 0.10,
            transform: 'translateY(50px)',
            backgroundImage:
              'radial-gradient(circle, rgba(142,127,148,0) 0%, #8E7F94 70%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {t('hero.watermark')}
        </span>
      </div>

      {/* Content */}
      <motion.div
        className="relative z-10 flex flex-col h-full px-4 sm:px-6 md:px-8 pt-20 sm:pt-24 pb-8 sm:pb-12"
        animate={{ opacity: entranceComplete ? 1 : 0 }}
        transition={{ duration: 1 }}
      >
        <div className="flex-1" />

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          {/* Left column */}
          <div className="flex flex-col gap-4">
            <h1 className="text-white font-light leading-[0.95] tracking-[-0.03em] text-[clamp(40px,10vw,100px)]">
              <ScrambleIn text={t('hero.brain')} delay={200} triggered={entranceComplete} />
              <br />
              <ScrambleIn text={t('hero.andBody')} delay={500} triggered={entranceComplete} />
            </h1>
            <motion.p
              className="max-w-sm text-[13px] sm:text-[15px] text-white/60 leading-relaxed"
              initial={{ y: 25, opacity: 0 }}
              animate={entranceComplete ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.9, ease: [0.215, 0.61, 0.355, 1], delay: 0.2 }}
            >
              {t('hero.desc')}
            </motion.p>
          </div>

          {/* Right column */}
          <h1 className="text-white font-light leading-[0.95] tracking-[-0.03em] text-[clamp(40px,10vw,100px)] text-left md:text-right">
            <ScrambleIn text={t('hero.one')} delay={700} triggered={entranceComplete} />
            <br />
            <ScrambleIn text={t('hero.network')} delay={1000} triggered={entranceComplete} />
          </h1>
        </div>
      </motion.div>
    </section>
  )
}
