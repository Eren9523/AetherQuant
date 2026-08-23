import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MarketService } from '../../services/quantServices';
import { StockQuote, KLinePoint } from '../../types';
import { TrendBadge } from '../common/TrendBadge';
import { StatCard } from '../common/StatCard';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Sparkles, LineChart, Cpu, FileText, Play, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';

export const StockDetailView: React.FC = () => {
  const { selectedStockSymbol, setWorkspaceView, setIsAskAIOpen } = useApp();
  const [stock, setStock] = useState<StockQuote | null>(null);
  const [klines, setKlines] = useState<KLinePoint[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1M');
  const [activeTab, setActiveTab] = useState<'overview' | 'factors' | 'financials' | 'ai' | 'backtest'>('overview');

  useEffect(() => {
    async function loadData() {
      const data = await MarketService.getStockDetail(selectedStockSymbol);
      if (data) setStock(data);
      const kData = await MarketService.getKLines(selectedStockSymbol, selectedPeriod);
      setKlines(kData);
    }
    loadData();
  }, [selectedStockSymbol, selectedPeriod]);

  if (!stock) {
    return <div className="p-8 text-neutral-400">加载股票数据中...</div>;
  }

  const factorScores = [
    { name: '动量因子 (MOM)', score: 86, desc: '60日趋势极强，站在均线系统之上' },
    { name: '质量因子 (ROE)', score: 79, desc: 'ROE TTM 维持 28.5%，现金流极其健康' },
    { name: '低波动因子 (VOL)', score: 68, desc: '20日年化波动率 18.2%，震荡上行' },
    { name: '成长因子 (REV)', score: 74, desc: '营收同比增速 14.8%' },
    { name: '估值因子 (EP)', score: 54, desc: 'PE TTM 23.8，处于历史 42% 分位' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      {/* Top Header Information Banner */}
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">{stock.name}</h1>
            <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 font-mono text-xs font-bold rounded border border-neutral-200">
              {stock.symbol}
            </span>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 font-mono text-xs font-semibold rounded border border-emerald-200">
              {stock.market === 'CN' ? 'A股 · 交易中' : '美股 · 实时'}
            </span>
          </div>
          <div className="text-xs text-neutral-400 font-mono">
            行业分类: {stock.industry} · 更新时间: {stock.updatedAt}
          </div>
        </div>

        <div className="flex items-baseline gap-4 text-right">
          <div>
            <div className="text-3xl font-extrabold font-mono text-neutral-900">
              {stock.currency === 'CNY' ? '¥' : '$'}{stock.price}
            </div>
            <div className="flex items-center gap-2 justify-end mt-1">
              <span className="text-xs font-mono font-semibold">
                {stock.change > 0 ? `+${stock.change}` : stock.change}
              </span>
              <TrendBadge value={stock.changePercent} />
            </div>
          </div>
        </div>
      </div>

      {/* Financial Ratios Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="市盈率 PE(TTM)" value={stock.pe} subtitle="同业中位数 28.2" />
        <StatCard title="市净率 PB" value={stock.pb} subtitle="同业中位数 4.1" />
        <StatCard title="成交额" value={stock.turnover} subtitle={`成交量 ${stock.volume}`} />
        <StatCard title="最高/最低" value={`${stock.high} / ${stock.low}`} subtitle={`今开 ${stock.open}`} />
        <StatCard title="总市值" value={stock.marketCap} subtitle="大盘蓝筹标的" />
        <StatCard title="AI 阿尔法评分" value="88.5" subtitle="同类 Top 8% 分位" />
      </div>

      {/* Main K-Line Chart Section */}
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
        {/* Chart Header Controls */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <LineChart className="w-4 h-4 text-neutral-600" />
            <h3 className="text-sm font-bold text-neutral-900">K 线技术走势与均线系统 (MA5 / MA20 / MA60)</h3>
          </div>

          {/* Period Selector Tabs */}
          <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-xl">
            {['1D', '5D', '1M', '3M', '1Y', '5Y'].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-lg transition-all ${
                  selectedPeriod === p
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* K-line Recharts Chart Canvas */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={klines}>
              <XAxis dataKey="time" stroke="#a3a3a3" fontSize={10} tickLine={false} />
              <YAxis yAxisId="price" stroke="#a3a3a3" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
              <YAxis yAxisId="vol" stroke="#a3a3a3" fontSize={10} tickLine={false} orientation="right" hide />
              <Tooltip
                contentStyle={{ backgroundColor: '#171717', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar yAxisId="vol" dataKey="volume" fill="#e5e5e5" opacity={0.6} />
              <Line yAxisId="price" type="monotone" dataKey="close" stroke="#171717" strokeWidth={2} dot={false} />
              <Line yAxisId="price" type="monotone" dataKey="ma5" stroke="#f59e0b" strokeWidth={1} dot={false} />
              <Line yAxisId="price" type="monotone" dataKey="ma20" stroke="#3b82f6" strokeWidth={1} dot={false} />
              <Line yAxisId="price" type="monotone" dataKey="ma60" stroke="#8b5cf6" strokeWidth={1} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabs Menu: Overview, Factors, AI Analysis, Backtest */}
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'overview' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            概览与优势分析
          </button>
          <button
            onClick={() => setActiveTab('factors')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'factors' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            因子打分诊断 (Factor Score)
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'ai' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            AI 智能总结与舆情
          </button>
          <button
            onClick={() => setActiveTab('backtest')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'backtest' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            以该股票构建策略回测
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/60 space-y-2">
              <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                当前投资亮点与因子优势
              </div>
              <ul className="text-xs text-emerald-800 space-y-1.5 list-disc list-inside">
                <li>动量因子 MOM_60D 位列全市场前 8%，均线系统呈现多头排列。</li>
                <li>ROE TTM 持续维持 25% 以上，拥有坚固的产品护城河与定价权。</li>
                <li>机构持仓比例集中，筹码结构沉淀良好，下行防护边际较高。</li>
              </ul>
            </div>

            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/60 space-y-2">
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                当前风险防范关注点
              </div>
              <ul className="text-xs text-amber-800 space-y-1.5 list-disc list-inside">
                <li>整体估值处于同业中位偏上水平，需要关注大盘流动性收紧风险。</li>
                <li>短期 20日换手率轻微放大，防范回调震荡盘整。</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 2: Factors */}
        {activeTab === 'factors' && (
          <div className="space-y-3">
            {factorScores.map((f, idx) => (
              <div key={idx} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-900">
                  <span>{f.name}</span>
                  <span className="font-mono text-emerald-600">{f.score} / 100 分</span>
                </div>
                <div className="w-full h-2 bg-neutral-200/80 rounded-full overflow-hidden">
                  <div className="h-full bg-neutral-900 rounded-full" style={{ width: `${f.score}%` }} />
                </div>
                <div className="text-[11px] text-neutral-500 font-sans">{f.desc}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: AI Analysis */}
        {activeTab === 'ai' && (
          <div className="p-4 bg-neutral-900 text-white rounded-xl space-y-3 font-sans">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                Penguin AI 对 [{stock.name}] 的深度研究结论:
              </div>
              <button
                onClick={() => setIsAskAIOpen(true)}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                在 Ask Penguin 进一步发问
              </button>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              基于该标的最近 60 日历史 K 线筹码沉淀、ROE 基本面财报与 AI 舆情多因子模型，该标的当前具备极高的配置价值。建议在低波动震荡区间分批介入，设置 8% 追踪止损风控门槛。
            </p>
          </div>
        )}

        {/* Tab 4: Backtest */}
        {activeTab === 'backtest' && (
          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-neutral-900">以 [{stock.name}] 作为核心成分股发起策略回测</div>
              <div className="text-xs text-neutral-400 mt-0.5">自动配置 60日趋势动量 + 20日低波动率算法</div>
            </div>
            <button
              onClick={() => setWorkspaceView('backtest-center')}
              className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>立即回测</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
