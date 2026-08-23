import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, TrendingUp, Cpu, Database, Play, BarChart2, Zap, Settings, X, ArrowRight } from 'lucide-react';
import { mockCNStocks, mockUSStocks } from '../../mocks/mockStocks';

export const CommandPalette: React.FC = () => {
  const {
    isCmdKOpen,
    setIsCmdKOpen,
    enterWorkspaceWithTransition,
    navigateToStockDetail,
    setWorkspaceView,
  } = useApp();

  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isCmdKOpen) setQuery('');
  }, [isCmdKOpen]);

  if (!isCmdKOpen) return null;

  const allStocks = [...mockCNStocks, ...mockUSStocks];
  const filteredStocks = query
    ? allStocks.filter(
        (s) =>
          s.symbol.toLowerCase().includes(query.toLowerCase()) ||
          s.name.toLowerCase().includes(query.toLowerCase())
      )
    : allStocks.slice(0, 5);

  const quickActions = [
    {
      title: '进入 AI 研究中心',
      desc: '向 Penguin AI 发起多因子策略提问与市场扫描',
      icon: <Cpu className="w-4 h-4 text-purple-600" />,
      action: () => {
        enterWorkspaceWithTransition('ai-research');
        setIsCmdKOpen(false);
      },
    },
    {
      title: '运行策略回测',
      desc: '查看 60日趋势动量策略 的最新历史回测绩效',
      icon: <Play className="w-4 h-4 text-emerald-600" />,
      action: () => {
        enterWorkspaceWithTransition('backtest-center');
        setIsCmdKOpen(false);
      },
    },
    {
      title: '查看数据中心与数据质量',
      desc: '检查 Tushare, QMT, SEC 数据同步状态',
      icon: <Database className="w-4 h-4 text-blue-600" />,
      action: () => {
        enterWorkspaceWithTransition('data-center');
        setIsCmdKOpen(false);
      },
    },
    {
      title: '因子实验室与 IC 序列分析',
      desc: '分析 MOM_60D, ROE_TTM 因子分层超额收益',
      icon: <BarChart2 className="w-4 h-4 text-amber-600" />,
      action: () => {
        enterWorkspaceWithTransition('factor-lab');
        setIsCmdKOpen(false);
      },
    },
    {
      title: '上传自定义 CSV / XLSX 因子数据集',
      desc: '字段自动识别与 Schema Mapping 映射',
      icon: <Zap className="w-4 h-4 text-indigo-600" />,
      action: () => {
        enterWorkspaceWithTransition('upload-center');
        setIsCmdKOpen(false);
      },
    },
    {
      title: '系统设置与市场颜色配置',
      desc: '切换红涨绿跌 / 绿涨红跌及全局 API 配置',
      icon: <Settings className="w-4 h-4 text-neutral-600" />,
      action: () => {
        enterWorkspaceWithTransition('settings');
        setIsCmdKOpen(false);
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-200/90 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-neutral-100 bg-neutral-50/50">
          <Search className="w-5 h-5 text-neutral-400 mr-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索股票、代码、指令、回测或因子... (支持 贵州茅台 / AAPL / 因子)"
            className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none font-medium"
            autoFocus
          />
          <button
            onClick={() => setIsCmdKOpen(false)}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Content */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-4">
          {/* Stock Search Results */}
          <div>
            <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-400 tracking-wider uppercase">
              {query ? '股票搜索结果' : '热门标的'}
            </div>
            <div className="space-y-1">
              {filteredStocks.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => {
                    navigateToStockDetail(stock.symbol);
                    setIsCmdKOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-neutral-100/80 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-xs font-mono font-bold text-neutral-700 border border-neutral-200/60">
                      {stock.market}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-neutral-900 group-hover:text-black">
                        {stock.name}
                      </div>
                      <div className="text-xs text-neutral-400 font-mono">
                        {stock.symbol} · {stock.industry}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold text-neutral-800">
                      {stock.market === 'CN' ? '¥' : '$'}
                      {stock.price}
                    </span>
                    <ArrowRight className="w-4 h-4 text-neutral-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          {!query && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-400 tracking-wider uppercase">
                快捷功能跳转
              </div>
              <div className="space-y-1">
                {quickActions.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={item.action}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-neutral-100/80 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neutral-100/80 flex items-center justify-center border border-neutral-200/50">
                        {item.icon}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-neutral-900">
                          {item.title}
                        </div>
                        <div className="text-xs text-neutral-400">
                          {item.desc}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-neutral-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center gap-3">
            <span>
              按 <kbd className="px-1 py-0.5 bg-white border border-neutral-200 rounded font-mono text-[10px]">↑</kbd>{' '}
              <kbd className="px-1 py-0.5 bg-white border border-neutral-200 rounded font-mono text-[10px]">↓</kbd> 导航
            </span>
            <span>
              按 <kbd className="px-1 py-0.5 bg-white border border-neutral-200 rounded font-mono text-[10px]">↵</kbd> 选择
            </span>
          </div>
          <div>按 Esc 关闭</div>
        </div>
      </div>
    </div>
  );
};
