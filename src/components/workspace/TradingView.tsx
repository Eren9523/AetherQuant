import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { TrendingUp, Lock, CheckCircle2, Send, AlertTriangle } from 'lucide-react';
import { PortfolioService } from '../../services/quantServices';

export const TradingView: React.FC = () => {
  const { paperAccount, refreshPaperAccount, selectedStockSymbol, requireAuth, isAuthenticated } = useApp();
  const [symbol, setSymbol] = useState(selectedStockSymbol);
  const [quantity, setQuantity] = useState(100);
  const [price, setPrice] = useState(1482.35);
  const [tradeMessage, setTradeMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('LIMIT');
  const [orders, setOrders] = useState<any[]>([]);

  const fetchOrders = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await PortfolioService.getOrders(5, 0);
      if (res) {
        setOrders(res);
      }
    } catch (e) {
      console.error('Failed to fetch orders', e);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [isAuthenticated]);

  const handleTrade = async (action: 'BUY' | 'SELL') => {
    if (!requireAuth(() => handleTrade(action))) {
      return;
    }

    setIsSubmitting(true);
    setTradeMessage('');
    try {
      const res = await PortfolioService.placeOrder({
        symbol,
        side: action,
        orderType: orderType,
        quantity,
        limitPrice: orderType === 'LIMIT' ? price : undefined,
      });
      if (res) {
        setTradeMessage(`模拟委托提交成功！状态: ${res.status}`);
        await refreshPaperAccount();
        fetchOrders();
      }
    } catch (e: any) {
      setTradeMessage(`模拟委托失败: ${e.message || '未知错误'}`);
    } finally {
      setIsSubmitting(false);
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
              <label className="font-bold text-neutral-800 block mb-1">订单类型</label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as 'MARKET' | 'LIMIT')}
                className="w-full p-2.5 bg-neutral-100 rounded-xl border border-neutral-200 focus:outline-none"
              >
                <option value="LIMIT">限价单 (LIMIT)</option>
                <option value="MARKET">市价单 (MARKET)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-neutral-800 block mb-1">委托单价 (CNY)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                disabled={orderType === 'MARKET'}
                className="w-full p-2.5 bg-neutral-100 rounded-xl border border-neutral-200 font-mono focus:outline-none disabled:opacity-50"
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
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '提交中...' : '买入 (BUY)'}
              </button>
              <button
                onClick={() => handleTrade('SELL')}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '提交中...' : '卖出 (SELL)'}
              </button>
            </div>
          </div>
        </div>

        {/* Order History Preview */}
        <div className="lg:col-span-2 p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                近期委托记录
              </h3>
              <p className="text-xs text-neutral-400">仅显示最近 5 条 Paper Trading 委托</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            {orders.length === 0 ? (
              <div className="text-xs text-neutral-500 font-sans py-4">
                暂无委托记录
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-neutral-400 border-b border-neutral-100 uppercase font-mono">
                    <th className="py-2.5 px-3">时间</th>
                    <th className="py-2.5 px-3">代码</th>
                    <th className="py-2.5 px-3">方向</th>
                    <th className="py-2.5 px-3">数量</th>
                    <th className="py-2.5 px-3">价格</th>
                    <th className="py-2.5 px-3">状态</th>
                    <th className="py-2.5 px-3 text-right">备注</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-sans">
                  {orders.map((order: any) => (
                    <tr key={order.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-3 text-neutral-500 font-mono">
                        {new Date(order.submitted_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-3 font-bold font-mono">{order.symbol}</td>
                      <td className={`py-3 px-3 font-bold ${order.side === 'BUY' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {order.side}
                      </td>
                      <td className="py-3 px-3 font-mono">{order.quantity}</td>
                      <td className="py-3 px-3 font-mono">{order.order_type === 'MARKET' ? '市价' : `¥${order.limit_price}`}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          order.status === 'FILLED' ? 'bg-emerald-50 text-emerald-600' :
                          order.status === 'REJECTED' ? 'bg-rose-50 text-rose-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-[10px] text-neutral-400">
                        {order.reject_reason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
