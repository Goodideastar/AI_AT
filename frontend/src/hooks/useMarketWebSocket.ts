/**
 * WebSocket 实时行情订阅 Hook
 *
 * 用法：
 *   const { lastPrice, connected, subscribe, unsubscribe } = useMarketWebSocket('BTCUSDT', 'binance')
 *
 * 特性：
 * - JWT 鉴权：从 localStorage 读取 synapse_token，作为 query 参数传给 /ws/market
 * - 自动订阅：传入 symbol/exchange 时自动订阅，组件卸载时自动退订
 * - 断线重连：网络异常或服务端关闭后，1/2/4/8/16 秒指数退避重连，最多 5 次
 * - 心跳响应：收到服务端 ping 后自动回 pong
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
  const subscriptionsRef = useRef<Set<string>>(new Set())  // 已订阅的 (exchange, symbol)
  const closedByUserRef = useRef(false)  // 组件卸载触发的关闭，不重连

  // 发送 JSON 消息的辅助函数
  const sendMessage = useCallback((msg: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  // 订阅/退订对外暴露的方法
  const subscribe = useCallback((sym: string, exch: string = 'binance') => {
    const key = `${exch}:${sym.toUpperCase()}`
    subscriptionsRef.current.add(key)
    sendMessage({ action: 'subscribe', symbol: sym.toUpperCase(), exchange: exch })
  }, [sendMessage])

  const unsubscribe = useCallback((sym: string, exch: string = 'binance') => {
    const key = `${exch}:${sym.toUpperCase()}`
    subscriptionsRef.current.delete(key)
    sendMessage({ action: 'unsubscribe', symbol: sym.toUpperCase(), exchange: exch })
  }, [sendMessage])

  // 建立连接
  useEffect(() => {
    if (!enabled) return

    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setError('未登录，无法建立 WebSocket 连接')
      return
    }

    closedByUserRef.current = false

    const connect = () => {
      const ws = new WebSocket(buildWsUrl(token))
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setError(null)
        reconnectAttemptRef.current = 0
        // 重新订阅之前所有频道
        for (const key of subscriptionsRef.current) {
          const [exch, sym] = key.split(':')
          ws.send(JSON.stringify({ action: 'subscribe', symbol: sym, exchange: exch }))
        }
        // 如果有初始 symbol，也订阅
        if (symbol) {
          subscribe(symbol, exchange)
        }
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
              // 服务端确认订阅
              break
            case 'unsubscribed':
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

        // 用户主动关闭（组件卸载），不重连
        if (closedByUserRef.current) return

        // 鉴权失败（4001）不重连
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
      // 组件卸载：清理
      closedByUserRef.current = true
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])  // 仅在 enabled 变化时重连，symbol/exchange 通过 subscribe/unsubscribe 处理

  // symbol/exchange 变化时退订旧的、订阅新的
  useEffect(() => {
    if (!connected || !symbol) return
    subscribe(symbol, exchange)
    return () => {
      unsubscribe(symbol, exchange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, exchange, connected])

  return {
    ticker,
    connected,
    subscribe,
    unsubscribe,
    error,
  }
}
