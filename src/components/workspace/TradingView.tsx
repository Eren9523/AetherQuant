import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TrendingUp, Lock, CheckCircle2, Send, AlertTriangle } from 'lucide-react';

export const TradingView: React.FC = () => {
  const { paperAccount, buyStock, selectedStockSymbol } = useApp();
  const [symbol, setSymbol] = useState(selectedStockSymbol);
  const [quantity, setQuantity] = useState(100);
  const [price, setPrice] = useState(1482.35);
  const [tradeMessage, setTradeMessage] = useState('');

  const handleTrade = (action: 'BUY' | 'SELL') => {
    if (action === 'BUY') {
      const success = buyStock(symbol, quantity, price);
      if (success) {
        setTradeMessage(`模拟买入成功！成交 ${quantity} 股 @ ¥${price}`);
      } else {
        setTradeMessage('模拟买入失败：可用现金不足。');
      }
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Form */}
        <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-neutral-700" />
            模拟撮合交易下发
          </h2>

          <div className="space-y-3 text-xs font-sans">
            <div>
              <label className="font-bold text-neutral-800 block mb-1">证券代码</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full p-2.5 bg-neutral-100 rounded-xl border border-neutral-200 font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-neutral-800 block mb-1">委托单价 (CNY)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full p-2.5 bg-neutral-100 rounded-xl border border-neutral-200 font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-neutral-800 block mb-1">委托数量 (股)</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full p-2.5 bg-neutral-100 rounded-xl border border-neutral-200 font-mono focus:outline-none"
              />
            </div>

            {tradeMessage && (
              <div className="p-3 bg-neutral-900 text-white font-mono text-[11px] rounded-xl">
                {tradeMessage}
              </div>
            )}

            <div className="pt-2 flex gap-3">
              <button
                onClick={() => handleTrade('BUY')}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors"
              >
                买入 / 模拟加仓
              </button>
            </div>
          </div>
        </div>

        {/* QMT Gateway Connection Modal Preview */}
        <div className="lg:col-span-2 p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                券商 & QMT 实盘网关配置 (Mock 预留)
              </h3>
              <p className="text-xs text-neutral-400">预留迅投 QMT / PTrade 客户端 Python REST API 接口</p>
            </div>
            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-mono font-semibold rounded-lg border border-amber-200">
              当前为 Mock 仿真模式
            </span>
          </div>

          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-3 font-mono text-xs text-neutral-700">
            <div className="flex justify-between">
              <span>QMT WebSocket 监听地址:</span>
              <span className="font-bold text-neutral-900">ws://127.0.0.1:58000</span>
            </div>
            <div className="flex justify-between">
              <span>账号模式:</span>
              <span className="font-bold text-neutral-900">模拟练习账号 (Simulated #880921)</span>
            </div>
            <div className="flex justify-between">
              <span>硬性穿透式防抖重发:</span>
              <span className="font-bold text-emerald-600">ENABLED (已开启)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
