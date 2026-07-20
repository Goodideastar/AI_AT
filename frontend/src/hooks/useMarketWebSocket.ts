/**
 * WebSocket 实时行情订阅 Hook
 *
 * 用法：
 *   const { ticker, connected, subscribe, unsubscribe } = useMarketWebSocket('BTCUSDT', 'binance')
 *
 * 特性：
 * - JWT 鉴权：从 localStorage 读取 synapse_token，作为 query 参数传给 /ws/market
 * - 自动订阅：传入 symbol/exchange 时自动订阅，组件卸载时自动退订
 * - 断线重连：网络异常或服务端关闭后，1/2/4/8/16 秒指数退避重连，最多 5 次
 * - 心跳响应：收到服务端 ping 后自动回 pong
 * - 登录后自动建连：token 写入 localStorage 后会触发重连
 *
 * 设计要点：
 * - subscriptionsRef 表示"用户意图订阅的频道"，WS 断开时不会被清空，重连后自动恢复
 * - symbol/exchange 用 ref 同步最新值，避免闭包捕获旧值
 * - 每次重连用 localClosed 局部变量判断"是否当前 effect 实例主动关闭"，
 *   避免 React StrictMode 双挂载 + ref 共享导致的幽灵重连
 */
import { useEffect, useRef, useState, useCallback } from 'react'

const TOKEN_KEY = 'synapse_token'

// WebSocket 服务地址：与前端同源，走 Nginx 反代到后端
function buildWsUrl(token: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/market?token=${encodeURIComponent(token)}`
}

export interface TickerMessage {
  symbol: string
  exchange: string
  last_price: number
  bid?: number
  ask?: number
  volume_24h?: number
  high_24h?: number
  low_24h?: number
  timestamp: string
}

interface UseMarketWebSocketOptions {
  /** 是否启用 WS（false 时不会建立连接） */
  enabled?: boolean
}

interface UseMarketWebSocketResult {
  /** 最新行情 */
  ticker: TickerMessage | null
  /** 连接状态 */
  connected: boolean
  /** 手动订阅其他 symbol */
  subscribe: (symbol: string, exchange?: string) => void
  /** 手动退订 */
  unsubscribe: (symbol: string, exchange?: string) => void
  /** 最近一次错误 */
  error: string | null
}

export function useMarketWebSocket(
  symbol: string | null,
  exchange: string = 'binance',
  options: UseMarketWebSocketOptions = {}
): UseMarketWebSocketResult {
  const { enabled = true } = options

  const [ticker, setTicker] = useState<TickerMessage | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<number | null>(null)
  // 用户意图订阅的频道集合：(exchange, SYMBOL) → 在 WS 断开时不清空，重连后恢复
  const subscriptionsRef = useRef<Set<string>>(new Set())

  // 用 ref 跟踪最新的 symbol/exchange，避免闭包捕获旧值
  const symbolRef = useRef(symbol)
  const exchangeRef = useRef(exchange)
  useEffect(() => { symbolRef.current = symbol }, [symbol])
  useEffect(() => { exchangeRef.current = exchange }, [exchange])

  // 从 localStorage 读 token，用 state 跟踪，登录后能触发重连
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  // 监听其他 tab 的 storage 事件（同浏览器多 tab 登录/登出同步）
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        setToken(e.newValue)
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])
  // 提供 ref 让外部登录代码能触发重连：登录后调用 window.dispatchEvent(new Event('synapse:login'))
  useEffect(() => {
    const handler = () => setToken(localStorage.getItem(TOKEN_KEY))
    window.addEventListener('synapse:login', handler)
    window.addEventListener('synapse:logout', handler)
    return () => {
      window.removeEventListener('synapse:login', handler)
      window.removeEventListener('synapse:logout', handler)
    }
  }, [])

  // 发送 JSON 消息的辅助函数（仅在 WS OPEN 时发送）
  const sendMessage = useCallback((msg: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  // 订阅：更新 subscriptionsRef + 若 WS 已连接则发消息
  const subscribe = useCallback((sym: string, exch: string = 'binance') => {
    const key = `${exch}:${sym.toUpperCase()}`
    subscriptionsRef.current.add(key)
    sendMessage({ action: 'subscribe', symbol: sym.toUpperCase(), exchange: exch })
  }, [sendMessage])

  // 退订：从 subscriptionsRef 移除 + 若 WS 已连接则发消息
  const unsubscribe = useCallback((sym: string, exch: string = 'binance') => {
    const key = `${exch}:${sym.toUpperCase()}`
    subscriptionsRef.current.delete(key)
    sendMessage({ action: 'unsubscribe', symbol: sym.toUpperCase(), exchange: exch })
  }, [sendMessage])

  // 建立连接（核心 effect：在 enabled / token 变化时重建）
  useEffect(() => {
    if (!enabled) return
    if (!token) {
      setError('未登录，无法建立 WebSocket 连接')
      return
    }

    // 用局部变量标记当前 effect 实例是否已被 cleanup
    // 解决 React StrictMode 双挂载 + ref 共享导致的幽灵重连
    let localClosed = false

    const connect = () => {
      const ws = new WebSocket(buildWsUrl(token))
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setError(null)
        reconnectAttemptRef.current = 0
        // 重连后恢复所有订阅（用户意图集合）
        for (const key of subscriptionsRef.current) {
          const [exch, sym] = key.split(':')
          ws.send(JSON.stringify({ action: 'subscribe', symbol: sym, exchange: exch }))
        }
        // 不在此处订阅当前 symbol，交给下面的 effect 通过 [symbol, exchange] 处理
        // 避免重复订阅 + 闭包旧 symbol 问题
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          switch (msg.type) {
            case 'ticker':
              setTicker(msg)
              break
            case 'ping':
              // 回复 pong，保持心跳
              ws.send(JSON.stringify({ action: 'pong' }))
              break
            case 'subscribed':
            case 'unsubscribed':
              // 服务端确认订阅/退订
              break
            case 'error':
              console.warn('[WS] 服务端错误:', msg.message)
              setError(msg.message)
              break
          }
        } catch (e) {
          console.warn('[WS] 解析消息失败:', e)
        }
      }

      ws.onerror = () => {
        setError('WebSocket 连接错误')
      }

      ws.onclose = (event) => {
        setConnected(false)
        wsRef.current = null

        // 当前 effect 实例已被 cleanup（组件卸载或依赖变化），不重连
        if (localClosed) return

        // 鉴权失败 (4001) 不重连
        if (event.code === 4001) {
          setError(event.reason || '鉴权失败')
          return
        }

        // 指数退避重连：1s, 2s, 4s, 8s, 16s
        const attempt = reconnectAttemptRef.current
        if (attempt >= 5) {
          setError('重连超过 5 次，已放弃')
          return
        }
        const delay = Math.pow(2, attempt) * 1000
        reconnectAttemptRef.current += 1
        reconnectTimerRef.current = window.setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      // cleanup：标记当前 effect 实例已关闭，避免 onclose 触发幽灵重连
      localClosed = true
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [enabled, token])

  // symbol/exchange 变化时退订旧的、订阅新的
  // 注意：不依赖 connected，未连接时只更新 subscriptionsRef，等 onopen 时统一恢复
  useEffect(() => {
    if (!symbol) return
    subscribe(symbol, exchange)
    return () => {
      unsubscribe(symbol, exchange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, exchange])

  return {
    ticker,
    connected,
    subscribe,
    unsubscribe,
    error,
  }
}
