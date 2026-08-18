import React from 'react';
import { useApp } from '../../context/AppContext';
import { TrendBadge } from '../common/TrendBadge';
import { Briefcase, PieChart } from 'lucide-react';

export const PortfolioView: React.FC = () => {
  const { paperAccount, navigateToStockDetail } = useApp();

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div>
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-neutral-700" />
              组合与实时持仓归因
            </h2>
            <p className="text-xs text-neutral-400">总资产: ¥{paperAccount.totalAssets.toLocaleString()} · 现金: ¥{paperAccount.cash.toLocaleString()}</p>
          </div>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 font-mono font-bold text-xs rounded-lg border border-emerald-200">
            夏普比率 1.37
          </span>
        </div>

        {/* Holdings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="text-neutral-400 border-b border-neutral-100 uppercase font-mono">
                <th className="py-2.5 px-3">标的代码 / 名称</th>
                <th className="py-2.5 px-3">持仓数量</th>
                <th className="py-2.5 px-3">持仓成本</th>
                <th className="py-2.5 px-3">最新市价</th>
                <th className="py-2.5 px-3">最新市值</th>
                <th className="py-2.5 px-3">浮动盈亏</th>
                <th className="py-2.5 px-3">浮盈比例</th>
                <th className="py-2.5 px-3 text-right">终端分析</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-sans">
              {paperAccount.positions.map((pos) => (
                <tr key={pos.symbol} className="hover:bg-neutral-50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-bold text-neutral-900">{pos.name}</div>
                    <div className="text-[10px] text-neutral-400 font-mono">{pos.symbol}</div>
                  </td>
                  <td className="py-3 px-3 font-mono text-neutral-800">{pos.shares} 股</td>
                  <td className="py-3 px-3 font-mono text-neutral-600">¥{pos.costPrice}</td>
                  <td className="py-3 px-3 font-mono font-bold text-neutral-900">¥{pos.currentPrice}</td>
                  <td className="py-3 px-3 font-mono font-bold text-neutral-900">¥{pos.marketValue.toLocaleString()}</td>
                  <td className="py-3 px-3 font-mono font-bold text-emerald-600">+¥{pos.unrealizedPnL.toLocaleString()}</td>
                  <td className="py-3 px-3">
                    <TrendBadge value={pos.unrealizedPnLPercent} />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => navigateToStockDetail(pos.symbol)}
                      className="px-2.5 py-1 bg-neutral-900 text-white text-[11px] font-semibold rounded-lg hover:bg-black"
                    >
                      查看详情
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
