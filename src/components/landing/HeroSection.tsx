import React from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowRight, Sparkles, ChevronDown, Activity, Zap, Layers } from 'lucide-react';

export const HeroSection: React.FC = () => {
  const { enterWorkspaceWithTransition } = useApp();

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 px-6 bg-[#fbfbfd] overflow-hidden">
      {/* Background Abstract Financial Visual Canvas Effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
        <svg
          className="w-full h-full text-neutral-300"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="curveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d1d5db" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#9ca3af" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#374151" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <path
            d="M 0 450 Q 300 300 600 480 T 1200 320 T 1800 400"
            fill="none"
            stroke="url(#curveGrad)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className="animate-pulse duration-[3000ms]"
          />
          <path
            d="M 0 520 Q 400 380 800 500 T 1600 360"
            fill="none"
            stroke="url(#curveGrad)"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-neutral-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] text-xs font-medium text-neutral-700">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Penguin Quant 2.0 深度融合大模型与 Alpha 因子库</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-neutral-900 tracking-tight font-sans leading-[1.15]">
          让市场数据成为 <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-800">
            可以理解的结构。
          </span>
        </h1>

        {/* Subtitles */}
        <p className="text-lg sm:text-xl text-neutral-600 font-normal max-w-2xl mx-auto leading-relaxed">
          AI 原生的量化研究、策略验证与市场分析平台。
          <br />
          <span className="text-neutral-500 text-base">
            覆盖 A 股与美股，从数据、因子、策略到回测与执行。
          </span>
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={() => enterWorkspaceWithTransition('overview')}
            className="w-full sm:w-auto px-8 py-4 bg-neutral-900 hover:bg-black text-white font-semibold text-sm rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 group"
          >
            <span>进入工作台</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <a
            href="#demo"
            className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-neutral-50 text-neutral-800 font-semibold text-sm rounded-2xl border border-neutral-200/90 shadow-sm hover:shadow transition-all text-center"
          >
            探索产品终端
          </a>
        </div>

        {/* Feature Highlights Pills */}
        <div className="pt-10 flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-neutral-500">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>沪深300 / 标普500 实时因子</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            <span>AI 大模型策略多步推理</span>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Python/C++ 级回测拟合精度</span>
          </div>
        </div>
      </div>

      {/* Scroll Down Hint */}
      <a
        href="#noise-structure"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center text-xs font-medium text-neutral-400 hover:text-neutral-600 transition-colors animate-bounce"
      >
        <span className="mb-1">向下滚动探索</span>
        <ChevronDown className="w-4 h-4" />
      </a>
    </section>
  );
};
