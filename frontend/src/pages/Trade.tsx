import { useEffect, useState } from 'react'
import { tradeApi, Order, Position, PlaceOrderRequest } from '../api/trade'

export default function Trade() {
  // 表单状态
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [exchange, setExchange] = useState('binance')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')

  // 列表状态
  const [positions, setPositions] = useState<Position[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  // 请求状态
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 加载持仓和订单
  const loadLists = async () => {
    setListLoading(true)
    try {
      const [posRes, ordRes] = await Promise.all([
        tradeApi.getPositions(),
        tradeApi.getOrders(),
      ])
      setPositions(posRes.data?.data ?? [])
      setOrders(ordRes.data?.data ?? [])
    } catch (err) {
      // 列表加载失败不阻塞下单，仅记录日志
      console.error('加载列表失败', err)
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => {
    loadLists()
  }, [])

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) {
      setError('请输入有效数量')
      setLoading(false)
      return
    }

    const payload: PlaceOrderRequest = {
      symbol,
      exchange,
      side,
      order_type: orderType,
      quantity: qty,
    }

    if (orderType === 'limit') {
      const p = parseFloat(price)
      if (!p || p <= 0) {
        setError('请输入有效价格')
        setLoading(false)
        return
      }
      payload.price = p
    }

    try {
      await tradeApi.placeOrder(payload)
      setSuccess('下单成功')
      setQuantity('')
      setPrice('')
      // 下单后刷新持仓和订单
      await loadLists()
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.message || '下单失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">交易面板</h1>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* 成功提示 */}
        {success && (
          <div className="bg-green-900/50 border border-green-700 rounded-lg p-4 mb-6">
            <p className="text-green-400">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：下单表单 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">下单</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">交易对</label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-full"
                >
                  <option value="BTCUSDT">BTC/USDT</option>
                  <option value="ETHUSDT">ETH/USDT</option>
                  <option value="BNBUSDT">BNB/USDT</option>
                  <option value="SOLUSDT">SOL/USDT</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">交易所</label>
                <select
                  value={exchange}
                  onChange={(e) => setExchange(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-full"
                >
                  <option value="binance">Binance</option>
                  <option value="okx">OKX</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">方向</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSide('buy')}
                    className={`rounded px-3 py-2 font-medium transition-colors ${
                      side === 'buy'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    买入
                  </button>
                  <button
                    type="button"
                    onClick={() => setSide('sell')}
                    className={`rounded px-3 py-2 font-medium transition-colors ${
                      side === 'sell'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    卖出
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">订单类型</label>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as 'market' | 'limit')}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-full"
                >
                  <option value="market">市价</option>
                  <option value="limit">限价</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">数量</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0.00"
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-full"
                />
              </div>

              {orderType === 'limit' && (
                <div>
                  <label className="block text-sm font-medium mb-2">价格</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-full"
                  />
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className={`w-full rounded px-4 py-2 font-medium transition-colors disabled:bg-gray-600 ${
                  side === 'buy'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {loading ? '下单中...' : side === 'buy' ? '买入' : '卖出'}
              </button>
            </div>
          </div>

          {/* 中间：当前持仓 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">当前持仓</h2>
            {listLoading ? (
              <div className="text-gray-400 text-center py-8">加载中...</div>
            ) : positions.length === 0 ? (
              <div className="text-gray-400 text-center py-8">暂无持仓</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left text-gray-400 py-2 px-2">交易对</th>
                      <th className="text-right text-gray-400 py-2 px-2">数量</th>
                      <th className="text-right text-gray-400 py-2 px-2">均价</th>
                      <th className="text-right text-gray-400 py-2 px-2">未实现盈亏</th>
                      <th className="text-right text-gray-400 py-2 px-2">已实现盈亏</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p) => (
                      <tr key={p.id} className="border-b border-gray-700">
                        <td className="py-2 px-2">{p.symbol}</td>
                        <td className="py-2 px-2 text-right">{p.quantity}</td>
                        <td className="py-2 px-2 text-right">{p.avg_price.toFixed(2)}</td>
                        <td className={`py-2 px-2 text-right ${
                          p.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {p.unrealized_pnl.toFixed(2)}
                        </td>
                        <td className={`py-2 px-2 text-right ${
                          p.realized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {p.realized_pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 右侧：历史订单 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">历史订单</h2>
            {listLoading ? (
              <div className="text-gray-400 text-center py-8">加载中...</div>
            ) : orders.length === 0 ? (
              <div className="text-gray-400 text-center py-8">暂无订单</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left text-gray-400 py-2 px-2">交易对</th>
                      <th className="text-left text-gray-400 py-2 px-2">方向</th>
                      <th className="text-left text-gray-400 py-2 px-2">类型</th>
                      <th className="text-right text-gray-400 py-2 px-2">数量</th>
                      <th className="text-right text-gray-400 py-2 px-2">已成交</th>
                      <th className="text-right text-gray-400 py-2 px-2">价格</th>
                      <th className="text-left text-gray-400 py-2 px-2">状态</th>
                      <th className="text-left text-gray-400 py-2 px-2">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-gray-700">
                        <td className="py-2 px-2">{o.symbol}</td>
                        <td className={`py-2 px-2 ${
                          o.side === 'buy' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {o.side === 'buy' ? '买入' : '卖出'}
                        </td>
                        <td className="py-2 px-2">{o.order_type === 'market' ? '市价' : '限价'}</td>
                        <td className="py-2 px-2 text-right">{o.quantity}</td>
                        <td className="py-2 px-2 text-right">{o.filled_quantity}</td>
                        <td className="py-2 px-2 text-right">{o.price?.toFixed(2) ?? '-'}</td>
                        <td className="py-2 px-2">{o.status}</td>
                        <td className="py-2 px-2 text-gray-400">
                          {new Date(o.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
