import React from 'react';
import { useApp } from '../../context/AppContext';
import { Sparkles, ArrowRight, Github, LogIn, UserPlus, LogOut, User, ShieldCheck } from 'lucide-react';
import { AetherLogo } from '../common/AetherLogo';

export const LandingHeader: React.FC = () => {
  const { enterWorkspaceWithTransition, isAuthenticated, currentUser, openAuthModal, logout } = useApp();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-neutral-200/50 transition-all">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <AetherLogo size="md" showText={true} textClassName="text-lg" />
          <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-mono font-medium bg-neutral-100 text-neutral-600 rounded-full border border-neutral-200/80">
            AI Native Quant
          </span>
        </div>

        {/* Minimal Nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600">
          <a href="#features" className="hover:text-neutral-900 transition-colors">
            产品
          </a>
          <a href="#ai-research" className="hover:text-neutral-900 transition-colors">
            AI研究
          </a>
          <a href="#data" className="hover:text-neutral-900 transition-colors">
            数据
          </a>
          <a href="#factors" className="hover:text-neutral-900 transition-colors">
            策略与因子
          </a>
          <a href="#backtest" className="hover:text-neutral-900 transition-colors">
            回测
          </a>
          <a href="#execution" className="hover:text-neutral-900 transition-colors">
            风控与执行
          </a>
        </nav>

        {/* Action CTAs & Auth Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <button
                id="landing-user-profile-btn"
                onClick={() => enterWorkspaceWithTransition('user-center')}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 transition-all text-neutral-800 text-xs font-medium"
              >
                <img
                  src={currentUser.avatar || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${encodeURIComponent(currentUser.username || 'QuantLead')}&backgroundColor=f8fafc`}
                  alt={currentUser.name}
                  className="w-5 h-5 rounded-full border border-neutral-300 object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/open-peeps/svg?seed=${encodeURIComponent(currentUser.username || 'QuantLead')}&backgroundColor=f8fafc`;
                  }}
                />
                <span className="max-w-[80px] truncate">{currentUser.name}</span>
                <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                  D1在线
                </span>
              </button>
              <button
                id="landing-logout-btn"
                onClick={() => logout()}
                title="退出当前登录"
                className="p-2 text-neutral-500 hover:text-red-600 hover:bg-neutral-100 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
              <button
                id="landing-enter-workspace-btn"
                onClick={() => enterWorkspaceWithTransition('overview')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow-md transition-all group"
              >
                <span>进入工作台</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                id="landing-auth-btn"
                onClick={() => openAuthModal('login')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white hover:bg-neutral-50 transition-all shadow-xs cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                <span>登录 / 注册</span>
              </button>
              <button
                id="landing-enter-workspace-direct-btn"
                onClick={() => enterWorkspaceWithTransition('overview')}
                className="flex items-center gap-2 px-3.5 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow-md transition-all group cursor-pointer"
              >
                <span>进入工作台</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
