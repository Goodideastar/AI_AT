import { useEffect, useState } from 'react'
import { marketApi, type OrderBook as OrderBookData } from '../../api/market'

interface OrderBookProps {
  symbol: string
  exchange?: string
  limit?: number
}

export default function OrderBook({ symbol, exchange = 'binance', limit = 20 }: OrderBookProps) {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await marketApi.getOrderBook(symbol, limit, exchange)
        setOrderBook(data)
        setError(null)
      } catch (err) {
        console.error('Failed to load orderbook:', err)
        setError('加载订单簿数据失败')
      } finally {
        setLoading(false)
      }
    }

    loadData()
    const intervalId = setInterval(loadData, 2000)
    return () => clearInterval(intervalId)
  }, [symbol, exchange, limit])

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-gray-400 text-center">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-red-400 text-center">{error}</div>
      </div>
    )
  }

  if (!orderBook || (orderBook.asks.length === 0 && orderBook.bids.length === 0)) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-gray-400 text-center">暂无数据</div>
      </div>
    )
  }

  // 排序：asks 升序（最低价在前，作为最佳卖价），bids 降序（最高价在前，作为最佳买价）
  const sortedAsks = [...orderBook.asks].sort((a, b) => a[0] - b[0])
  const sortedBids = [...orderBook.bids].sort((a, b) => b[0] - a[0])

  // 显示用：卖单倒序（最高价在顶部），买单保持降序（最高价紧贴中间价）
  const displayAsks = [...sortedAsks].reverse()
  const displayBids = sortedBids

  // 计算中间价：基于最佳卖价和最佳买价
  const midPrice =
    sortedAsks.length > 0 && sortedBids.length > 0
      ? (sortedAsks[0][0] + sortedBids[0][0]) / 2
      : null

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-bold text-white mb-4">{symbol} 订单簿</h3>
      <div className="grid grid-cols-2 text-xs text-gray-400 pb-2 border-b border-gray-700">
        <div>价格</div>
        <div className="text-right">数量</div>
      </div>

      {/* 卖单（红色，价格倒序，最高价在顶部） */}
      <div>
        {displayAsks.map((ask, index) => (
          <div
            key={`ask-${index}`}
            className="grid grid-cols-2 py-1 text-red-400 font-mono text-sm"
          >
            <div>{ask[0]}</div>
            <div className="text-right">{ask[1]}</div>
          </div>
        ))}
      </div>

      {/* 中间价 */}
      {midPrice !== null && (
        <div className="text-center py-2 text-white font-bold">{midPrice}</div>
      )}

      {/* 买单（绿色，价格倒序，最高价在顶部紧贴中间价） */}
      <div>
        {displayBids.map((bid, index) => (
          <div
            key={`bid-${index}`}
            className="grid grid-cols-2 py-1 text-green-400 font-mono text-sm"
          >
            <div>{bid[0]}</div>
            <div className="text-right">{bid[1]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
