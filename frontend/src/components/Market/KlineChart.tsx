import { useEffect, useRef } from 'react'
import { createChart, IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts'
import { marketApi } from '../../api/market'

interface KlineChartProps {
  symbol: string
  interval?: string
}

export default function KlineChart({ symbol, interval = '1h' }: KlineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

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

    // 创建 K 线系列
    candlestickSeriesRef.current = chartRef.current.addCandlestickSeries({
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

  // 加载数据
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
        
        // 自动滚动到最新数据
        if (chartRef.current) {
          chartRef.current.timeScale().scrollToRealTime()
        }
      } catch (error) {
        console.error('Failed to load kline data:', error)
      }
    }

    loadData()

    // 定时刷新（每 10 秒）
    const intervalId = setInterval(loadData, 10000)
    return () => clearInterval(intervalId)
  }, [symbol, interval])

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4">{symbol} K线图</h3>
      <div ref={chartContainerRef} />
    </div>
  )
}
