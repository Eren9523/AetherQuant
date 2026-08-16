import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Layers, BookOpen, Sparkles, Play, Sliders, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export const StrategyViews: React.FC = () => {
  const { workspaceView, setWorkspaceView } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'library' | 'builder'>(
    workspaceView === 'strategy-builder' ? 'builder' : 'library'
  );

  useEffect(() => {
    if (workspaceView === 'strategy-builder') setActiveSubTab('builder');
    else if (workspaceView === 'strategy-library') setActiveSubTab('library');
  }, [workspaceView]);

  // Strategy Builder State
  const [universe, setUniverse] = useState('沪深300');
  const [weightMom, setWeightMom] = useState(40);
  const [weightVol, setWeightVol] = useState(30);
  const [weightQual, setWeightQual] = useState(30);
  const [holdingCount, setHoldingCount] = useState(10);
  const [rebalanceFreq, setRebalanceFreq] = useState('每周');

  // Preview Backtest Nav Curve
  const previewData = [
    { date: '2025-01', nav: 1.0 },
    { date: '2025-03', nav: 1.08 },
    { date: '2025-06', nav: 1.15 },
    { date: '2025-09', nav: 1.22 },
    { date: '2025-12', nav: 1.31 },
    { date: '2026-03', nav: 1.42 },
    { date: '2026-08', nav: 1.58 },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Subtabs Menu */}
      <div className="flex items-center gap-2 border-b border-neutral-200/80 pb-3">
        <button
          onClick={() => {
            setActiveSubTab('library');
            setWorkspaceView('strategy-library');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'library' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          策略算法库 (Strategy Library)
        </button>
        <button
          onClick={() => {
            setActiveSubTab('builder');
            setWorkspaceView('strategy-builder');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'builder' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          可视化策略构建器 (Strategy Builder)
        </button>
      </div>

      {activeSubTab === 'library' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 bg-neutral-100 text-neutral-700 text-xs font-semibold rounded-lg">
                动量增强
              </span>
              <span className="text-xs font-mono text-emerald-600 font-bold">Sharpe 1.34</span>
            </div>
            <h3 className="text-base font-bold text-neutral-900">沪深300-60日趋势动量策略</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              基于 60日对数收益率 与 20日年化低波动率 进行二元截面评分，适合大盘趋势行情。
            </p>
            <button
              onClick={() => setWorkspaceView('backtest-center')}
              className="w-full py-2 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition-colors"
            >
              运行回测
            </button>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 bg-neutral-100 text-neutral-700 text-xs font-semibold rounded-lg">
                防御红利
              </span>
              <span className="text-xs font-mono text-emerald-600 font-bold">Sharpe 1.58</span>
            </div>
            <h3 className="text-base font-bold text-neutral-900">低波动稳健红利配置组合</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              高股息率 (EP_TTM) 与 低波动率 (LOW_VOL_20D) 结合，极佳抗跌回撤控制。
            </p>
            <button
              onClick={() => setWorkspaceView('backtest-center')}
              className="w-full py-2 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition-colors"
            >
              运行回测
            </button>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 bg-neutral-100 text-neutral-700 text-xs font-semibold rounded-lg">
                AI 多因子
              </span>
              <span className="text-xs font-mono text-emerald-600 font-bold">Sharpe 1.72</span>
            </div>
            <h3 className="text-base font-bold text-neutral-900">AI 深度学习 Alpha 组合</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              融合深度学习 LSTM 预测与 XGBoost 排序，动态调整因子暴露。
            </p>
            <button
              onClick={() => setWorkspaceView('backtest-center')}
              className="w-full py-2 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition-colors"
            >
              运行回测
            </button>
          </div>
        </div>
      )}

      {activeSubTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 p-8 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-6">
            <div className="border-b border-neutral-100 pb-4">
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-neutral-600" />
                自定义多因子权重与调仓规则
              </h3>
              <p className="text-xs text-neutral-400">调整各因子权重比例，一键发起全天候历史回测</p>
            </div>

            <div className="space-y-4 text-xs font-sans">
              <div>
                <label className="font-bold text-neutral-800 block mb-1">选股股票池 (Universe)</label>
                <select
                  value={universe}
                  onChange={(e) => setUniverse(e.target.value)}
                  className="w-full p-2.5 bg-neutral-100 rounded-xl border border-neutral-200 font-medium text-xs focus:outline-none"
                >
                  <option value="沪深300">沪深300 (000300.SH)</option>
                  <option value="中证500">中证500 (000905.SH)</option>
                  <option value="S&P 500">标普 500 (S&P 500)</option>
                  <option value="全A股">全 A 股 (剔除 ST 与新股)</option>
                </select>
              </div>

              {/* Sliders */}
              <div className="p-4 bg-neutral-50 rounded-xl space-y-3 border border-neutral-200/60">
                <div>
                  <div className="flex justify-between font-bold text-neutral-800 mb-1">
                    <span>60日动量因子 (MOM_60D) 权重</span>
                    <span className="font-mono text-neutral-900">{weightMom}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={weightMom}
                    onChange={(e) => setWeightMom(Number(e.target.value))}
                    className="w-full accent-neutral-900"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-bold text-neutral-800 mb-1">
                    <span>20日低波动率 (LOW_VOL_20D) 权重</span>
                    <span className="font-mono text-neutral-900">{weightVol}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={weightVol}
                    onChange={(e) => setWeightVol(Number(e.target.value))}
                    className="w-full accent-neutral-900"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-bold text-neutral-800 mb-1">
                    <span>质量因子 (ROE_TTM) 权重</span>
                    <span className="font-mono text-neutral-900">{weightQual}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={weightQual}
                    onChange={(e) => setWeightQual(Number(e.target.value))}
                    className="w-full accent-neutral-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">组合持仓股票数量</label>
                  <input
                    type="number"
                    value={holdingCount}
                    onChange={(e) => setHoldingCount(Number(e.target.value))}
                    className="w-full p-2.5 bg-neutral-100 rounded-xl border border-neutral-200 font-mono text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">调仓频率</label>
                  <select
                    value={rebalanceFreq}
                    onChange={(e) => setRebalanceFreq(e.target.value)}
                    className="w-full p-2.5 bg-neutral-100 rounded-xl border border-neutral-200 font-medium text-xs focus:outline-none"
                  >
                    <option value="每周">每周五收盘调仓</option>
                    <option value="每双周">每双周调仓</option>
                    <option value="每月">每月末调仓</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => setWorkspaceView('backtest-center')}
                  className="flex-1 py-3 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Play className="w-4 h-4 text-emerald-400" />
                  <span>生成算法策略并立即运行回测</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Simulated Backtest NAV Preview */}
          <div className="lg:col-span-6 p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  策略预计净值拟合预览 (Simulated NAV Curve)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold border border-emerald-200">
                  预估夏普: 1.48
                </span>
              </div>

              <div className="h-64 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={previewData}>
                    <defs>
                      <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#a3a3a3" fontSize={10} tickLine={false} />
                    <YAxis stroke="#a3a3a3" fontSize={10} tickLine={false} domain={[0.9, 1.8]} />
                    <Tooltip contentStyle={{ backgroundColor: '#171717', borderRadius: '10px', color: '#fff', fontSize: '11px' }} />
                    <Area type="monotone" dataKey="nav" stroke="#10b981" strokeWidth={2.5} fill="url(#prevGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-2 text-xs font-mono">
              <div className="font-bold text-neutral-900 font-sans flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                硬性风控规则已生效
              </div>
              <div className="text-neutral-500">
                - 单股仓位上限: 10.0%<br />
                - 行业暴露偏差上限: ± 3.0%<br />
                - 年化追踪误差上限: 8.5%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
