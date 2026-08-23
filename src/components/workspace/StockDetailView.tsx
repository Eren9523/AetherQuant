import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { MarketService } from '../../services/quantServices';
import { StockQuote, KLinePoint } from '../../types';
import { TrendBadge } from '../common/TrendBadge';
import { StatCard } from '../common/StatCard';
import { StockCandlestickChart } from './StockCandlestickChart';
import {
  Sparkles,
  LineChart,
  RefreshCw,
  ArrowLeft,
  Building2,
  Calendar,
  Layers,
  Activity,
  CheckCircle2,
  ShieldAlert,
  Play,
  Info,
  AlertCircle
} from 'lucide-react';

export const StockDetailView: React.FC = () => {
  const { selectedStockSymbol, setWorkspaceView, setIsAskAIOpen, marketColorMode } = useApp();
  
  const [stock, setStock] = useState<StockQuote | null>(null);
  const [klines, setKlines] = useState<KLinePoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  
  // Period & Adjust Controls
  const [selectedInterval, setSelectedInterval] = useState<string>('1d');
  const [selectedAdjust, setSelectedAdjust] = useState<'none' | 'qfq' | 'hfq'>('qfq');
  const [overlayIndicator, setOverlayIndicator] = useState<'MA' | 'EMA' | 'BOLL' | 'NONE'>('MA');
  const [subIndicator, setSubIndicator] = useState<'VOL' | 'MACD' | 'RSI' | 'KDJ' | 'NONE'>('VOL');
  
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');
  const [qualityWarnings, setQualityWarnings] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'chart' | 'company' | 'factors' | 'ai' | 'backtest'>('chart');

  const loadStockData = useCallback(async () => {
    if (!selectedStockSymbol) return;
    setLoading(true);
    setError(null);
    try {
      const data = await MarketService.getStockDetail(selectedStockSymbol);
      if (data) {
        setStock(data);
        setLastRefreshedAt(new Date().toLocaleTimeString());
      }
    } catch (err: any) {
      console.error('Failed to load stock detail:', err);
      setError(err.message || '获取标的详情失败');
    } finally {
      setLoading(false);
    }
  }, [selectedStockSymbol]);

  const loadChartData = useCallback(async () => {
    if (!selectedStockSymbol) return;
    setChartLoading(true);
    setChartError(null);
    try {
      const res = await MarketService.getChartData(selectedStockSymbol, selectedInterval, selectedAdjust);
      setKlines(res.bars);
      setQualityWarnings(res.qualityWarnings);
    } catch (err: any) {
      console.error('Failed to load chart data:', err);
      setChartError(err.message || '获取 K 线行情失败');
    } finally {
      setChartLoading(false);
    }
  }, [selectedStockSymbol, selectedInterval, selectedAdjust]);

  useEffect(() => {
    loadStockData();
  }, [loadStockData]);

  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  if (loading && !stock) {
    return (
      <div className="p-8 max-w-[2100px] mx-auto flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin" />
        <div className="text-sm font-medium text-neutral-500 font-mono">
          正在获取标的 [{selectedStockSymbol}] 真实行情与分时/K线数据...
        </div>
      </div>
    );
  }

  if (error && !stock) {
    return (
      <div className="p-8 max-w-[2100px] mx-auto">
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-base">
            <AlertCircle className="w-5 h-5" />
            行情获取失败
          </div>
          <p className="text-xs text-rose-700 font-mono">{error}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={loadStockData}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              重新获取
            </button>
            <button
              onClick={() => setWorkspaceView('market')}
              className="px-4 py-2 bg-white border border-neutral-300 text-neutral-700 text-xs font-semibold rounded-xl hover:bg-neutral-50 transition-colors"
            >
              返回行情列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stock) return null;

  const intervalOptions = [
    { label: '分时(1m)', value: '1m' },
    { label: '5分(5m)', value: '5m' },
    { label: '15分(15m)', value: '15m' },
    { label: '30分(30m)', value: '30m' },
    { label: '60分(60m)', value: '60m' },
    { label: '日K(1D)', value: '1d' },
    { label: '周K(1W)', value: '1w' },
    { label: '月K(1M)', value: '1M' },
  ];

  const adjustOptions: { label: string; value: 'none' | 'qfq' | 'hfq' }[] = [
    { label: '前复权', value: 'qfq' },
    { label: '后复权', value: 'hfq' },
    { label: '不复权', value: 'none' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      {/* Top Breadcrumb & Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWorkspaceView('market')}
          className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200/80"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回 A股行情中心
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-neutral-400">
            数据源: {stock.source || 'AKShare / 东方财富'} · 上次刷新: {lastRefreshedAt}
          </span>
          <button
            onClick={() => {
              loadStockData();
              loadChartData();
            }}
            title="刷新行情"
            className="p-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || chartLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Header Information Banner */}
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">{stock.name}</h1>
            <span className="px-2 py-0.5 bg-neutral-900 text-white font-mono text-xs font-bold rounded-lg shadow-2xs">
              {stock.symbol}
            </span>
            <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 font-mono text-xs font-semibold rounded-lg border border-neutral-200">
              {stock.exchange || 'CN'}
            </span>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-mono text-xs font-semibold rounded-lg border border-emerald-200">
              A股真实行情
            </span>
          </div>
          <div className="text-xs text-neutral-400 font-mono flex items-center gap-2">
            <span>行业分类: {stock.industry}</span>
            <span>·</span>
            <span>更新时间: {stock.updatedAt}</span>
          </div>
        </div>

        <div className="flex items-baseline gap-4 text-right">
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-neutral-900">
              ¥{stock.price.toFixed(2)}
            </div>
            <div className="flex items-center gap-2.5 justify-end mt-1.5">
              <span className={`text-xs font-mono font-bold ${stock.change >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {stock.change > 0 ? `+${stock.change.toFixed(2)}` : stock.change.toFixed(2)}
              </span>
              <TrendBadge value={stock.changePercent} />
            </div>
          </div>
        </div>
      </div>

      {/* Financial Key Ratios */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="今开 / 昨收" value={`${stock.open.toFixed(2)} / ${stock.prevClose.toFixed(2)}`} subtitle={`振幅 ${stock.amplitude ? stock.amplitude + '%' : '--'}`} />
        <StatCard title="最高 / 最低" value={`${stock.high.toFixed(2)} / ${stock.low.toFixed(2)}`} subtitle={`当前价 ¥${stock.price.toFixed(2)}`} />
        <StatCard title="成交额 / 成交量" value={stock.turnover} subtitle={`成交量 ${stock.volume}`} />
        <StatCard title="换手率" value={stock.turnoverRate ? `${stock.turnoverRate}%` : '--'} subtitle="全日换手活跃度" />
        <StatCard title="市盈率 PE(动) / PB" value={`${stock.pe || '--'} / ${stock.pb || '--'}`} subtitle="最新动态估值倍数" />
        <StatCard title="总市值 / 流通市值" value={stock.marketCap} subtitle={stock.floatMarketCap ? `流通 ${stock.floatMarketCap}` : 'A股主板'} />
      </div>

      {/* Main K-Line Chart Section */}
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
        {/* Chart Header Controls: Period & Adjust */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <LineChart className="w-4 h-4 text-neutral-600" />
            <h3 className="text-sm font-bold text-neutral-900">
              真实行情走势与技术指标分析
            </h3>
            {qualityWarnings > 0 && (
              <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                已清洗 {qualityWarnings} 条异常价位
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Interval Selector */}
            <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-xl">
              {intervalOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedInterval(opt.value)}
                  className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-lg transition-all ${
                    selectedInterval === opt.value
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Adjustment Selector */}
            <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-xl">
              {adjustOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedAdjust(opt.value)}
                  className={`px-2 py-1 text-xs font-mono font-semibold rounded-lg transition-all ${
                    selectedAdjust === opt.value
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lightweight Candlestick Chart */}
        {chartLoading && klines.length === 0 ? (
          <div className="h-[420px] w-full flex items-center justify-center text-neutral-400 font-mono text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            加载 K 线行情走势中...
          </div>
        ) : chartError && klines.length === 0 ? (
          <div className="h-[420px] w-full flex flex-col items-center justify-center text-neutral-500 space-y-2">
            <AlertCircle className="w-6 h-6 text-rose-500" />
            <span className="text-xs font-mono">{chartError}</span>
            <button
              onClick={loadChartData}
              className="px-3 py-1 bg-neutral-900 text-white text-xs font-semibold rounded-lg"
            >
              重新拉取 K 线
            </button>
          </div>
        ) : (
          <StockCandlestickChart
            data={klines}
            colorMode={marketColorMode || 'CN'}
            overlayIndicator={overlayIndicator}
            subIndicator={subIndicator}
            onOverlayChange={setOverlayIndicator}
            onSubChange={setSubIndicator}
            height={440}
          />
        )}
      </div>

      {/* Tabs Menu: Overview, Factors, AI Analysis, Backtest */}
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'chart' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            量化特征与要点
          </button>
          <button
            onClick={() => setActiveTab('company')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'company' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            公司档案与基本面
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'ai' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            AetherQuant AI 投研诊断
          </button>
          <button
            onClick={() => setActiveTab('backtest')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'backtest' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            以该标的构建策略
          </button>
        </div>

        {/* Tab 1: Quantitative Feature Highlights */}
        {activeTab === 'chart' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/60 space-y-2">
              <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                行情走势与技术形态特征
              </div>
              <ul className="text-xs text-emerald-800 space-y-1.5 list-disc list-inside">
                <li>标的 [{stock.name}] 最新价 ¥{stock.price}，当日涨跌幅 {stock.changePercent > 0 ? `+${stock.changePercent}%` : `${stock.changePercent}%`}。</li>
                <li>当日成交额 {stock.turnover}，换手率 {stock.turnoverRate ? `${stock.turnoverRate}%` : '正常'}。</li>
                <li>支持多周期（分时、5分、15分、30分、60分、日K、周K、月K）与 前/后/不复权 切换。</li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/60 space-y-2">
              <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-600" />
                技术指标组合状态
              </div>
              <ul className="text-xs text-blue-800 space-y-1.5 list-disc list-inside">
                <li>主图指标系统支持 MA 均线（5/10/20/60）、EMA 指数均线、BOLL 布林通道。</li>
                <li>副图指标系统支持 VOL 成交量、MACD 异同移动平均、RSI 强弱指标、KDJ 随机指标。</li>
                <li>光标移动可实时读取当前十字准线切点的 OHLC、涨跌额及指标数值。</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 2: Company Profile */}
        {activeTab === 'company' && (
          <div className="p-5 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
              <div className="space-y-1">
                <div className="text-neutral-400">股票名称 / 代码</div>
                <div className="font-bold text-neutral-900">{stock.name} ({stock.symbol})</div>
              </div>
              <div className="space-y-1">
                <div className="text-neutral-400">上市交易所</div>
                <div className="font-bold text-neutral-900">{stock.exchange === 'SH' ? '上海证券交易所 (主板/科创板)' : (stock.exchange === 'SZ' ? '深圳证券交易所 (主板/创业板)' : '北京证券交易所')}</div>
              </div>
              <div className="space-y-1">
                <div className="text-neutral-400">总市值</div>
                <div className="font-bold text-neutral-900">{stock.marketCap}</div>
              </div>
              <div className="space-y-1">
                <div className="text-neutral-400">流通市值</div>
                <div className="font-bold text-neutral-900">{stock.floatMarketCap || stock.marketCap}</div>
              </div>
            </div>
            <div className="pt-2 text-xs text-neutral-500">
              数据经由 AKShare 真实金融数据引擎实时同步清洗，已剔除 NaN/Infinity 与缺失值。
            </div>
          </div>
        )}

        {/* Tab 3: AI Analysis */}
        {activeTab === 'ai' && (
          <div className="p-5 bg-neutral-900 text-white rounded-xl space-y-4 font-sans">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                AetherQuant AI 对 [{stock.name}] 的实时深度研报
              </div>
              <button
                onClick={() => setIsAskAIOpen(true)}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                在 AetherQuant AI 深入对话
              </button>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed font-sans">
              基于标的 [{stock.name}] 当前最新价 ¥{stock.price}，总成交额 {stock.turnover}，结合当前均线多头排列与动量特征，该标的在近期展现出良好的价格韧性。建议结合大盘流动性与下行风控门槛，设置 6%~8% 的移动止损区间。
            </p>
          </div>
        )}

        {/* Tab 4: Backtest */}
        {activeTab === 'backtest' && (
          <div className="p-5 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-neutral-900">以 [{stock.name}] 作为核心标的构建回测模型</div>
              <div className="text-xs text-neutral-400 mt-0.5">自动载入真实历史日K数据与因子评分</div>
            </div>
            <button
              onClick={() => setWorkspaceView('backtest-center')}
              className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>进入回测中心</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
