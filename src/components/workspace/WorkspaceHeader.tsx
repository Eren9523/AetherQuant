import React from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Sparkles, RefreshCw, SlidersHorizontal, User } from 'lucide-react';
import { RUNTIME_CONFIG } from '../../config/runtimeConfig';

export const WorkspaceHeader: React.FC = () => {
  const {
    marketColorMode,
    toggleMarketColorMode,
    setIsCmdKOpen,
    setIsAskAIOpen,
    workspaceView,
  } = useApp();

  const viewTitles: Record<string, string> = {
    overview: '工作台总览',
    market: '全球市场 Terminal',
    'stock-detail': '股票深度行情',
    'ai-research': 'AI 交互研究 Thread',
    'doc-research': '研报与文档 AI 解析',
    'data-center': '数据中心与质量看板',
    'upload-center': '上传中心 (BYOD Schema Mapping)',
    'data-browser': '数据浏览器',
    'factor-library': '多因子算法库',
    'factor-lab': '因子实验室 (IC / RankIC)',
    'strategy-library': '策略算法库',
    'strategy-builder': '可视化策略构建器',
    'backtest-center': '全天候回测引擎',
    'strategy-compare': '策略对比矩阵',
    'ml-lab': '机器学习实验室 (LSTM / XGB)',
    portfolio: '组合收益归因与持仓',
    trading: '模拟交易 & QMT 网关预留',
    risk: '硬性风控卫士',
    automation: '定时 Pipeline 自动化',
    settings: '系统 API & 全局偏好设置',
  };

  return (
    <header className="h-16 px-6 bg-white/90 backdrop-blur-md border-b border-neutral-200/80 sticky top-0 z-20 flex items-center justify-between">
      {/* Current Page Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-base font-bold text-neutral-900 tracking-tight">
          {viewTitles[workspaceView] || '工作台'}
        </h1>
        {RUNTIME_CONFIG.isDemoMode ? (
          <div
            id="demo-mode-indicator"
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold"
            title="当前处于 Demo 演示模式，展示仿真与模拟数据"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>演示模式 / Demo Data</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>A股/美股行情同步正常</span>
          </div>
        )}
      </div>

      {/* Center Command Search Trigger */}
      <button
        onClick={() => setIsCmdKOpen(true)}
        className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-100/80 hover:bg-neutral-100 border border-neutral-200/60 text-xs text-neutral-500 transition-colors w-64 justify-between font-mono"
      >
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-neutral-400" />
          <span>搜索股票 / 因子 / 指令...</span>
        </div>
        <kbd className="px-1.5 py-0.5 text-[10px] bg-white rounded border border-neutral-200 text-neutral-400 font-bold">
          ⌘K
        </kbd>
      </button>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Market Color Habit Switcher */}
        <button
          onClick={toggleMarketColorMode}
          title="切换涨跌颜色习惯 (中国模式: 红涨绿跌 | 国际模式: 绿涨红跌)"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-100 hover:bg-neutral-200/70 border border-neutral-200/80 text-xs font-medium text-neutral-700 transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500" />
          <span>{marketColorMode === 'CN' ? '中国模式 (红涨)' : '国际模式 (绿涨)'}</span>
        </button>

        {/* Ask AI Button */}
        <button
          onClick={() => setIsAskAIOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-semibold shadow-sm transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Ask Aether</span>
        </button>

        {/* User Profile */}
        <div className="w-8 h-8 rounded-full bg-neutral-200 border border-neutral-300 flex items-center justify-center text-neutral-700 text-xs font-bold font-mono">
          <User className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
};
