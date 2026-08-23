import React, { useState, useEffect } from 'react';
import { Database, Filter, Cpu, BarChart3, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

export const NoiseToStructureSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(2);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const pipelineSteps = [
    {
      id: 1,
      title: '原始市场数据',
      desc: '行情数据 · 财务数据 · 研报文档 · 市场舆情 · 自定义 CSV/XLSX',
      icon: <Database className="w-5 h-5 text-blue-600" />,
      tag: '5,300+ 标的',
    },
    {
      id: 2,
      title: '数据清洗与处理',
      desc: '复权因子对齐 · 缺失值填充 · MAD 去极值 · Z-Score 标准化',
      icon: <Filter className="w-5 h-5 text-amber-600" />,
      tag: '99.94% 准确率',
    },
    {
      id: 3,
      title: '因子库与因子实验',
      desc: '动量 · 价值 · 质量 · 60D 低波动 · AI 语义舆情因子',
      icon: <Cpu className="w-5 h-5 text-purple-600" />,
      tag: '60+ 核心因子',
    },
    {
      id: 4,
      title: '策略构建与历史回测',
      desc: '截面选股 · 印花税/滑点扣减 · Sharpe 1.34 · 最大回撤 -14.2%',
      icon: <BarChart3 className="w-5 h-5 text-emerald-600" />,
      tag: '全天候回测',
    },
    {
      id: 5,
      title: '组合管理与风控执行',
      desc: '行业暴露限制 · 单股仓位上限 10% · 模拟交易/QMT 预留',
      icon: <ShieldCheck className="w-5 h-5 text-indigo-600" />,
      tag: '实时风控卫士',
    },
  ];

  // Auto-jump to the next card every 3 seconds if not hovered
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev % pipelineSteps.length) + 1);
    }, 3000);

    return () => clearInterval(interval);
  }, [isPaused, pipelineSteps.length]);

  return (
    <section id="noise-structure" className="py-24 px-6 bg-white border-y border-neutral-200/60">
      <div className="max-w-6xl mx-auto space-y-16">
        {/* Title */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="text-xs font-semibold font-mono text-neutral-400 tracking-widest uppercase">
            STRUCTURE FROM NOISE
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight leading-tight">
            市场制造噪声。 <br />
            <span className="text-neutral-500 font-light">
              Penguin Quant 负责找到结构。
            </span>
          </h2>
          <p className="text-base text-neutral-600 font-normal">
            将散乱的海量数据，转化为可计算、可验证、可执行的定量阿尔法信号。
          </p>
        </div>

        {/* Pipeline Interactive Diagram */}
        <div
          className="grid grid-cols-1 lg:grid-cols-5 gap-4 relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {pipelineSteps.map((step) => {
            const isActive = step.id === activeStep;
            return (
              <div
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                onMouseEnter={() => setActiveStep(step.id)}
                className={`p-6 rounded-2xl cursor-pointer transition-all duration-500 ease-out relative border select-none ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-2xl scale-105 border-neutral-900 z-10 -translate-y-1'
                    : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-200/80 scale-100 hover:scale-[1.02]'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                      isActive ? 'bg-neutral-800 text-white' : 'bg-white shadow-sm'
                    }`}
                  >
                    {step.icon}
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full transition-colors duration-300 ${
                      isActive
                        ? 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                        : 'bg-neutral-200/70 text-neutral-600'
                    }`}
                  >
                    {step.tag}
                  </span>
                </div>

                <div className="text-xs font-mono font-bold text-neutral-400 mb-1">
                  0{step.id} PHASE
                </div>
                <h3 className="text-base font-bold mb-2 transition-colors duration-300">{step.title}</h3>
                <p
                  className={`text-xs leading-relaxed transition-colors duration-300 ${
                    isActive ? 'text-neutral-300' : 'text-neutral-500'
                  }`}
                >
                  {step.desc}
                </p>

                {isActive && (
                  <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center gap-1.5 text-xs text-amber-300 font-medium animate-fadeIn">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>自动计算中</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Flow indicator with active step progress */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-neutral-400">
            <span>原始杂乱海量行情</span>
            <ArrowRight className="w-4 h-4 text-neutral-300" />
            <span className="text-neutral-800 font-bold">结构化阿尔法收益</span>
          </div>

          {/* Progress dots indicator */}
          <div className="flex items-center gap-1.5">
            {pipelineSteps.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveStep(s.id)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s.id === activeStep
                    ? 'w-6 bg-neutral-900'
                    : 'w-1.5 bg-neutral-300 hover:bg-neutral-400'
                }`}
                aria-label={`Jump to phase ${s.id}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

