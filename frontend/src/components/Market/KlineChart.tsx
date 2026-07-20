import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi, CandlestickData, CandlestickSeries } from 'lightweight-charts'
import { marketApi } from '../../api/market'
import { useMarketWebSocket } from '../../hooks/useMarketWebSocket'

interface KlineChartProps {
  symbol: string
  interval?: string
}

export default function KlineChart({ symbol, interval = '1h' }: KlineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  // 最近一根 K 线的时间戳（秒），用于 WS 实时价更新该 K 线的 close
  const lastBarTimeRef = useRef<number>(0)

  // 实时行情 WebSocket（仅订阅当前 symbol）
  const { ticker, connected, error: wsError } = useMarketWebSocket(symbol, 'binance')
  const [livePrice, setLivePrice] = useState<number | null>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    // 创建图表
    chartRef.current = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: '#1f2937' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    })

    // 创建 K 线系列（v5 API：addSeries + 系列定义）
    candlestickSeriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })

    // 响应式调整
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [])

  // 加载历史 K 线（仅在 symbol/interval 变化时重新拉取，不再轮询）
  useEffect(() => {
    const loadData = async () => {
      if (!candlestickSeriesRef.current) return

      try {
        const klines = await marketApi.getKlines(symbol, interval, 200)

        const data: CandlestickData[] = klines.map(k => ({
          time: Math.floor(new Date(k.open_time).getTime() / 1000) as any,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }))

        candlestickSeriesRef.current.setData(data)

        // 记录最新 K 线时间戳，供 WS 实时更新使用
        if (data.length > 0) {
          lastBarTimeRef.current = data[data.length - 1].time as number
        }

        // 自动滚动到最新数据
        if (chartRef.current) {
          chartRef.current.timeScale().scrollToRealTime()
        }
      } catch (error) {
        console.error('Failed to load kline data:', error)
      }
    }

    loadData()
    // 切换 symbol/interval 时重置实时价
    setLivePrice(null)
  }, [symbol, interval])

  // 接收 WS 推送的实时价，更新最新一根 K 线的 close/high/low
  useEffect(() => {
    if (!ticker || !candlestickSeriesRef.current) return
    if (ticker.symbol.toUpperCase() !== symbol.toUpperCase()) return

    setLivePrice(ticker.last_price)

    // 更新图表上最新一根 K 线：close = last_price，high/low 同步刷新
    const lastBar = candlestickSeriesRef.current.data()[0] as CandlestickData | undefined
    // lightweight-charts v5 中 data() 返回的顺序可能不同，用 lastBarTimeRef 安全匹配
    if (lastBar && (lastBar.time as number) === lastBarTimeRef.current) {
      const updated: CandlestickData = {
        time: lastBar.time,
        open: lastBar.open,
        high: Math.max(lastBar.high, ticker.last_price),
        low: Math.min(lastBar.low, ticker.last_price),
        close: ticker.last_price,
      }
      candlestickSeriesRef.current.update(updated)
    }
  }, [ticker, symbol])

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">{symbol} K线图</h3>
        <div className="flex items-center gap-3 text-sm">
          {livePrice !== null && (
            <span className="font-mono text-blue-400">
              ${livePrice.toFixed(2)}
            </span>
          )}
          {/* 连接状态指示灯 */}
          <span className="flex items-center gap-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                wsError ? 'bg-red-500' : connected ? 'bg-green-500' : 'bg-gray-500'
              }`}
            />
            <span className="text-gray-400 text-xs">
              {wsError ? 'WS 错误' : connected ? '实时' : '断开'}
            </span>
          </span>
        </div>
      </div>
      <div ref={chartContainerRef} />
    </div>
  )
}
