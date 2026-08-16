import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, Lock } from 'lucide-react';

export const RiskView: React.FC = () => {
  const [singleStockLimit, setSingleStockLimit] = useState(10);
  const [maxDrawdownLimit, setMaxDrawdownLimit] = useState(15);
  const [duplicateOrderBlock, setDuplicateOrderBlock] = useState(true);

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div>
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              硬性风控卫士 (Risk Safeguard)
            </h2>
            <p className="text-xs text-neutral-400">风控规则高于 AI 算法信号，强行拦截高风险委托</p>
          </div>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 font-mono font-bold text-xs rounded-lg border border-emerald-200">
            风控引擎: 正常运行中
          </span>
        </div>

        <div className="space-y-4 text-xs font-sans max-w-2xl">
          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-2">
            <div className="flex justify-between font-bold text-neutral-900">
              <span>单只股票最大持仓权重 (%)</span>
              <span className="font-mono text-neutral-900">{singleStockLimit}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              value={singleStockLimit}
              onChange={(e) => setSingleStockLimit(Number(e.target.value))}
              className="w-full accent-neutral-900"
            />
          </div>

          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-2">
            <div className="flex justify-between font-bold text-neutral-900">
              <span>硬性止损熔断回撤触发现 (%)</span>
              <span className="font-mono text-rose-600">-{maxDrawdownLimit}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              value={maxDrawdownLimit}
              onChange={(e) => setMaxDrawdownLimit(Number(e.target.value))}
              className="w-full accent-neutral-900"
            />
          </div>

          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between">
            <div>
              <div className="font-bold text-neutral-900">高频重复委托秒级拦截</div>
              <div className="text-neutral-400 text-[11px]">防止网络抖动导致的重复买入挂单</div>
            </div>
            <input
              type="checkbox"
              checked={duplicateOrderBlock}
              onChange={(e) => setDuplicateOrderBlock(e.target.checked)}
              className="w-4 h-4 accent-neutral-900"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
