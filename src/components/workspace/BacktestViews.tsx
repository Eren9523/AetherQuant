import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { BacktestService } from '../../services/quantServices';
import { mockBacktestResults } from '../../mocks/mockBacktests';
import { BacktestResult } from '../../types';
import { Play, GitCompare, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export const BacktestViews: React.FC = () => {
  const { workspaceView, setWorkspaceView, selectedBacktestId, setSelectedBacktestId, requireAuth } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'center' | 'compare'>(
    workspaceView === 'strategy-compare' ? 'compare' : 'center'
  );

  useEffect(() => {
    if (workspaceView === 'strategy-compare') setActiveSubTab('compare');
    else if (workspaceView === 'backtest-center') setActiveSubTab('center');
  }, [workspaceView]);

  const [isSimulating, setIsSimulating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStep, setProgressStep] = useState('');
  const [currentResult, setCurrentResult] = useState<BacktestResult>(mockBacktestResults[0]);

  // Customizable Backtest Config
  const [initialCapital, setInitialCapital] = useState(1000000);
  const [benchmark, setBenchmark] = useState('000300.SH (沪深300)');
  const [slippage, setSlippage] = useState('0.001 (0.1%)');
  const [commission, setCommission] = useState('0.0003 (0.03%)');

  const handleStartBacktest = async () => {
    if (!requireAuth(() => handleStartBacktest())) {
      return;
    }

    setIsSimulating(true);
    setProgressPercent(0);
    setProgressStep('初始化回测引擎...');

    const res = await BacktestService.runBacktest({
      strategyName: '沪深300-60日趋势动量策略',
      universe: '沪深300',
      startDate: '2021-01-01',
      endDate: '2026-01-01',
      initialCapital: 1000000,
      onProgress: (pct, step) => {
        setProgressPercent(pct);
        setProgressStep(step);
      },
    });

    setCurrentResult(res);
    setIsSimulating(false);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      {/* Subtabs Menu */}
      <div className="flex items-center gap-2 border-b border-neutral-200/80 pb-3">
        <button
          onClick={() => {
            setActiveSubTab('center');
            setWorkspaceView('backtest-center');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'center' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          全天候回测中心 (Backtest Engine)
        </button>
        <button
          onClick={() => {
            setActiveSubTab('compare');
            setWorkspaceView('strategy-compare');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'compare' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          策略对比矩阵 (Strategy Comparison)
        </button>
      </div>

      {activeSubTab === 'center' && (
        <div className="space-y-6">
          {/* Backtest Control Header */}
          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">{currentResult.strategyName}</h2>
              <p className="text-xs text-neutral-400 font-mono">
                股票池: {currentResult.universe} · 时间跨度: {currentResult.startDate} → {currentResult.endDate}
              </p>
            </div>

            <button
              onClick={handleStartBacktest}
              disabled={isSimulating}
              className="px-6 py-3 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSimulating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>计算中 ({progressPercent}%)</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-emerald-400" />
                  <span>开始全量回测仿真</span>
                </>
              )}
            </button>
          </div>

          {/* Progress Modal Overlay when Simulating */}
          {isSimulating && (
            <div className="p-6 bg-neutral-900 text-white rounded-2xl border border-neutral-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span>[BACKTEST SIMULATOR RUNNING]</span>
                <span className="text-emerald-400 font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-neutral-400">{progressStep}</div>
            </div>
          )}

          {/* Key Metric Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl border border-neutral-200/80 shadow-sm">
              <div className="text-xs text-neutral-400">累计收益 (Total)</div>
              <div className="text-2xl font-bold font-mono text-emerald-600">+{currentResult.totalReturn}%</div>
              <div className="text-[10px] text-neutral-400">年化收益 {currentResult.annualizedReturn}%</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-neutral-200/80 shadow-sm">
              <div className="text-xs text-neutral-400">夏普比率 (Sharpe)</div>
              <div className="text-2xl font-bold font-mono text-neutral-900">{currentResult.sharpeRatio}</div>
              <div className="text-[10px] text-emerald-600 font-bold">Alpha +14.5%</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-neutral-200/80 shadow-sm">
              <div className="text-xs text-neutral-400">最大回撤 (Drawdown)</div>
              <div className="text-2xl font-bold font-mono text-rose-600">{currentResult.maxDrawdown}%</div>
              <div className="text-[10px] text-neutral-400">Calmar 比率 {currentResult.calmarRatio}</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-neutral-200/80 shadow-sm">
              <div className="text-xs text-neutral-400">胜率 / 换手</div>
              <div className="text-2xl font-bold font-mono text-neutral-900">{currentResult.winRate}%</div>
              <div className="text-[10px] text-neutral-400">月换手率 {currentResult.turnoverRate}%</div>
            </div>
          </div>

          {/* NAV Curve Chart */}
          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-800">
              <span>策略收益曲线 vs 基准沪深300</span>
              <span className="font-mono text-neutral-400">2021.01 - 2026.01</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={currentResult.navHistory}>
                  <defs>
                    <linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#171717" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#171717" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#a3a3a3" fontSize={10} tickLine={false} />
                  <YAxis stroke="#a3a3a3" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#171717', borderRadius: '10px', color: '#fff', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="strategy" stroke="#171717" strokeWidth={2} fill="url(#navGrad)" />
                  <Area type="monotone" dataKey="benchmark" stroke="#d4d4d4" strokeWidth={1.5} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trades Execution Logs Table */}
          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-neutral-900">历史逐笔模拟撮合记录 (Trades Execution)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-neutral-400 border-b border-neutral-100 uppercase">
                    <th className="py-2 px-3">日期</th>
                    <th className="py-2 px-3">标的代码 / 名称</th>
                    <th className="py-2 px-3">方向</th>
                    <th className="py-2 px-3">成交价格</th>
                    <th className="py-2 px-3">成交数量</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {currentResult.trades.map((tr, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50">
                      <td className="py-2.5 px-3 text-neutral-500">{tr.date}</td>
                      <td className="py-2.5 px-3 font-bold text-neutral-900">{tr.name} ({tr.symbol})</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tr.action === 'BUY' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {tr.action === 'BUY' ? '买入' : '卖出'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold">¥{tr.price}</td>
                      <td className="py-2.5 px-3">{tr.amount} 股</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: Strategy Compare Matrix */}
      {activeSubTab === 'compare' && (
        <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-neutral-600" />
            多策略夏普与回撤对比矩阵
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="text-neutral-400 border-b border-neutral-100 uppercase font-mono">
                  <th className="py-3 px-3">策略名称</th>
                  <th className="py-3 px-3">股票池</th>
                  <th className="py-3 px-3">累计收益</th>
                  <th className="py-3 px-3">夏普比率</th>
                  <th className="py-3 px-3">最大回撤</th>
                  <th className="py-3 px-3">胜率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-mono">
                {mockBacktestResults.map((bt) => (
                  <tr key={bt.id} className="hover:bg-neutral-50">
                    <td className="py-3 px-3 font-bold text-neutral-900 font-sans">{bt.strategyName}</td>
                    <td className="py-3 px-3 text-neutral-500 font-sans">{bt.universe}</td>
                    <td className="py-3 px-3 font-bold text-emerald-600">+{bt.totalReturn}%</td>
                    <td className="py-3 px-3 font-bold text-neutral-900">{bt.sharpeRatio}</td>
                    <td className="py-3 px-3 font-bold text-rose-600">{bt.maxDrawdown}%</td>
                    <td className="py-3 px-3 text-neutral-700">{bt.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
