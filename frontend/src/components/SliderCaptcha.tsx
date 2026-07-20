import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RefreshCw, Check, Loader2 } from 'lucide-react'
import { generateCaptcha, verifyCaptcha } from '../api'
import { useI18n } from '../i18n/I18nContext'

interface SliderCaptchaProps {
  open: boolean
  onClose: () => void
  onSuccess: (captchaId: string) => void
}

// Canvas display dimensions (CSS px) — matches the backend's 320×180 generation
const W = 320
const H = 180
const PIECE_W = 56 // PUZZLE_SIZE(44) + 12 for protruding tab
const PIECE_START_X = 6 // where the piece sits at slider position 0

export default function SliderCaptcha({ open, onClose, onSuccess }: SliderCaptchaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bgImgRef = useRef<HTMLImageElement | null>(null)
  const pieceImgRef = useRef<HTMLImageElement | null>(null)
  const { t } = useI18n()

  const [captchaId, setCaptchaId] = useState('')
  const [targetY, setTargetY] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [dragging, setDragging] = useState(false)
  const [sliderX, setSliderX] = useState(0) // 0..maxSliderX
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'fail'>('idle')

  const maxX = W - PIECE_W
  const maxSliderX = maxX - PIECE_START_X

  // --- Fetch puzzle from backend ---
  const fetchCaptcha = useCallback(async () => {
    setLoading(true)
    setError('')
    setSliderX(0)
    setStatus('idle')
    try {
      const data = await generateCaptcha()
      setCaptchaId(data.captcha_id)
      setTargetY(data.y)

      // Preload images
      const [bgImg, pieceImg] = await Promise.all([
        loadImage(data.bg_image),
        loadImage(data.piece_image),
      ])
      bgImgRef.current = bgImg
      pieceImgRef.current = pieceImg
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(msg === 'IMAGE_LOAD_FAIL' ? t('slider.imgLoadFail') : (msg || t('slider.loadFail')))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (open) fetchCaptcha()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // --- Canvas repaint ---
  const repaint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, W, H)

    // Draw background
    if (bgImgRef.current) {
      ctx.drawImage(bgImgRef.current, 0, 0, W, H)
    }

    // Draw puzzle piece at current slider position
    if (pieceImgRef.current) {
      const pieceX = PIECE_START_X + (sliderX / maxSliderX) * (maxX - PIECE_START_X)
      ctx.drawImage(pieceImgRef.current, pieceX, targetY, PIECE_W, PIECE_W)
    }
  }, [sliderX, targetY, maxSliderX])

  useEffect(() => {
    if (!loading && bgImgRef.current) repaint()
  }, [loading, sliderX, repaint])

  // --- Drag handling ---
  const dragStartXRef = useRef(0)

  const onPointerDown = (e: React.PointerEvent) => {
    if (status === 'verifying' || status === 'success' || loading) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartXRef.current = e.clientX
    setDragging(true)
    setStatus('idle')
    setError('')
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const delta = e.clientX - dragStartXRef.current
    setSliderX(Math.max(0, Math.min(maxSliderX, delta)))
  }

  const onPointerUp = async () => {
    if (!dragging) return
    setDragging(false)

    // Compute canvas X coordinate of the piece's left edge
    const pieceX = PIECE_START_X + (sliderX / maxSliderX) * (maxX - PIECE_START_X)
    // The puzzle hole starts at (pieceX + 6) relative to canvas (offset by the tab padding)
    const holeX = Math.round(pieceX + 6)

    setStatus('verifying')
    try {
      const result = await verifyCaptcha(captchaId, holeX)
      if (result.success) {
        setStatus('success')
        setTimeout(() => onSuccess(captchaId), 600)
      } else {
        setStatus('fail')
        setTimeout(() => {
          setSliderX(0)
          setStatus('idle')
        }, 700)
      }
    } catch {
      setStatus('fail')
      setError(t('slider.verifyFail'))
      setTimeout(() => {
        setSliderX(0)
        setStatus('idle')
      }, 700)
    }
  }

  const progressPct = (sliderX / maxSliderX) * 100

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            className="relative w-[360px] rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 text-white"
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold mb-1">{t('slider.title')}</h3>
            <p className="text-white/40 text-xs mb-4">{t('slider.desc')}</p>

            {/* Canvas puzzle */}
            <div className="relative rounded-lg overflow-hidden border border-white/10 mb-4">
              {loading ? (
                <div className="w-full flex items-center justify-center bg-white/5" style={{ height: H }}>
                  <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                </div>
              ) : (
                <canvas ref={canvasRef} width={W} height={H} className="block w-full" />
              )}

              {status === 'success' && !loading && (
                <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                  <span className="flex items-center gap-2 text-green-300 text-sm font-medium">
                    <Check className="w-5 h-5" /> {t('slider.success')}
                  </span>
                </div>
              )}
              {status === 'fail' && !loading && (
                <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                  <span className="text-red-300 text-sm font-medium">{t('slider.fail')}</span>
                </div>
              )}

              <button
                onClick={fetchCaptcha}
                disabled={loading || status === 'success'}
                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-md bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-colors disabled:opacity-40"
                title={t('slider.refresh')}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

            {/* Slider track */}
            <div className="relative h-11 select-none">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-white/10" />
              <div
                className={`absolute left-0 top-1/2 -translate-y-1/2 h-2 rounded-full transition-colors ${
                  status === 'success' ? 'bg-green-500' : status === 'fail' ? 'bg-red-500' : 'bg-white/30'
                }`}
                style={{ width: `${progressPct}%` }}
              />
              {sliderX === 0 && status === 'idle' && !loading && (
                <span className="absolute inset-0 flex items-center justify-center text-white/30 text-xs pointer-events-none">
                  {t('slider.hint')}
                </span>
              )}
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing touch-none ${
                  status === 'success' ? 'bg-green-500' : status === 'fail' ? 'bg-red-500' : 'bg-white text-black'
                }`}
                style={{ left: `${Math.min(progressPct, 100)}%` }}
              >
                {status === 'verifying' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : status === 'success' ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 7l-4 5 4 5M16 7l4 5-4 5" />
                  </svg>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// --- Utility: load a base64 image string into an HTMLImageElement ---
// Throws Error with code IMAGE_LOAD_FAIL on failure; caller translates.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('IMAGE_LOAD_FAIL'))
    img.src = `data:image/png;base64,${src}`
  })
}
