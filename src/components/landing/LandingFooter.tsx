import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowRight, BookOpen, RotateCcw } from 'lucide-react';

export const LandingFooter: React.FC = () => {
  const { enterWorkspaceWithTransition } = useApp();
  const [stage, setStage] = useState<number>(0); // 0: reset, 1: 研究, 2: 验证, 3: 理解, 4: subtitle & buttons
  const sectionRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef<boolean>(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          triggerSequence();
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const triggerSequence = () => {
    setStage(0);
    setTimeout(() => setStage(1), 300);   // 研究
    setTimeout(() => setStage(2), 900);   // 验证
    setTimeout(() => setStage(3), 1500);  // 理解
    setTimeout(() => setStage(4), 2100);  // Subtitle + CTA buttons
  };

  return (
    <footer ref={sectionRef} className="bg-white border-t border-neutral-200/80 pt-28 pb-16 px-6">
      <div className="max-w-5xl mx-auto text-center space-y-12">
        {/* Main Final CTA */}
        <div className="space-y-6 relative">
          {/* Replay Button */}
          <button
            onClick={triggerSequence}
            className="absolute -top-10 right-0 text-neutral-400 hover:text-neutral-900 text-xs flex items-center gap-1 transition-colors"
            title="重新播放渐进动画"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px]">重播动画</span>
          </button>

          {/* Sequential Heading Reveal */}
          <h2 className="text-4xl sm:text-6xl font-black text-neutral-900 tracking-tight flex items-center justify-center gap-3 sm:gap-5 min-h-[72px]">
            <span
              className={`transition-all duration-700 ${
                stage >= 1
                  ? 'opacity-100 translate-y-0 scale-100'
                  : 'opacity-0 translate-y-8 scale-90'
              }`}
            >
              研究。
            </span>
            <span
              className={`transition-all duration-700 ${
                stage >= 2
                  ? 'opacity-100 translate-y-0 scale-100'
                  : 'opacity-0 translate-y-8 scale-90'
              }`}
            >
              验证。
            </span>
            <span
              className={`transition-all duration-700 ${
                stage >= 3
                  ? 'opacity-100 translate-y-0 scale-100 text-purple-600'
                  : 'opacity-0 translate-y-8 scale-90'
              }`}
            >
              理解。
            </span>
          </h2>

          {/* Subtitle */}
          <p
            className={`text-base sm:text-lg text-neutral-500 max-w-lg mx-auto font-normal transition-all duration-700 ${
              stage >= 4
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4'
            }`}
          >
            用更结构化的方式理解市场。开启您的 AI 原生量化分析之旅。
          </p>

          {/* CTA Buttons */}
          <div
            className={`flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 transition-all duration-700 ${
              stage >= 4
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-6 scale-95 pointer-events-none'
            }`}
          >
            <button
              onClick={() => enterWorkspaceWithTransition('overview')}
              className="w-full sm:w-auto px-9 py-4 bg-neutral-900 hover:bg-black text-white font-bold text-sm rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group"
            >
              <span>进入 AetherQuant 工作台</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => enterWorkspaceWithTransition('doc-research')}
              className="w-full sm:w-auto px-8 py-4 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 font-semibold text-sm rounded-2xl transition-colors inline-flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4 text-neutral-600" />
              <span>查看平台研究文档</span>
            </button>
          </div>
        </div>

        {/* Footer Subtext */}
        <div className="pt-20 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg overflow-hidden bg-white flex items-center justify-center border border-neutral-200/80 shadow-2xs p-0.5">
              <img src="/logo.png" alt="AQ" className="w-full h-full object-contain rounded-sm" />
            </div>
            <span className="font-bold text-neutral-900">AetherQuant</span>
            <span>© 2026 AetherQuant AI Lab. 版权所有。</span>
          </div>
          <div className="flex items-center gap-6 text-neutral-500 font-medium">
            <a href="#demo" className="hover:text-neutral-900 transition-colors">终端演示</a>
            <a href="#ai-research" className="hover:text-neutral-900 transition-colors">AI研究</a>
            <a href="#data" className="hover:text-neutral-900 transition-colors">数据中心</a>
            <a href="#execution" className="hover:text-neutral-900 transition-colors">风控卫士</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

