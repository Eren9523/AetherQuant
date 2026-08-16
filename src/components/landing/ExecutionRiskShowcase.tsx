import React, { useState } from 'react';
import { ShieldCheck, Lock, ArrowRight, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ExecutionRiskShowcase: React.FC = () => {
  const { enterWorkspaceWithTransition } = useApp();
  const [hoveredStepIndex, setHoveredStepIndex] = useState<number | null>(null);

  const steps = [
    {
      id: 0,
      code: '01 SIGNAL',
      title: '策略生成信号',
      desc: 'AI 选股/动量加仓',
      accent: 'emerald',
    },
    {
      id: 1,
      code: '02 PORTFOLIO',
      title: '组合权重优化',
      desc: '等权 / 最小方差',
      accent: 'blue',
    },
    {
      id: 2,
      code: '03 RISK ENGINE',
      title: '硬性风控卫士',
      desc: '单股<10% · 日亏损<3%',
      accent: 'rose',
      isCore: true,
    },
    {
      id: 3,
      code: '04 ORDER',
      title: '订单生成与切分',
      desc: 'TWAP / VWAP 挂单',
      accent: 'amber',
    },
    {
      id: 4,
      code: '05 BROKER',
      title: 'QMT / 券商接口',
      desc: '○ 尚未连接 (Mock)',
      accent: 'purple',
    },
  ];

  return (
    <section id="execution" className="py-24 px-6 bg-[#f8f9fa] border-t border-neutral-200/60">
      <div className="max-w-6xl mx-auto space-y-16">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-semibold font-mono text-rose-600 tracking-widest uppercase">
            RISK SAFEGUARD & BROKER EXECUTION
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight">
            研究优先，执行最后。
          </h2>
          <p className="text-sm text-neutral-500">
            在策略信号与实盘/模拟下单之间，始终内置硬性风控卫士，保障资金安全。
          </p>
        </div>

        {/* Safeguard Flow Diagram */}
        <div className="p-8 bg-white rounded-3xl border border-neutral-200/80 shadow-sm space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 text-center relative">
            {steps.map((st) => {
              const isHovered = st.id === hoveredStepIndex;

              return (
                <div
                  key={st.id}
                  onMouseEnter={() => setHoveredStepIndex(st.id)}
                  onMouseLeave={() => setHoveredStepIndex(null)}
                  className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer select-none relative ${
                    isHovered
                      ? st.isCore
                        ? 'bg-rose-950 text-white shadow-2xl scale-105 border-rose-600 z-10 -translate-y-1 ring-4 ring-rose-500/20'
                        : 'bg-neutral-900 text-white shadow-2xl scale-105 border-neutral-900 z-10 -translate-y-1'
                      : st.isCore
                      ? 'bg-rose-50/80 text-rose-950 border-rose-200/80 hover:bg-rose-100/80'
                      : 'bg-neutral-50 text-neutral-800 border-neutral-200/80 hover:bg-neutral-100'
                  }`}
                >
                  {/* Top Active Indicator */}
                  <div className="text-[10px] font-mono mb-2 flex items-center justify-center gap-1">
                    {st.isCore && (
                      <ShieldCheck
                        className={`w-3.5 h-3.5 ${isHovered ? 'text-rose-400 animate-pulse' : 'text-rose-600'}`}
                      />
                    )}
                    <span
                      className={`font-semibold ${
                        isHovered
                          ? st.isCore
                            ? 'text-rose-300'
                            : 'text-neutral-300'
                          : st.isCore
                          ? 'text-rose-600'
                          : 'text-neutral-400'
                      }`}
                    >
                      {st.code}
                    </span>
                  </div>

                  <div className="text-sm font-bold mb-1 transition-colors duration-200">{st.title}</div>
                  <div
                    className={`text-[11px] leading-snug transition-colors duration-200 ${
                      isHovered ? 'text-neutral-300' : st.isCore ? 'text-rose-700 font-medium' : 'text-neutral-500'
                    }`}
                  >
                    {st.desc}
                  </div>

                  {isHovered && (
                    <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-center gap-1 text-[10px] text-emerald-400 font-mono animate-in fade-in duration-200">
                      <Zap className="w-3 h-3 text-amber-400 animate-bounce" />
                      <span>信号传输中</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-neutral-600 gap-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>防护保护规程: 重复下单拦截已开启 · 行情超时保护已开启</span>
            </div>
            <button
              onClick={() => enterWorkspaceWithTransition('risk')}
              className="px-4 py-2 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-all shadow-md hover:shadow-lg flex items-center gap-1.5 group shrink-0"
            >
              <span>查看风控规则设置</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

