import React from 'react';
import { mockAutomationTasks } from '../../mocks/mockTasks';
import { Clock, Play, CheckCircle2 } from 'lucide-react';

export const AutomationView: React.FC = () => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div>
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-neutral-700" />
              定时任务与 Pipeline 管道
            </h2>
            <p className="text-xs text-neutral-400">每日盘后数据对齐、因子重算与 AI 研报摘要生成</p>
          </div>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 font-mono font-bold text-xs rounded-lg border border-emerald-200">
            Cron 调度程序激活
          </span>
        </div>

        <div className="space-y-3">
          {mockAutomationTasks.map((tk) => (
            <div
              key={tk.id}
              className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between text-xs"
            >
              <div className="space-y-1">
                <div className="font-bold text-neutral-900 flex items-center gap-2">
                  {tk.name}
                  <span className="px-2 py-0.2 bg-white border border-neutral-200 font-mono text-[10px] text-neutral-600 rounded">
                    {tk.cron}
                  </span>
                </div>
                <div className="text-neutral-500">{tk.description}</div>
              </div>

              <div className="text-right space-y-1">
                <span className="text-[10px] font-mono text-neutral-400 block">上次运行: {tk.lastRun}</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 font-mono text-[10px] font-bold rounded border border-emerald-200 inline-block">
                  ● 成功 (Finished 100%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
