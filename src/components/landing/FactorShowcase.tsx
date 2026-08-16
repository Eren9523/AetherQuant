import React from 'react';
import { mockFactors } from '../../mocks/mockFactors';
import { Cpu, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const FactorShowcase: React.FC = () => {
  const { enterWorkspaceWithTransition } = useApp();

  return (
    <section id="factors" className="py-24 px-6 bg-white border-t border-neutral-200/60">
      <div className="max-w-6xl mx-auto space-y-16">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-semibold font-mono text-amber-600 tracking-widest uppercase">
            ALPHA FACTOR LIBRARY
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight">
            把直觉变成可以计算的信号。
          </h2>
          <p className="text-sm text-neutral-500">
            精细化的多因子体系，覆盖动量、价值、质量、成长、低波动与 AI 舆情因子。
          </p>
        </div>

        {/* Factors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockFactors.map((f) => (
            <div
              key={f.id}
              className="p-6 bg-neutral-50/80 hover:bg-white rounded-2xl border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-1 bg-white border border-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg shadow-2xs">
                    {f.category}
                  </span>
                  <span className="text-xs font-mono font-medium text-neutral-400">
                    {f.code}
                  </span>
                </div>
                <h3 className="text-base font-bold text-neutral-900 mb-1">{f.name}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
                  {f.description}
                </p>
              </div>

              {/* Factor Score Bar */}
              <div className="pt-3 border-t border-neutral-200/60 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-neutral-400">因子 Alpha 得分</span>
                  <span className="font-bold text-neutral-900">{f.score || 80} / 100</span>
                </div>
                <div className="w-full h-2 bg-neutral-200/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neutral-900 rounded-full transition-all duration-1000"
                    style={{ width: `${f.score || 80}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono pt-1">
                  <span>IC: <strong className="text-neutral-700">{f.ic}</strong></span>
                  <span>RankIC: <strong className="text-emerald-600">{f.rankIc}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center pt-4">
          <button
            onClick={() => enterWorkspaceWithTransition('factor-library')}
            className="px-6 py-3 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <span>进入因子实验室与相关性矩阵</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
