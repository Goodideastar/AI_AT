import { useEffect, useState } from 'react'
import { marketApi, Ticker } from '../../api/market'

interface TickerListProps {
  onSelect?: (symbol: string) => void
}

const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT']

export default function TickerList({ onSelect }: TickerListProps) {
  const [tickers, setTickers] = useState<Ticker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTickers = async () => {
      try {
        const tickerData = await Promise.all(
          DEFAULT_SYMBOLS.map(symbol => marketApi.getTicker(symbol))
        )
        setTickers(tickerData)
      } catch (error) {
        console.error('Failed to load tickers:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTickers()
    const intervalId = setInterval(loadTickers, 5000)
    return () => clearInterval(intervalId)
  }, [])

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-gray-400 text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4">行情列表</h3>
      <div className="space-y-2">
        {tickers.map(ticker => (
          <div
            key={ticker.symbol}
            onClick={() => onSelect?.(ticker.symbol)}
            className="p-3 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 transition-colors"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold">{ticker.symbol}</div>
                <div className="text-xs text-gray-400">{ticker.exchange}</div>
              </div>
              <div className="text-right">
                <div className="font-mono">{ticker.last_price.toFixed(2)}</div>
                <div className="text-xs text-gray-400">
                  24h: {ticker.high_24h.toFixed(2)} / {ticker.low_24h.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
