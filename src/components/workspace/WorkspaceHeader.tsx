import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  Sparkles,
  SlidersHorizontal,
  User,
  Key,
  Shield,
  Settings,
  LogOut,
  Sliders,
  CheckCircle2,
  ChevronDown,
  LogIn,
} from 'lucide-react';
import { RUNTIME_CONFIG } from '../../config/runtimeConfig';
import { UserService } from '../../services/userService';

export const WorkspaceHeader: React.FC = () => {
  const {
    marketColorMode,
    toggleMarketColorMode,
    setIsCmdKOpen,
    setIsAskAIOpen,
    workspaceView,
    setWorkspaceView,
    navigateToUserCenter,
    currentUser,
    isAuthenticated,
    logout,
    openAuthModal,
  } = useApp();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    settings: '系统偏好设置',
    'user-center': '个人中心',
    'admin-console': '后台管理控制台',
  };

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await logout();
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
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
            <span>行情服务待接入</span>
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
          <span>Ask Penguin</span>
        </button>

        {/* User Profile & Dropdown (iOS Frosted Glass Style) */}
        {isAuthenticated ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 py-1 pl-2 pr-1.5 rounded-2xl hover:bg-neutral-100/80 transition-colors cursor-pointer border border-transparent hover:border-neutral-200/60"
            >
              <span className="text-xs font-semibold text-neutral-700 hidden lg:inline">
                欢迎，<span className="text-blue-600 font-bold">{currentUser.name}</span>
              </span>
              <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 shadow-2xs overflow-hidden flex items-center justify-center">
                <img
                  src={currentUser.avatar || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${encodeURIComponent(currentUser.username || 'QuantLead')}&backgroundColor=f8fafc`}
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${encodeURIComponent(currentUser.username || 'QuantLead')}&backgroundColor=f8fafc`;
                  }}
                />
              </div>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>

            {/* iOS Inspired Floating Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white/95 backdrop-blur-xl rounded-2xl p-2 shadow-2xl border border-neutral-200/80 ring-1 ring-black/5 z-50 animate-fadeIn">
                {/* Header Preview */}
                <div
                  onClick={() => {
                    setWorkspaceView('user-center');
                    setIsDropdownOpen(false);
                  }}
                  className="p-3 rounded-xl bg-neutral-50/80 hover:bg-neutral-100/80 border border-neutral-200/50 transition-colors cursor-pointer mb-1.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200 p-0.5 overflow-hidden shrink-0 shadow-2xs">
                      <img
                        src={currentUser.avatar || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${encodeURIComponent(currentUser.username || 'QuantLead')}&backgroundColor=f8fafc`}
                        alt={currentUser.name}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${encodeURIComponent(currentUser.username || 'QuantLead')}&backgroundColor=f8fafc`;
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-neutral-900 truncate">
                        {currentUser.name}
                      </div>
                      <div className="text-[10px] text-neutral-400 truncate">
                        {currentUser.department}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="space-y-0.5 text-xs">
                  <button
                    onClick={() => {
                      navigateToUserCenter('overview');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 font-medium transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-neutral-500" />
                      <span>个人中心概览</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      navigateToUserCenter('api-keys');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 font-medium transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Key className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-neutral-900">API 密钥与模型服务</span>
                    </div>
                    {UserService.isConfigured() ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        已就绪
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                        待配置
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setWorkspaceView('admin-console');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 font-medium transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span className="font-semibold text-neutral-800">后台管理 (Admin)</span>
                    </div>
                    {UserService.isAdmin() ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                        已验证
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-500">
                        D1 鉴权
                      </span>
                    )}
                  </button>

                  <div className="my-1 border-t border-neutral-100" />

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-medium transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>退出登录</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => openAuthModal('login')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 text-xs font-semibold border border-neutral-200/80 transition-all cursor-pointer shadow-2xs"
          >
            <LogIn className="w-3.5 h-3.5 text-emerald-600" />
            <span>登录 / 注册</span>
          </button>
        )}
      </div>
    </header>
  );
};
