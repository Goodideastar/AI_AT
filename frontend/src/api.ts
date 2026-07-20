const API_BASE = '/api'

interface ApiError {
  detail: string
}

export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err: ApiError = await res.json().catch(() => ({ detail: '请求失败' }))
    throw new Error(err.detail)
  }
  return res.json()
}

export async function apiAuthPost<T>(endpoint: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err: ApiError = await res.json().catch(() => ({ detail: '请求失败' }))
    throw new Error(err.detail)
  }
  return res.json()
}

// ── Auth API ──

export interface RegisterParams {
  username: string
  password: string
  confirm_password: string
  email: string
  verify_code: string
}

export interface LoginParams {
  username: string
  password: string
  captcha_id: string
  captcha_code: string
}

export interface SendCodeParams {
  username: string
  email: string
  captcha_id: string
}

export interface DestroyParams {
  password: string
}

export interface AuthResponse {
  username: string
  message: string
  token: string
}

export function sendVerifyCode(data: SendCodeParams) {
  return apiPost<{ message: string }>('/send_verify_code', data)
}

export function register(data: RegisterParams) {
  return apiPost<AuthResponse>('/register', data)
}

export function login(data: LoginParams) {
  return apiPost<AuthResponse>('/login', data)
}

export function logout(token: string) {
  return apiAuthPost<{ message: string }>('/logout', {}, token)
}

export function destroyAccount(data: DestroyParams, token: string) {
  return apiAuthPost<{ message: string }>('/destroy', data, token)
}

// ── Captcha API ──

export interface CaptchaGenerateResponse {
  captcha_id: string
  bg_image: string   // base64 PNG
  piece_image: string // base64 PNG
  y: number
}

export interface CaptchaVerifyResponse {
  success: boolean
  message: string
}

export function generateCaptcha() {
  return apiPost<CaptchaGenerateResponse>('/captcha/generate', {})
}

export function verifyCaptcha(captcha_id: string, x: number) {
  return apiPost<CaptchaVerifyResponse>('/captcha/verify', { captcha_id, x })
}

// ── Login Digit Captcha API ──

export interface LoginCaptchaResponse {
  captcha_id: string
  image: string // base64 PNG
}

export function generateLoginCaptcha() {
  return apiPost<LoginCaptchaResponse>('/captcha/login/generate', {})
}
