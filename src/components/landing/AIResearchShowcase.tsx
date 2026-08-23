import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Check, ArrowRight, Terminal, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AIResearchShowcase: React.FC = () => {
  const { enterWorkspaceWithTransition } = useApp();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [hasInViewBeenTriggered, setHasInViewBeenTriggered] = useState(false);
  
  const fullPrompt = '“帮我从沪深300中寻找最近60日趋势较强，同时波动率较低、成交量改善的股票。”';
  const [typedText, setTypedText] = useState('');
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [isTypingComplete, setIsTypingComplete] = useState(false);

  const steps = [
    { name: '语义理解', desc: '提取条件: 沪深300, 60日趋势, 低波动, 量能改善' },
    { name: '确定股票池', desc: '标的范围: 000300.SH 成分股 (300 只标的)' },
    { name: '因子提取', desc: '匹配 MOM_60D, LOW_VOL_20D, VOL_BREAKOUT' },
    { name: '截面扫描', desc: '执行正交化去极值 & Z-Score 排名 (300/300 已完成)' },
    { name: '生成候选组合', desc: '输出推荐 Top 10 多因子阿尔法股票池' },
  ];

  // Observer to trigger typewriter effect ONLY when scrolled into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasInViewBeenTriggered) {
          setHasInViewBeenTriggered(true);
        }
      },
      { threshold: 0.25 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [hasInViewBeenTriggered]);

  // Character-by-character typewriter effect triggered on scroll view or replay
  const startTypewriter = () => {
    setTypedText('');
    setActiveStepIndex(-1);
    setIsTypingComplete(false);

    let charIdx = 0;
    const typingInterval = setInterval(() => {
      if (charIdx < fullPrompt.length) {
        charIdx++;
        setTypedText(fullPrompt.slice(0, charIdx));
      } else {
        clearInterval(typingInterval);
        setIsTypingComplete(true);
      }
    }, 40); // 40ms per letter for natural typing speed
  };

  useEffect(() => {
    if (hasInViewBeenTriggered) {
      startTypewriter();
    }
  }, [hasInViewBeenTriggered]);

  // Sequential pipeline step reveal after typing completes
  useEffect(() => {
    if (!isTypingComplete) {
      if (typedText.length > 6 && activeStepIndex < 0) setActiveStepIndex(0);
      return;
    }

    let stepCounter = activeStepIndex < 0 ? 0 : activeStepIndex;
    const stepInterval = setInterval(() => {
      if (stepCounter < steps.length - 1) {
        stepCounter++;
        setActiveStepIndex(stepCounter);
      } else {
        clearInterval(stepInterval);
      }
    }, 350);

    return () => clearInterval(stepInterval);
  }, [isTypingComplete, typedText.length]);

  return (
    <section ref={sectionRef} id="ai-research" className="py-24 px-6 bg-white border-t border-neutral-200/60">
      <div className="max-w-6xl mx-auto space-y-16">
        <div className="text-center space-y-3">
          <span className="text-xs font-semibold font-mono text-purple-600 tracking-widest uppercase">
            AI RESEARCH ENGINE
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight">
            向市场提出更好的问题。
          </h2>
          <p className="text-sm text-neutral-500 max-w-xl mx-auto">
            无需繁琐的代码编写，用自然语言即可驱动高精度的多因子横截面股票扫描。
          </p>
        </div>

        {/* Prompt Terminal Box */}
        <div className="max-w-3xl mx-auto bg-neutral-900 text-white rounded-2xl shadow-2xl overflow-hidden border border-neutral-800 transition-all hover:border-purple-500/40 hover:shadow-purple-900/20">
          <div className="px-4 py-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-mono text-neutral-400">Penguin Quant AI Co-Pilot Terminal</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={startTypewriter}
                title="重新播放打字效果"
                className="text-neutral-400 hover:text-white text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50"
              >
                <RefreshCw className="w-3 h-3 text-purple-400" />
                <span className="text-[10px] font-mono">重播打字</span>
              </button>
              <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-mono rounded-full">
                Gemini 2.5 Flash
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* User Prompt with Typewriter Effect */}
            <div className="p-4 bg-neutral-800/80 rounded-xl border border-neutral-700/60 flex items-start gap-3 min-h-[80px] shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <div className="text-[11px] font-mono text-neutral-400 mb-1 flex items-center justify-between">
                  <span>PROMPT</span>
                  <span className="text-[10px] text-purple-400 font-mono">
                    {isTypingComplete ? '● 正在执行算法图谱...' : '实时逐字敲打中...'}
                  </span>
                </div>
                <div className="text-sm font-medium text-neutral-100 font-sans leading-relaxed">
                  {typedText}
                  <span className="inline-block w-2 h-4 bg-purple-400 ml-1 animate-pulse align-middle" />
                </div>
              </div>
            </div>

            {/* Execution Steps */}
            <div className="space-y-3 pt-2">
              <div className="text-xs font-mono text-neutral-400 flex items-center justify-between">
                <span>EXECUTION PIPELINE:</span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {activeStepIndex >= 4 ? '100% 完成' : `${Math.max(0, (activeStepIndex + 1) * 20)}%`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {steps.map((st, idx) => {
                  const isDone = idx <= activeStepIndex;
                  const isCurrent = idx === activeStepIndex;
                  return (
                    <div
                      key={idx}
                      onClick={() => setActiveStepIndex(idx)}
                      className={`p-3 rounded-xl border transition-all duration-300 cursor-pointer ${
                        isCurrent
                          ? 'bg-purple-950/80 border-purple-500 text-white shadow-lg shadow-purple-900/40 scale-105 z-10'
                          : isDone
                          ? 'bg-neutral-800/90 border-emerald-500/50 text-neutral-200'
                          : 'bg-neutral-950/80 border-neutral-800/80 text-neutral-600 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                        <span>STEP 0{idx + 1}</span>
                        {isDone && <Check className="w-3.5 h-3.5 text-emerald-400 animate-in zoom-in duration-200" />}
                      </div>
                      <div className="text-xs font-bold mb-1">{st.name}</div>
                      <div className="text-[10px] text-neutral-400 leading-tight line-clamp-2">{st.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action CTA inside */}
            <div className="pt-2 flex items-center justify-between border-t border-neutral-800 text-xs">
              <span className="text-neutral-400 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                已就绪 · 输出 10 只目标股票
              </span>
              <button
                onClick={() => enterWorkspaceWithTransition('ai-research')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg flex items-center gap-2 transition-all shadow-md hover:shadow-purple-600/30 group"
              >
                <span>在 AI 工作台体验</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

