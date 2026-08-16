import React from 'react';
import { Cpu, TestTube, CheckCircle2, ArrowRight } from 'lucide-react';
import { mockMLModels } from '../../mocks/mockMLModels';
import { useApp } from '../../context/AppContext';

export const MLLabShowcase: React.FC = () => {
  const { enterWorkspaceWithTransition } = useApp();

  return (
    <section className="py-24 px-6 bg-white border-t border-neutral-200/60">
      <div className="max-w-6xl mx-auto space-y-16">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-semibold font-mono text-indigo-600 tracking-widest uppercase">
            MACHINE LEARNING EXPERIMENT LAB
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight">
            模型是实验工具，而不是答案。
          </h2>
          <p className="text-sm text-neutral-500">
            严谨的样本外 (Out-of-Sample) 交叉验证流程，避免过拟合，保障阿尔法收益在未来的可持续性。
          </p>
        </div>

        {/* ML Experiment Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {mockMLModels.map((model) => (
            <div
              key={model.id}
              className="p-6 bg-neutral-50 rounded-2xl border border-neutral-200/80 shadow-sm space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 font-bold text-xs">
                    {model.type}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">{model.name}</h3>
                    <div className="text-[11px] text-neutral-400 font-mono">{model.dataset}</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-mono font-semibold rounded-lg">
                  已完成训练
                </span>
              </div>

              {/* Training Config Split */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-neutral-200/60 text-xs font-mono">
                <div>
                  <span className="text-neutral-400 block text-[10px]">训练集 (Train)</span>
                  <span className="text-neutral-800 font-semibold">{model.trainRange}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px]">测试集 (OOS Test)</span>
                  <span className="text-neutral-800 font-semibold">{model.testRange}</span>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-white rounded-xl border border-neutral-200/60">
                  <div className="text-[10px] text-neutral-400 font-mono">准确率 (Acc)</div>
                  <div className="text-base font-bold font-mono text-neutral-900">{model.accuracy}%</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200/60">
                  <div className="text-[10px] text-neutral-400 font-mono">IC 均值</div>
                  <div className="text-base font-bold font-mono text-neutral-900">{model.ic}</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200/60">
                  <div className="text-[10px] text-neutral-400 font-mono">RankIC</div>
                  <div className="text-base font-bold font-mono text-emerald-600">{model.rankIc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center pt-2">
          <button
            onClick={() => enterWorkspaceWithTransition('ml-lab')}
            className="px-6 py-3 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <span>进入 ML 实验室调试损失曲线 (Loss Curve)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
