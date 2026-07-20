import { useState } from 'react'
import Navbar from '../sections/Navbar'
import KlineChart from '../components/Market/KlineChart'
import TickerList from '../components/Market/TickerList'

interface DashboardProps {
  entranceComplete: boolean
  onOpenAuth: (mode: 'login' | 'register') => void
}

export default function Dashboard({ entranceComplete, onOpenAuth }: DashboardProps) {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')

  return (
    <div className="w-full min-h-screen bg-gray-900">
      <Navbar entranceComplete={entranceComplete} onOpenAuth={onOpenAuth} />
      
      <div className="pt-20 px-6 pb-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-6">量化交易看板</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* 左侧：行情列表 */}
            <div className="lg:col-span-1">
              <TickerList onSelect={setSelectedSymbol} />
            </div>
            
            {/* 中间：K线图 */}
            <div className="lg:col-span-3">
              <KlineChart symbol={selectedSymbol} interval="1h" />
              
              {/* 预留：订单簿和交易面板 */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">订单簿</h3>
                  <div className="text-gray-400 text-center py-8">
                    订单簿功能开发中...
                  </div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">交易面板</h3>
                  <div className="text-gray-400 text-center py-8">
                    交易功能开发中...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
