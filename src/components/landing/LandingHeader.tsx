import React from 'react';
import { useApp } from '../../context/AppContext';
import { Sparkles, ArrowRight, Github } from 'lucide-react';

export const LandingHeader: React.FC = () => {
  const { enterWorkspaceWithTransition } = useApp();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-neutral-200/50 transition-all">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            AQ
          </div>
          <span className="text-lg font-bold text-neutral-900 tracking-tight font-sans">
            Aether<span className="font-light text-neutral-500">Quant</span>
          </span>
          <span className="px-2 py-0.5 text-[10px] font-mono font-medium bg-neutral-100 text-neutral-600 rounded-full border border-neutral-200/80">
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

        {/* Action CTAs */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
          <button
            onClick={() => enterWorkspaceWithTransition('overview')}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow-md transition-all group"
          >
            <span>进入工作台</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </header>
  );
};
