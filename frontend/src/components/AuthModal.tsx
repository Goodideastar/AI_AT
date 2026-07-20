import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, RefreshCw, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { generateLoginCaptcha } from '../api'
import SliderCaptcha from './SliderCaptcha'
import { useI18n } from '../i18n/I18nContext'

type Mode = 'login' | 'register'

interface AuthModalProps {
  open: boolean
  initialMode: Mode
  onClose: () => void
}

export default function AuthModal({ open, initialMode, onClose }: AuthModalProps) {
  const { login, register, sendCode } = useAuth()
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [loading, setLoading] = useState(false)
  const [codeSending, setCodeSending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [captchaOpen, setCaptchaOpen] = useState(false)

  // form fields
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [verifyCode, setVerifyCode] = useState('')

  // 隐私协议勾选状态（仅注册模式）
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)
  // 点击未勾选的注册按钮时触发跳动动画
  const [shakeKey, setShakeKey] = useState(0)

  // Login digit captcha
  const [loginCaptchaId, setLoginCaptchaId] = useState('')
  const [loginCaptchaImage, setLoginCaptchaImage] = useState('')
  const [loginCaptchaCode, setLoginCaptchaCode] = useState('')
  const [loginCaptchaLoading, setLoginCaptchaLoading] = useState(false)

  const EMAIL_RE = /^[\w\.-]+@[\w\.-]+\.\w+$/

  // Fetch login digit captcha from backend
  const fetchLoginCaptcha = useCallback(async () => {
    setLoginCaptchaLoading(true)
    setLoginCaptchaCode('')
    setFieldErrors(prev => { const { loginCaptcha, ...rest } = prev; return rest })
    try {
      const data = await generateLoginCaptcha()
      setLoginCaptchaId(data.captcha_id)
      setLoginCaptchaImage(data.image)
    } catch {
      setError(t('auth.captcha.loadFail'))
    } finally {
      setLoginCaptchaLoading(false)
    }
  }, [t])

  // Load captcha when switching to login mode or opening modal
  useEffect(() => {
    if (open && mode === 'login') {
      fetchLoginCaptcha()
    }
  }, [open, mode, fetchLoginCaptcha])

  const reset = () => {
    setUsername(''); setPassword(''); setConfirmPassword('')
    setEmail(''); setVerifyCode('')
    setError(''); setInfo('')
    setFieldErrors({})
    setAgreedToPrivacy(false)
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    reset()
  }

  // Click "发送验证码": validate fields in form order (username → email),
  // then open the slider captcha. The real send only fires after the puzzle is solved.
  const handleSendCode = () => {
    setError(''); setInfo('')
    setFieldErrors({})
    // 按表单从上到下顺序检查，第一个为空就停在该字段
    if (!username) { setFieldErrors({ username: t('auth.err.username') }); return }
    if (!email) { setFieldErrors({ email: t('auth.err.email') }); return }
    if (!EMAIL_RE.test(email)) { setFieldErrors({ email: t('auth.err.emailFormat') }); return }
    setCaptchaOpen(true)
  }

  // Countdown effect: tick every second while countdown > 0
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown(c => c - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  // Called by SliderCaptcha once the user solves the puzzle.
  const onCaptchaSuccess = async (captchaId: string) => {
    setCaptchaOpen(false)
    setCodeSending(true)
    try {
      await sendCode(username, email, captchaId)
      setInfo(t('auth.codeSent'))
      setCountdown(60)
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('auth.sendFail')
      // 根据后端返回的错误消息映射到对应字段
      if (msg.includes('用户名')) {
        setFieldErrors(prev => ({ ...prev, username: msg }))
      } else {
        setFieldErrors(prev => ({ ...prev, email: msg }))
      }
    } finally {
      setCodeSending(false)
    }
  }

  // Map backend error messages to field-level errors
  const mapFieldError = (msg: string) => {
    const lower = msg.toLowerCase()
    if (lower.includes('用户名')) return { field: 'username', msg }
    if (lower.includes('邮箱')) return { field: 'email', msg }
    if (lower.includes('密码') && lower.includes('不一致')) return { field: 'confirmPassword', msg }
    if (lower.includes('密码')) return { field: 'password', msg }
    if (lower.includes('验证码')) return { field: mode === 'login' ? 'loginCaptcha' : 'verifyCode', msg }
    return null
  }

  // Client-side validation: check fields in order, stop at first invalid one
  const validateFields = (): boolean => {
    setFieldErrors({})
    if (!username) { setFieldErrors({ username: t('auth.err.username') }); return false }
    if (mode === 'register') {
      if (!email) { setFieldErrors({ email: t('auth.err.email') }); return false }
      if (!EMAIL_RE.test(email)) { setFieldErrors({ email: t('auth.err.emailFormat') }); return false }
      if (!verifyCode) { setFieldErrors({ verifyCode: t('auth.err.code') }); return false }
    }
    if (!password) { setFieldErrors({ password: t('auth.err.password') }); return false }
    if (mode === 'login') {
      if (!loginCaptchaCode) { setFieldErrors({ loginCaptcha: t('auth.err.code') }); return false }
    }
    if (mode === 'register' && !confirmPassword) { setFieldErrors({ confirmPassword: t('auth.err.confirmPassword') }); return false }
    if (mode === 'register' && password !== confirmPassword) { setFieldErrors({ confirmPassword: t('auth.err.confirmMismatch') }); return false }
    return true
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setInfo('')
    if (!validateFields()) return
    // 注册模式未勾选隐私协议时，阻止提交并触发跳动
    if (mode === 'register' && !agreedToPrivacy) {
      setError(t('auth.err.agreeRequired'))
      setShakeKey(k => k + 1)
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(username, password, loginCaptchaId, loginCaptchaCode)
      } else {
        await register({ username, password, confirm_password: confirmPassword, email, verify_code: verifyCode })
      }
      reset()
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('auth.opFail')
      const mapped = mapFieldError(msg)
      if (mapped) {
        setFieldErrors(prev => ({ ...prev, [mapped.field]: mapped.msg }))
      } else {
        setError(msg)
      }
      // 登录模式下，验证码在后端为一次性消费，任何登录失败后都需刷新
      if (mode === 'login') {
        fetchLoginCaptcha()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 text-white"
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

            <h2 className="text-xl font-bold mb-1">
              {mode === 'login' ? t('auth.login.title') : t('auth.register.title')}
            </h2>
            <p className="text-white/40 text-xs mb-6">
              {mode === 'login' ? t('auth.login.subtitle') : t('auth.register.subtitle')}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input label={t('auth.username')} value={username} onChange={(v) => { setUsername(v); setFieldErrors(prev => { const { username, ...rest } = prev; return rest }) }} placeholder={t('auth.username.ph')} error={fieldErrors.username} />

              {mode === 'register' && (
                <Input label={t('auth.email')} type="email" value={email} onChange={(v) => { setEmail(v); setFieldErrors(prev => { const { email, ...rest } = prev; return rest }) }} placeholder="you@example.com" error={fieldErrors.email} />
              )}

              {mode === 'register' && (
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">{t('auth.code')}<span className="text-red-400 ml-0.5">*</span></label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={verifyCode}
                      onChange={(e) => { setVerifyCode(e.target.value); setFieldErrors(prev => { const { verifyCode, ...rest } = prev; return rest }) }}
                      placeholder={t('auth.code.ph')}
                      className={`flex-1 bg-white/5 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none transition-colors ${
                        fieldErrors.verifyCode ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-white/40'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={codeSending || countdown > 0}
                      className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {codeSending ? t('auth.sending') : countdown > 0 ? `${countdown}${t('auth.resend')}` : t('auth.sendCode')}
                    </button>
                  </div>
                  {fieldErrors.verifyCode && <p className="text-red-400 text-xs mt-1">{fieldErrors.verifyCode}</p>}
                </div>
              )}

              <Input label={t('auth.password')} type="password" value={password} onChange={(v) => { setPassword(v); setFieldErrors(prev => { const { password, ...rest } = prev; return rest }) }} placeholder={t('auth.password.ph')} error={fieldErrors.password} />

              {mode === 'register' && (
                <Input label={t('auth.confirmPassword')} type="password" value={confirmPassword} onChange={(v) => { setConfirmPassword(v); setFieldErrors(prev => { const { confirmPassword, ...rest } = prev; return rest }) }} placeholder={t('auth.confirmPassword.ph')} error={fieldErrors.confirmPassword} />
              )}

              {/* Login digit captcha */}
              {mode === 'login' && (
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">{t('auth.code')}<span className="text-red-400 ml-0.5">*</span></label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={loginCaptchaCode}
                      onChange={(e) => { setLoginCaptchaCode(e.target.value.toUpperCase()); setFieldErrors(prev => { const { loginCaptcha, ...rest } = prev; return rest }) }}
                      placeholder={t('auth.captcha.ph')}
                      maxLength={4}
                      className={`flex-1 bg-white/5 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none transition-colors tracking-widest ${
                        fieldErrors.loginCaptcha ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-white/40'
                      }`}
                    />
                    <div
                      className="relative w-[120px] h-[40px] rounded-lg overflow-hidden border border-white/10 cursor-pointer flex-shrink-0"
                      onClick={fetchLoginCaptcha}
                      title={t('auth.captcha.title')}
                    >
                      {loginCaptchaLoading ? (
                        <div className="w-full h-full flex items-center justify-center bg-white/5">
                          <Loader2 className="w-4 h-4 animate-spin text-white/50" />
                        </div>
                      ) : (
                        <img
                          src={`data:image/png;base64,${loginCaptchaImage}`}
                          alt={t('auth.captcha.alt')}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors">
                        <RefreshCw className="w-3.5 h-3.5 text-white/0 hover:text-white/80 transition-colors" />
                      </div>
                    </div>
                  </div>
                  {fieldErrors.loginCaptcha && <p className="text-red-400 text-xs mt-1">{fieldErrors.loginCaptcha}</p>}
                </div>
              )}

              {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
              {info && <p className="text-green-400 text-xs mt-1">{info}</p>}

              {/* 注册模式：隐私协议勾选框 */}
              {mode === 'register' && (
                <motion.div
                  key={shakeKey}
                  animate={shakeKey > 0 ? {
                    x: [0, -6, 6, -4, 4, 0],
                  } : {}}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className="flex items-start gap-2 mt-1"
                >
                  <button
                    type="button"
                    onClick={() => setAgreedToPrivacy(v => !v)}
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      agreedToPrivacy
                        ? 'bg-white border-white'
                        : 'bg-white/5 border-white/30 hover:border-white/60'
                    }`}
                    aria-pressed={agreedToPrivacy}
                  >
                    {agreedToPrivacy && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                  </button>
                  <span className="text-xs text-white/50 leading-relaxed select-none">
                    {t('auth.privacy.agree')}
                    <a
                      href="/privacy-agreement"
                      target="_blank"
                      rel="noreferrer"
                      className="text-white/80 underline underline-offset-2 hover:text-white mx-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('auth.privacy.agreement')}
                    </a>
                    {t('auth.privacy.and')}
                    <a
                      href="/privacy-policy"
                      target="_blank"
                      rel="noreferrer"
                      className="text-white/80 underline underline-offset-2 hover:text-white mx-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('auth.privacy.policy')}
                    </a>
                  </span>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`mt-2 h-11 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                  mode === 'register' && !agreedToPrivacy
                    ? 'bg-white/20 text-white/40 cursor-not-allowed'
                    : 'bg-white text-black hover:bg-white/90 disabled:opacity-50'
                }`}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'login' ? t('auth.submit.login') : t('auth.submit.register')}
              </button>
            </form>

            <p className="text-center text-xs text-white/40 mt-5">
              {mode === 'login' ? t('auth.switch.noAccount') : t('auth.switch.hasAccount')}
              <button
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                className="ml-1 text-white underline underline-offset-2 hover:text-white/80"
              >
                {mode === 'login' ? t('auth.switch.register') : t('auth.switch.login')}
              </button>
            </p>
          </motion.div>
        </motion.div>
      )}

      <SliderCaptcha
        open={captchaOpen}
        onClose={() => setCaptchaOpen(false)}
        onSuccess={onCaptchaSuccess}
      />
    </AnimatePresence>
  )
}

function Input({
  label, value, onChange, type = 'text', placeholder, error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  error?: string
}) {
  return (
    <div>
      <label className="block text-xs text-white/50 mb-1.5">
        {label}<span className="text-red-400 ml-0.5">*</span>
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className={`w-full bg-white/5 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none transition-colors ${
          error ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-white/40'
        }`}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}
