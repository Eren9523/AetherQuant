import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useApp } from '../../context/AppContext';
import { MarketService } from '../../services/quantServices';
import { StockQuote, MarketOverviewStats } from '../../types';
import { TrendBadge } from '../common/TrendBadge';
import {
  Search,
  Globe,
  ArrowUpDown,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  ChevronLeft,
  ChevronRight,
  Database,
  AlertCircle
} from 'lucide-react';

export const MarketView: React.FC = () => {
  const { navigateToStockDetail, marketColorMode } = useApp();
  const colorMode = marketColorMode || 'CN';

  // State
  const [indices, setIndices] = useState<StockQuote[]>([]);
  const [overview, setOverview] = useState<MarketOverviewStats | null>(null);
  const [stocks, setStocks] = useState<StockQuote[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  
  // Filters & Pagination
  const [exchangeFilter, setExchangeFilter] = useState<'ALL' | 'SH' | 'SZ' | 'BJ'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('change_pct');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const [loading, setLoading] = useState<boolean>(true);
  const [indicesLoading, setIndicesLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [asOfTime, setAsOfTime] = useState<string>('');
  const [isCached, setIsCached] = useState<boolean>(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load Indices & Overview
  const loadMarketSummary = useCallback(async () => {
    setIndicesLoading(true);
    try {
      const [idxData, ovData] = await Promise.all([
        MarketService.getIndices(),
        MarketService.getMarketOverview()
      ]);
      setIndices(idxData);
      setOverview(ovData);
    } catch (err: any) {
      console.warn('Failed to load market summary:', err);
    } finally {
      setIndicesLoading(false);
    }
  }, []);

  // Load Stock Table Data
  const loadStocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await MarketService.getStocks({
        market: 'CN',
        page: currentPage,
        pageSize,
        search: debouncedSearch,
        sortBy,
        sortOrder,
        exchange: exchangeFilter === 'ALL' ? undefined : exchangeFilter,
      });

      setStocks(res.stocks);
      setTotalCount(res.total);
      setAsOfTime(res.asOf ? new Date(res.asOf).toLocaleTimeString() : new Date().toLocaleTimeString());
      setIsCached(Boolean(res.cached));
    } catch (err: any) {
      console.error('Failed to load stocks:', err);
      setError(err.message || '加载 A 股真实行情失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, sortBy, sortOrder, exchangeFilter]);

  useEffect(() => {
    loadMarketSummary();
  }, [loadMarketSummary]);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  const handleSort = (colKey: string) => {
    if (sortBy === colKey) {
      setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(colKey);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      {/* Top Header & Refresh Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
            <Globe className="w-6 h-6 text-neutral-800" />
            A股实时行情中心
          </h1>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            全市场真实行情直连 · AKShare / 东方财富数据通道
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-neutral-400 font-mono flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
            <span>{asOfTime ? `更新于 ${asOfTime}` : '实时同步中'}</span>
            {isCached && <span className="px-1.5 py-0.2 bg-neutral-100 text-neutral-500 rounded text-[10px]">缓存优化</span>}
          </div>

          <button
            onClick={() => {
              loadMarketSummary();
              loadStocks();
            }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>刷新数据</span>
          </button>
        </div>
      </div>

      {/* Real Market Major Indices */}
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3.5">
          {indices.map((idx) => (
            <div
              key={idx.symbol}
              className="p-4 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs space-y-2 hover:shadow-xs transition-shadow"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 truncate">{idx.name}</span>
                <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                  {idx.symbol}
                </span>
              </div>
              <div className="text-xl font-extrabold font-mono text-neutral-900 tracking-tight">
                {idx.price.toFixed(2)}
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className={`text-xs font-mono font-bold ${idx.change >= 0 ? (colorMode === 'CN' ? 'text-rose-600' : 'text-emerald-600') : (colorMode === 'CN' ? 'text-emerald-600' : 'text-rose-600')}`}>
                  {idx.change > 0 ? `+${idx.change.toFixed(2)}` : idx.change.toFixed(2)}
                </span>
                <TrendBadge value={idx.changePercent} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Breadth & Advance/Decline Stats */}
      {overview && (
        <div className="p-5 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Breadth */}
          <div>
            <div className="text-xs font-semibold text-neutral-400 mb-1 flex items-center justify-between">
              <span>全市场涨跌分布</span>
              <span className="font-mono text-[11px] text-neutral-500">共 {overview.totalCount} 只</span>
            </div>
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-base font-bold text-rose-600 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {overview.upCount} 家上涨
              </span>
              <span className="text-xs text-neutral-400">{overview.flatCount} 平</span>
              <span className="text-base font-bold text-emerald-600 flex items-center gap-1">
                <TrendingDown className="w-4 h-4" />
                {overview.downCount} 家下跌
              </span>
            </div>
            <div className="w-full h-2 bg-neutral-100 rounded-full mt-2.5 overflow-hidden flex">
              <div
                className="h-full bg-rose-500 transition-all duration-500"
                style={{ width: `${overview.totalCount > 0 ? (overview.upCount / overview.totalCount) * 100 : 50}%` }}
              />
              <div
                className="h-full bg-neutral-300 transition-all duration-500"
                style={{ width: `${overview.totalCount > 0 ? (overview.flatCount / overview.totalCount) * 100 : 0}%` }}
              />
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${overview.totalCount > 0 ? (overview.downCount / overview.totalCount) * 100 : 50}%` }}
              />
            </div>
          </div>

          {/* Aggregate Turnover */}
          <div>
            <div className="text-xs font-semibold text-neutral-400 mb-1">沪深京两市总成交额</div>
            <div className="text-xl font-bold font-mono text-neutral-900">
              ¥{(overview.totalTurnover / 100000000).toFixed(2)} 亿元
            </div>
            <div className="text-xs text-neutral-500 mt-1 font-mono">
              全市场平均涨跌幅: <strong className={overview.avgChangePct >= 0 ? 'text-rose-600' : 'text-emerald-600'}>
                {overview.avgChangePct > 0 ? `+${overview.avgChangePct}%` : `${overview.avgChangePct}%`}
              </strong>
            </div>
          </div>

          {/* Limit Ups and Downs */}
          <div>
            <div className="text-xs font-semibold text-neutral-400 mb-1">涨跌停统计 (≥9.8% / ≤-9.8%)</div>
            <div className="flex items-baseline gap-4 font-mono">
              <div className="text-base font-bold text-rose-600">
                涨停 <span className="text-xl">{overview.limitUpCount}</span> 家
              </div>
              <div className="text-base font-bold text-emerald-600">
                跌停 <span className="text-xl">{overview.limitDownCount}</span> 家
              </div>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">市场情绪指数真实度量</div>
          </div>
        </div>
      )}

      {/* Main Stock Table Container */}
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs space-y-5">
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-neutral-100">
          {/* Exchange Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-100/80 rounded-xl w-fit">
            {[
              { id: 'ALL', label: '全部 A 股' },
              { id: 'SH', label: '沪市 (SH)' },
              { id: 'SZ', label: '深市 (SZ)' },
              { id: 'BJ', label: '北交所 (BJ)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setExchangeFilter(tab.id as any);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  exchangeFilter === tab.id
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索股票代码 (如 600519) 或名称..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-neutral-100/80 text-xs text-neutral-900 placeholder:text-neutral-400 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-400 font-medium"
            />
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-800 text-xs font-mono">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadStocks}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-sans font-semibold"
            >
              重试
            </button>
          </div>
        )}

        {/* Stock Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-semibold text-neutral-400 border-b border-neutral-100 uppercase font-mono">
                <th className="py-3 px-3.5">
                  <button onClick={() => handleSort('symbol')} className="flex items-center gap-1 hover:text-neutral-800">
                    标的代码 / 名称
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3.5">交易所</th>
                <th className="py-3 px-3.5">最新价</th>
                <th className="py-3 px-3.5">涨跌额</th>
                <th className="py-3 px-3.5">
                  <button onClick={() => handleSort('change_pct')} className="flex items-center gap-1 hover:text-neutral-800 text-neutral-900 font-bold">
                    涨跌幅
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3.5">
                  <button onClick={() => handleSort('turnover')} className="flex items-center gap-1 hover:text-neutral-800">
                    成交额
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3.5">
                  <button onClick={() => handleSort('turnover_rate')} className="flex items-center gap-1 hover:text-neutral-800">
                    换手率
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3.5">
                  <button onClick={() => handleSort('pe_dynamic')} className="flex items-center gap-1 hover:text-neutral-800">
                    市盈率 PE(动)
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3.5">
                  <button onClick={() => handleSort('total_market_cap')} className="flex items-center gap-1 hover:text-neutral-800">
                    总市值
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3.5 text-right">终端分析</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {loading && stocks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-neutral-400 font-mono">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-neutral-500" />
                    正在从量化引擎载入真实行情...
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-neutral-400 font-mono">
                    未查询到符合条件的标的
                  </td>
                </tr>
              ) : (
                stocks.map((st) => (
                  <tr
                    key={st.symbol}
                    onClick={() => navigateToStockDetail(st.symbol)}
                    className="hover:bg-neutral-50/90 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-3.5">
                      <div className="font-bold text-neutral-900 group-hover:text-black">
                        {st.name}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono">{st.symbol}</div>
                    </td>
                    <td className="py-3.5 px-3.5">
                      <span className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 text-[10px] font-mono text-neutral-600 rounded">
                        {st.exchange || 'CN'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 font-mono font-bold text-neutral-900">
                      ¥{st.price.toFixed(2)}
                    </td>
                    <td className={`py-3.5 px-3.5 font-mono font-semibold ${st.change >= 0 ? (colorMode === 'CN' ? 'text-rose-600' : 'text-emerald-600') : (colorMode === 'CN' ? 'text-emerald-600' : 'text-rose-600')}`}>
                      {st.change > 0 ? `+${st.change.toFixed(2)}` : st.change.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <TrendBadge value={st.changePercent} />
                    </td>
                    <td className="py-3.5 px-3.5 font-mono text-neutral-600">{st.turnover}</td>
                    <td className="py-3.5 px-3.5 font-mono text-neutral-600">
                      {st.turnoverRate ? `${st.turnoverRate}%` : '--'}
                    </td>
                    <td className="py-3.5 px-3.5 font-mono text-neutral-700">{st.pe || '--'}</td>
                    <td className="py-3.5 px-3.5 font-mono text-neutral-700">{st.marketCap}</td>
                    <td className="py-3.5 px-3.5 text-right">
                      <button className="px-3 py-1 bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white text-neutral-700 text-[11px] font-semibold rounded-lg transition-colors">
                        深度走势
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-neutral-100 text-xs text-neutral-500 font-mono">
          <div>
            显示第 {(currentPage - 1) * pageSize + 1} 至 {Math.min(currentPage * pageSize, totalCount)} 条，共 {totalCount} 只标的
          </div>

          <div className="flex items-center gap-3">
            {/* Page Size selector */}
            <div className="flex items-center gap-1.5">
              <span>每页:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-neutral-100 text-neutral-800 rounded px-2 py-1 text-xs focus:outline-none"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Page navigator */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="p-1.5 bg-neutral-100 rounded-lg text-neutral-700 hover:bg-neutral-200 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-bold text-neutral-800">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                className="p-1.5 bg-neutral-100 rounded-lg text-neutral-700 hover:bg-neutral-200 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
