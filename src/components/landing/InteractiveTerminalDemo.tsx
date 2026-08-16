import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { LayoutDashboard, Globe, LineChart, Sparkles, Cpu, BarChart2, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';
import { mockCNStocks } from '../../mocks/mockStocks';
import { mockFactors } from '../../mocks/mockFactors';
import { mockBacktestResults } from '../../mocks/mockBacktests';
import { TrendBadge } from '../common/TrendBadge';

export const InteractiveTerminalDemo: React.FC = () => {
  const { enterWorkspaceWithTransition, navigateToStockDetail } = useApp();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'market' | 'stock' | 'ai' | 'factor' | 'backtest'>('dashboard');
  const sectionRef = useRef<HTMLDivElement>(null);

  const [hasScrolledIn, setHasScrolledIn] = useState(false);
  const [totalAssets, setTotalAssets] = useState(1000000);
  const [todayPnl, setTodayPnl] = useState(0);
  const [sharpe, setSharpe] = useState(0.0);
  const [maxDrawdown, setMaxDrawdown] = useState(0.0);
  const [isTickFlashing, setIsTickFlashing] = useState(false);

  const tabs = [
    { id: 'dashboard', label: '工作台总览', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'market', label: '全球市场终端', icon: <Globe className="w-4 h-4" /> },
    { id: 'stock', label: '股票深度分析', icon: <LineChart className="w-4 h-4" /> },
    { id: 'ai', label: 'AI 多步推理研究', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'factor', label: '因子实验室', icon: <Cpu className="w-4 h-4" /> },
    { id: 'backtest', label: '策略回测结果', icon: <BarChart2 className="w-4 h-4" /> },
  ];

  // Scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasScrolledIn) {
          setHasScrolledIn(true);
        }
      },
      { threshold: 0.25 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [hasScrolledIn]);

  // Number ticker animation function
  const runNumberTicker = () => {
    setIsTickFlashing(true);
    const targetAssets = 1248351;
    const targetPnl = 8215;
    const targetSharpe = 1.37;
    const targetDrawdown = -8.4;

    const duration = 1000; // 1s rapid count
    const steps = 25;
    const intervalTime = duration / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic

      setTotalAssets(Math.round(1000000 + (targetAssets - 1000000) * ease));
      setTodayPnl(Math.round(targetPnl * ease));
      setSharpe(Number((targetSharpe * ease).toFixed(2)));
      setMaxDrawdown(Number((targetDrawdown * ease).toFixed(1)));

      if (currentStep >= steps) {
        clearInterval(timer);
        setTimeout(() => setIsTickFlashing(false), 600);
      }
    }, intervalTime);
  };

  useEffect(() => {
    if (hasScrolledIn && activeTab === 'dashboard') {
      runNumberTicker();
    }
  }, [hasScrolledIn, activeTab]);

  return (
    <section ref={sectionRef} id="demo" className="py-24 px-6 bg-[#f8f9fa]">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Section Header */}
        <div className="text-center space-y-3">
          <span className="text-xs font-semibold font-mono text-neutral-400 tracking-widest uppercase">
            LIVE INTERACTIVE TERMINAL
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
            真实产品终端演示
          </h2>
          <p className="text-sm text-neutral-500 max-w-xl mx-auto">
            点击标签自由切换或向下滚动，体验 AetherQuant 模块化工作台架构。
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-white rounded-2xl border border-neutral-200/80 shadow-sm w-fit mx-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === 'dashboard') runNumberTicker();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-md'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mac OS Window Preview Frame */}
        <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.08)] overflow-hidden transition-all duration-300">
          {/* Window Topbar */}
          <div className="px-4 py-3 bg-neutral-100/80 border-b border-neutral-200/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="ml-2 text-xs font-mono font-medium text-neutral-500">
                AetherQuant Workspace Terminal v2.4 (Mock Node)
              </span>
            </div>
            <button
              onClick={() => enterWorkspaceWithTransition(activeTab as any)}
              className="flex items-center gap-1.5 px-3 py-1 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
            >
              <span>进入此模块</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Window Mock Canvas View */}
          <div className="p-6 bg-[#fafafa] min-h-[420px] font-sans">
            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Card 1: Total Assets */}
                  <div className={`p-4 bg-white rounded-xl border border-neutral-200/80 shadow-sm transition-all duration-300 ${isTickFlashing ? 'ring-2 ring-emerald-500/30 scale-[1.02]' : ''}`}>
                    <div className="text-xs text-neutral-400 mb-1 flex items-center justify-between">
                      <span>模拟总资产</span>
                      {isTickFlashing && <TrendingUp className="w-3 h-3 text-emerald-500 animate-bounce" />}
                    </div>
                    <div className="text-xl font-bold font-mono text-neutral-900">
                      ¥{totalAssets.toLocaleString()}
                    </div>
                    <TrendBadge value={24.8} className="mt-2" />
                  </div>

                  {/* Card 2: Today PnL */}
                  <div className={`p-4 bg-white rounded-xl border border-neutral-200/80 shadow-sm transition-all duration-300 ${isTickFlashing ? 'ring-2 ring-emerald-500/30 scale-[1.02]' : ''}`}>
                    <div className="text-xs text-neutral-400 mb-1 flex items-center justify-between">
                      <span>今日盈亏</span>
                      {isTickFlashing && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
                    </div>
                    <div className="text-xl font-bold font-mono text-emerald-600">
                      +¥{todayPnl.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-neutral-400">沪深300 +1.23%</span>
                  </div>

                  {/* Card 3: Sharpe Ratio */}
                  <div className="p-4 bg-white rounded-xl border border-neutral-200/80 shadow-sm">
                    <div className="text-xs text-neutral-400 mb-1">策略夏普比率</div>
                    <div className="text-xl font-bold font-mono text-neutral-900">{sharpe.toFixed(2)}</div>
                    <span className="text-[10px] text-emerald-600 font-semibold">优秀水准</span>
                  </div>

                  {/* Card 4: Max Drawdown */}
                  <div className={`p-4 bg-white rounded-xl border border-neutral-200/80 shadow-sm transition-all duration-300 ${isTickFlashing ? 'ring-2 ring-rose-500/30' : ''}`}>
                    <div className="text-xs text-neutral-400 mb-1 flex items-center justify-between">
                      <span>最大回撤</span>
                      {isTickFlashing && <TrendingDown className="w-3 h-3 text-rose-500 animate-bounce" />}
                    </div>
                    <div className="text-xl font-bold font-mono text-rose-600">{maxDrawdown}%</div>
                    <span className="text-[10px] text-neutral-400">风控触发阈值 -15%</span>
                  </div>
                </div>

                <div className="p-5 bg-white rounded-xl border border-neutral-200/80 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      AI 每日市场收盘简报
                    </div>
                    <span className="text-xs text-neutral-400">今天 15:30 更新</span>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed bg-neutral-50 p-3.5 rounded-lg border border-neutral-100">
                    今日沪深300指数全天单边震荡上行，收涨 1.23%。动量类因子（MOM_60D）表现相对较强，资金明显向白酒、动力电池及互联网金融龙头集聚。策略组合净值创近期新高，当前行业暴露处于均衡健康区间。
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'market' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 pb-2 border-b">
                  <span>股票名称 / 代码</span>
                  <span>最新价</span>
                  <span>涨跌幅</span>
                  <span>成交额</span>
                </div>
                {mockCNStocks.slice(0, 4).map((st) => (
                  <div
                    key={st.symbol}
                    onClick={() => navigateToStockDetail(st.symbol)}
                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-200/60 hover:bg-neutral-100/80 cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="text-sm font-bold text-neutral-900">{st.name}</div>
                      <div className="text-xs text-neutral-400 font-mono">{st.symbol}</div>
                    </div>
                    <div className="text-sm font-mono font-bold text-neutral-900">
                      ¥{st.price}
                    </div>
                    <TrendBadge value={st.changePercent} />
                    <div className="text-xs font-mono text-neutral-500">{st.turnover}</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'stock' && (
              <div className="p-5 bg-white rounded-xl border border-neutral-200/80 space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900">贵州茅台 (600519.SH)</h3>
                    <div className="text-xs text-neutral-400">A股 · 白酒行业龙头 · 沪深300权重股</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold font-mono text-neutral-900">¥1482.35</div>
                    <TrendBadge value={1.81} />
                  </div>
                </div>

                <div className="h-32 bg-neutral-50 rounded-lg border border-neutral-100 flex items-center justify-center text-xs text-neutral-400 font-mono">
                  [K线图模拟 - MA5: 1475.2 | MA20: 1460.8 | MA60: 1445.0]
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="p-5 bg-white rounded-xl border border-neutral-200/80 space-y-4 animate-in fade-in duration-300">
                <div className="p-3 bg-neutral-900 text-white rounded-xl text-xs font-mono">
                  &gt; USER: 帮我从沪深300中寻找最近60日趋势较强、波动率较低的10只股票。
                </div>
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-2 text-xs">
                  <div className="font-semibold text-neutral-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    AI 多步推理执行进度:
                  </div>
                  <div className="text-neutral-600 font-mono space-y-1">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> [1/4] 锁定股票池: 沪深300 (300只标的)</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> [2/4] 计算 60D 动量 (MOM_60D) &amp; 去极值</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> [3/4] 匹配 20D 低波动率 (LOW_VOL_20D)</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> [4/4] 导出精选 Top 10 股票组合</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'factor' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
                {mockFactors.slice(0, 4).map((f) => (
                  <div key={f.id} className="p-4 bg-white rounded-xl border border-neutral-200/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-neutral-900">{f.name}</span>
                      <span className="text-xs font-mono bg-neutral-100 px-2 py-0.5 rounded text-neutral-600">{f.code}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono text-neutral-500 pt-2 border-t border-neutral-100">
                      <div>IC 均值: <span className="font-bold text-neutral-800">{f.ic}</span></div>
                      <div>RankIC: <span className="font-bold text-emerald-600">{f.rankIc}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'backtest' && (
              <div className="p-5 bg-white rounded-xl border border-neutral-200/80 space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">{mockBacktestResults[0].strategyName}</h3>
                    <p className="text-xs text-neutral-400">时间: {mockBacktestResults[0].startDate} → {mockBacktestResults[0].endDate}</p>
                  </div>
                  <div className="flex gap-4 font-mono text-xs">
                    <div><span className="text-neutral-400">累计收益:</span> <span className="font-bold text-emerald-600">+{mockBacktestResults[0].totalReturn}%</span></div>
                    <div><span className="text-neutral-400">夏普比率:</span> <span className="font-bold text-neutral-900">{mockBacktestResults[0].sharpeRatio}</span></div>
                    <div><span className="text-neutral-400">最大回撤:</span> <span className="font-bold text-rose-600">{mockBacktestResults[0].maxDrawdown}%</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
