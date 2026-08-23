import React from 'react';
import { useApp } from '../../context/AppContext';
import { mockIndices, mockCNStocks, mockUSStocks } from '../../mocks/mockStocks';
import { mockDataSources, mockDataQualityStats } from '../../mocks/mockDataSources';
import { TrendBadge } from '../common/TrendBadge';
import { StatCard } from '../common/StatCard';
import { Sparkles, ArrowRight, Activity, Database, Play, ShieldAlert } from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { paperAccount, setWorkspaceView, navigateToStockDetail } = useApp();

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      {/* Top Indices Ticker Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {mockIndices.map((idx) => (
          <div
            key={idx.symbol}
            className="p-3 bg-white rounded-xl border border-neutral-200/80 shadow-[0_2px_6px_rgba(0,0,0,0.02)] space-y-1"
          >
            <div className="text-[11px] font-semibold text-neutral-500 truncate">
              {idx.name}
            </div>
            <div className="text-sm font-bold font-mono text-neutral-900">
              {idx.price}
            </div>
            <TrendBadge value={idx.changePercent} />
          </div>
        ))}
      </div>

      {/* Account Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="组合总资产"
          value={`¥${paperAccount.totalAssets.toLocaleString()}`}
          subtitle={`现金 ¥${paperAccount.cash.toLocaleString()}`}
          badge={<TrendBadge value={paperAccount.cumPnLPercent} />}
        />
        <StatCard
          title="今日盈亏"
          value={`+¥${paperAccount.dailyPnL.toLocaleString()}`}
          subtitle="超越沪深300指数 +0.57%"
          badge={<TrendBadge value={paperAccount.dailyPnLPercent} />}
        />
        <StatCard
          title="策略夏普比率 (Sharpe)"
          value="1.37"
          subtitle="胜率 64.5% · 年化 19.8%"
          badge={<span className="text-xs font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">优秀</span>}
        />
        <StatCard
          title="最大回撤 (Max Drawdown)"
          value="-8.4%"
          subtitle="硬性风控门槛 -15.0%"
          badge={<span className="text-xs font-mono text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded">安全</span>}
        />
      </div>

      {/* Main Grid: AI Briefing + Active Strategies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Market Briefing Card */}
        <div className="lg:col-span-2 p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">AI 每日收盘深度总结报告</h3>
                  <p className="text-xs text-neutral-400">Penguin AI 引擎根据全市场 60+ 因子与行情融合分析</p>
                </div>
              </div>
              <span className="text-xs font-mono text-neutral-400">今天 15:30 自动生成</span>
            </div>

            <p className="text-xs text-neutral-700 leading-relaxed bg-neutral-50 p-4 rounded-xl border border-neutral-200/60 font-sans">
              今日 A 股盘面呈现缩量反弹格局，沪深300指数单边收涨 1.23%。动量因子（MOM_60D）表现尤为突出，主力资金积极流入白酒龙头（贵州茅台）与新能源电池龙头（宁德时代）。美股标普500连创新高，AI 半导体链（NVIDIA）保持高贝塔收益。组合当前行业暴露处于中性偏进攻配置。
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-neutral-100">
            <span className="text-xs text-neutral-400 font-mono">上下文：A股 + 美股 组合矩阵</span>
            <button
              onClick={() => setWorkspaceView('ai-research')}
              className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2"
            >
              <span>在 AI 研究中心提问</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Data Center Status Quick Card */}
        <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              数据源网关状态
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              {mockDataQualityStats.overallScore}/100
            </span>
          </div>

          <div className="space-y-3">
            {mockDataSources.map((ds) => (
              <div
                key={ds.id}
                className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                    {ds.name}
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        ds.status === 'online' ? 'bg-emerald-500' : 'bg-neutral-300'
                      }`}
                    />
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{ds.type}</div>
                </div>
                <span className="font-mono text-neutral-500 text-[11px]">{ds.lastSync}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setWorkspaceView('data-center')}
            className="w-full py-2 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 text-xs font-semibold rounded-xl transition-colors text-center block"
          >
            进入数据中心看板
          </button>
        </div>
      </div>

      {/* Stock Watchlist Quick Table */}
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">核心自选标的与因子分位</h3>
            <p className="text-xs text-neutral-400">重点关注 A 股与美股高 Alpha 权重股</p>
          </div>
          <button
            onClick={() => setWorkspaceView('market')}
            className="text-xs font-semibold text-neutral-700 hover:text-black flex items-center gap-1"
          >
            <span>查看完整市场 Terminal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-semibold text-neutral-400 border-b border-neutral-100 uppercase font-mono">
                <th className="py-2 px-3">代码 / 名称</th>
                <th className="py-2 px-3">最新价格</th>
                <th className="py-2 px-3">涨跌幅</th>
                <th className="py-2 px-3">成交额</th>
                <th className="py-2 px-3">动量分位</th>
                <th className="py-2 px-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs font-sans">
              {[...mockCNStocks.slice(0, 3), ...mockUSStocks.slice(0, 2)].map((st) => (
                <tr key={st.symbol} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-bold text-neutral-900">{st.name}</div>
                    <div className="text-[10px] text-neutral-400 font-mono">{st.symbol}</div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-neutral-900">
                    {st.market === 'CN' ? '¥' : '$'}{st.price}
                  </td>
                  <td className="py-3 px-3">
                    <TrendBadge value={st.changePercent} />
                  </td>
                  <td className="py-3 px-3 font-mono text-neutral-500">{st.turnover}</td>
                  <td className="py-3 px-3 font-mono font-semibold text-emerald-600">Top 8.5%</td>
                  <td className="py-3 px-3">
                    <button
                      onClick={() => navigateToStockDetail(st.symbol)}
                      className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-semibold rounded-lg transition-colors"
                    >
                      终端分析
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
