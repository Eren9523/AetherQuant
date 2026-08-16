import React, { useState, useEffect, useRef } from 'react';
import { mockBacktestResults } from '../../mocks/mockBacktests';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { useApp } from '../../context/AppContext';

export const BacktestShowcase: React.FC = () => {
  const { enterWorkspaceWithTransition } = useApp();
  const res = mockBacktestResults[0];
  const sectionRef = useRef<HTMLDivElement>(null);

  const [hasScrolledIn, setHasScrolledIn] = useState(false);
  const [displayReturn, setDisplayReturn] = useState(0.0);
  const [displaySharpe, setDisplaySharpe] = useState(0.0);
  const [displayDrawdown, setDisplayDrawdown] = useState(0.0);
  const [displayWinRate, setDisplayWinRate] = useState(0.0);
  const [displayAnnualized, setDisplayAnnualized] = useState(0.0);
  const [isTickFlashing, setIsTickFlashing] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasScrolledIn) {
          setHasScrolledIn(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [hasScrolledIn]);

  useEffect(() => {
    if (!hasScrolledIn) return;

    setIsTickFlashing(true);
    const duration = 1200; // 1.2 seconds animation
    const steps = 30;
    const intervalTime = duration / steps;
    let stepCount = 0;

    const timer = setInterval(() => {
      stepCount++;
      const progress = Math.min(1, stepCount / steps);
      // Ease out quad
      const ease = 1 - (1 - progress) * (1 - progress);

      setDisplayReturn(Number((res.totalReturn * ease).toFixed(1)));
      setDisplaySharpe(Number((res.sharpeRatio * ease).toFixed(2)));
      setDisplayDrawdown(Number((res.maxDrawdown * ease).toFixed(1)));
      setDisplayWinRate(Number((res.winRate * ease).toFixed(1)));
      setDisplayAnnualized(Number((res.annualizedReturn * ease).toFixed(1)));

      if (stepCount >= steps) {
        clearInterval(timer);
        setTimeout(() => setIsTickFlashing(false), 800);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [hasScrolledIn, res]);

  return (
    <section ref={sectionRef} id="backtest" className="py-24 px-6 bg-[#f8f9fa] border-t border-neutral-200/60">
      <div className="max-w-6xl mx-auto space-y-16">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-semibold font-mono text-emerald-600 tracking-widest uppercase">
            BACKTEST ENGINE
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight">
            一个想法，只有经过历史检验，才能成为策略。
          </h2>
          <p className="text-sm text-neutral-500">
            逐笔级别的撮合仿真、印花税/佣金精确扣减与行业暴露归因，拒绝未来函数与拟合陷阱。
          </p>
        </div>

        {/* Backtest Showcase Card */}
        <div className="p-8 bg-white rounded-3xl border border-neutral-200/80 shadow-[0_10px_30px_rgba(0,0,0,0.04)] space-y-8 transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
          {/* Top Key Metrics Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-6 border-b border-neutral-100">
            <div className={`transition-transform duration-300 ${isTickFlashing ? 'scale-105' : ''}`}>
              <div className="text-xs font-medium text-neutral-400 mb-1 flex items-center gap-1">
                <span>策略累计收益</span>
                {isTickFlashing && <TrendingUp className="w-3.5 h-3.5 text-emerald-500 animate-bounce" />}
              </div>
              <div className={`text-2xl font-bold font-mono transition-colors ${isTickFlashing ? 'text-emerald-500 scale-105' : 'text-emerald-600'}`}>
                +{displayReturn}%
              </div>
              <span className="text-[10px] text-neutral-400">基准(沪深300) +{res.benchmarkReturn}%</span>
            </div>

            <div>
              <div className="text-xs font-medium text-neutral-400 mb-1">夏普比率 (Sharpe)</div>
              <div className="text-2xl font-bold font-mono text-neutral-900">
                {displaySharpe.toFixed(2)}
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold">无风险利率 2.0%</span>
            </div>

            <div className={`transition-transform duration-300 ${isTickFlashing ? 'scale-105' : ''}`}>
              <div className="text-xs font-medium text-neutral-400 mb-1 flex items-center gap-1">
                <span>最大回撤 (Max Drawdown)</span>
                {isTickFlashing && <TrendingDown className="w-3.5 h-3.5 text-rose-500 animate-bounce" />}
              </div>
              <div className={`text-2xl font-bold font-mono transition-colors ${isTickFlashing ? 'text-rose-500' : 'text-rose-600'}`}>
                {displayDrawdown}%
              </div>
              <span className="text-[10px] text-neutral-400">Calmar 比率 {res.calmarRatio}</span>
            </div>

            <div>
              <div className="text-xs font-medium text-neutral-400 mb-1">胜率 / 年化收益</div>
              <div className="text-2xl font-bold font-mono text-neutral-900">
                {displayWinRate}% / {displayAnnualized}%
              </div>
              <span className="text-[10px] text-neutral-400">月度换手率 {res.turnoverRate}%</span>
            </div>
          </div>

          {/* NAV Curve Chart */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-600 mb-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-neutral-900" />
                  策略净值 (Strategy NAV)
                </span>
                <span className="flex items-center gap-1.5 text-neutral-400">
                  <span className="w-3 h-3 rounded-full bg-neutral-300" />
                  基准沪深300 (Benchmark)
                </span>
              </div>
              <span className="font-mono text-neutral-400">2021.01 → 2026.01</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={res.navHistory}>
                  <defs>
                    <linearGradient id="stratGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#171717" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#171717" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#a3a3a3" fontSize={10} tickLine={false} />
                  <YAxis stroke="#a3a3a3" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#171717', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="strategy" stroke="#171717" strokeWidth={2} fillOpacity={1} fill="url(#stratGrad)" />
                  <Area type="monotone" dataKey="benchmark" stroke="#d4d4d4" strokeWidth={1.5} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => enterWorkspaceWithTransition('backtest-center')}
              className="px-6 py-3 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-sm hover:shadow-md inline-flex items-center gap-2 group"
            >
              <span>在工作台进行自定义参数回测</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
