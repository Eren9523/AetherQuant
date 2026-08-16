import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { mockIndices, mockCNStocks, mockUSStocks } from '../../mocks/mockStocks';
import { TrendBadge } from '../common/TrendBadge';
import { Search, Globe, Filter, LineChart, ArrowUpDown } from 'lucide-react';

export const MarketView: React.FC = () => {
  const { navigateToStockDetail } = useApp();
  const [activeMarketTab, setActiveMarketTab] = useState<'ALL' | 'CN' | 'US'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const allStocks = [...mockCNStocks, ...mockUSStocks];
  const filteredStocks = allStocks.filter((s) => {
    const matchesMarket = activeMarketTab === 'ALL' || s.market === activeMarketTab;
    const matchesSearch =
      s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.industry.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMarket && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Global Index Cards */}
      <div>
        <h2 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-neutral-600" />
          全球主要指数行情
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {mockIndices.map((idx) => (
            <div
              key={idx.symbol}
              className="p-3.5 bg-white rounded-xl border border-neutral-200/80 shadow-2xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800 truncate">{idx.name}</span>
                <span className="text-[10px] font-mono text-neutral-400">{idx.market}</span>
              </div>
              <div className="text-base font-bold font-mono text-neutral-900">{idx.price}</div>
              <TrendBadge value={idx.changePercent} />
            </div>
          ))}
        </div>
      </div>

      {/* Market Width & Advance/Decline Stats */}
      <div className="p-5 bg-white rounded-2xl border border-neutral-200/80 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="text-xs font-semibold text-neutral-400 mb-1">A股全市场上涨/下跌数</div>
          <div className="flex items-baseline gap-3 font-mono">
            <span className="text-xl font-bold text-emerald-600">3,420 家上涨</span>
            <span className="text-sm text-rose-600">1,580 家下跌</span>
          </div>
          <div className="w-full h-2 bg-neutral-100 rounded-full mt-2 overflow-hidden flex">
            <div className="h-full bg-emerald-500" style={{ width: '68%' }} />
            <div className="h-full bg-rose-500" style={{ width: '32%' }} />
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-neutral-400 mb-1">沪深两市总成交额</div>
          <div className="text-xl font-bold font-mono text-neutral-900">¥9,800 亿元</div>
          <div className="text-xs text-neutral-500 mt-1">较前一交易日放量 +8.5%</div>
        </div>

        <div>
          <div className="text-xs font-semibold text-neutral-400 mb-1">美股三大股息/贝塔暴露</div>
          <div className="text-xl font-bold font-mono text-neutral-900">标普 500 新高</div>
          <div className="text-xs text-emerald-600 font-semibold mt-1">科技领涨 · 纳斯达克 +1.05%</div>
        </div>
      </div>

      {/* Main Stock Table Controls */}
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-neutral-100">
          {/* Market Tabs */}
          <div className="flex items-center gap-2 p-1 bg-neutral-100/80 rounded-xl w-fit">
            <button
              onClick={() => setActiveMarketTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeMarketTab === 'ALL'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              全部市场 ({allStocks.length})
            </button>
            <button
              onClick={() => setActiveMarketTab('CN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeMarketTab === 'CN'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              A 股市场 ({mockCNStocks.length})
            </button>
            <button
              onClick={() => setActiveMarketTab('US')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeMarketTab === 'US'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              美股市场 ({mockUSStocks.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索名称、代码或行业..."
              className="w-full pl-9 pr-3 py-1.5 bg-neutral-100/80 text-xs text-neutral-900 placeholder:text-neutral-400 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-400 font-medium"
            />
          </div>
        </div>

        {/* Stock List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-semibold text-neutral-400 border-b border-neutral-100 uppercase font-mono">
                <th className="py-2.5 px-3">标的名称 / 代码</th>
                <th className="py-2.5 px-3">所属行业</th>
                <th className="py-2.5 px-3">最新价</th>
                <th className="py-2.5 px-3">涨跌额</th>
                <th className="py-2.5 px-3">涨跌幅</th>
                <th className="py-2.5 px-3">成交额 / 换手</th>
                <th className="py-2.5 px-3">市盈率 PE(TTM)</th>
                <th className="py-2.5 px-3">总市值</th>
                <th className="py-2.5 px-3 text-right">终端分析</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {filteredStocks.map((st) => (
                <tr
                  key={st.symbol}
                  onClick={() => navigateToStockDetail(st.symbol)}
                  className="hover:bg-neutral-50/80 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3">
                    <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                      {st.name}
                      <span className="px-1.5 py-0.2 bg-neutral-100 border border-neutral-200 text-[10px] font-mono text-neutral-500 rounded">
                        {st.market}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-400 font-mono">{st.symbol}</div>
                  </td>
                  <td className="py-3 px-3 text-neutral-600">{st.industry}</td>
                  <td className="py-3 px-3 font-mono font-bold text-neutral-900">
                    {st.currency === 'CNY' ? '¥' : '$'}{st.price}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold">
                    {st.change > 0 ? `+${st.change}` : st.change}
                  </td>
                  <td className="py-3 px-3">
                    <TrendBadge value={st.changePercent} />
                  </td>
                  <td className="py-3 px-3 font-mono text-neutral-500">{st.turnover}</td>
                  <td className="py-3 px-3 font-mono text-neutral-700">{st.pe}</td>
                  <td className="py-3 px-3 font-mono text-neutral-700">{st.marketCap}</td>
                  <td className="py-3 px-3 text-right">
                    <button className="px-2.5 py-1 bg-neutral-900 hover:bg-black text-white text-[11px] font-semibold rounded-lg transition-colors">
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
