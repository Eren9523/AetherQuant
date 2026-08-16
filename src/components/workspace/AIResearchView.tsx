import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ResearchService } from '../../services/quantServices';
import {
  Cpu,
  Send,
  CheckCircle2,
  FileText,
  Loader2,
  Download,
  Search,
  Layers,
  Check,
  TrendingUp,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Database,
  BarChart3,
} from 'lucide-react';

export const AIResearchView: React.FC = () => {
  const { workspaceView, selectedStockSymbol, navigateToStockDetail, addFactorToLibrary } = useApp();
  const [activeTab, setActiveTab] = useState<'chat' | 'docs'>(
    workspaceView === 'doc-research' ? 'docs' : 'chat'
  );

  useEffect(() => {
    if (workspaceView === 'doc-research') {
      setActiveTab('docs');
    } else if (workspaceView === 'ai-research') {
      setActiveTab('chat');
    }
  }, [workspaceView]);

  // Chat state
  const [inputPrompt, setInputPrompt] = useState('');
  const [messages, setMessages] = useState<
    {
      id: string;
      sender: 'user' | 'assistant';
      content: string;
      steps?: string[];
      resultCard?: any;
      timestamp?: string;
    }[]
  >([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      content: `你好！我是 Aether 量化研究助手。你可以用自然语言告诉我筛选逻辑或策略想法。例如：“帮我从沪深300中寻找最近60日趋势较强，同时波动率较低、成交量改善的股票”`,
      steps: ['已接入 AKShare / SEC EDGAR / 60+ 因子横截面图谱与实时多因子引擎'],
    },
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Docs state
  const [selectedDocId, setSelectedDocId] = useState<string>('doc-1');
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [docPrompt, setDocPrompt] = useState('');
  const [docAnalysisResult, setDocAnalysisResult] = useState<string | null>(null);
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);
  const [addedFactors, setAddedFactors] = useState<Record<string, boolean>>({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const presets = [
    {
      id: 'p1',
      title: '寻找沪深300中60日动量前20%且低波动股票',
      query: '帮我从沪深300中寻找最近60日动量排名位于前20%，同时20日已实现波动率较低、换手率改善的股票。',
    },
    {
      id: 'p2',
      title: '比较贵州茅台与宁德时代的质量因子与估值性价比',
      query: '对比分析 贵州茅台 (600519.SH) 与 宁德时代 (300750.SZ) 的 ROE 稳定性、质量因子评分与当前估值性价比。',
    },
    {
      id: 'p3',
      title: '构建以 ROE 为核心的质量成长量化策略方案',
      query: '请为我设计一个以 ROE 为核心的 A 股质量成长多因子策略方案，包含因子权重配置、调仓周期与回撤控制建议。',
    },
    {
      id: 'p4',
      title: '解释全市场 RankIC 均值异动原因',
      query: '请结合当前宏观利率、行业轮动与流动性分布，深度解释全市场动量与波动率因子的 RankIC 均值异动原因。',
    },
    {
      id: 'p5',
      title: `分析标的 [${selectedStockSymbol}] 动量与估值匹配度`,
      query: `请基于最新截面数据，详细分析标的 [${selectedStockSymbol}] 的多因子综合评分、筹码分布及行业同业分位值。`,
    },
  ];

  const mockDocs = [
    {
      id: 'doc-1',
      title: '贵州茅台 (600519.SH) 2025年年度业绩预告与多因子视角深度解析.pdf',
      source: '华泰证券研究所',
      pages: 32,
      date: '2026-02-10',
      status: '已提炼 14 个因子',
      category: 'A股研报',
      keyMetrics: {
        revenue: '¥1685.2 亿元 (+15.2%)',
        netProfit: '¥862.0 亿元 (+16.1%)',
        peRatio: '24.2x',
        factorScore: '92.5/100',
      },
      extractedFactors: [
        { code: 'MAOTAI_VAL_ROE', name: '茅台专用 ROE 稳定度', ic: '0.084', desc: '持续 5 年 ROE > 25% 且波动率 < 3%' },
        { code: 'BEVERAGE_MOM_30D', name: '白酒板块 30D 动量溢价', ic: '0.062', desc: '基于渠道批价与动量组合收益' },
      ],
      summary: '公司 2025 年营业收入和归母净利润保持双位数稳健增长，系列酒产品结构优化超预期。直销渠道占比进一步提升至 46.2%，现金流充沛。基于多因子评估模型，其质量因子（QUALITY_ROE）与估值安全边际极其优异。',
    },
    {
      id: 'doc-2',
      title: 'NVIDIA (NVDA.O) Q4 2025 Financial Report & Blackwell Architecture Impact.pdf',
      source: 'SEC EDGAR / Goldman Sachs',
      pages: 48,
      date: '2026-02-22',
      status: '已提炼 18 个因子',
      category: '美股财报',
      keyMetrics: {
        revenue: '$38.2B (+92.0%)',
        netProfit: '$21.5B (+114%)',
        peRatio: '38.5x',
        factorScore: '96.0/100',
      },
      extractedFactors: [
        { code: 'AI_CAPEX_SURGE', name: '云厂商 AI CAPEX 资本支出因子', ic: '0.112', desc: '四大云厂商 CAPEX 增速同向加权' },
        { code: 'NVDA_MARGIN_SURPRISE', name: '毛利率超预期因子 (Gross Margin Surprise)', ic: '0.078', desc: '实际 Gross Margin - 市场共识预期' },
      ],
      summary: 'Data Center 收入再创新高，Blackwell 芯片满产满销。毛利率维持在 75.2% 高位。算力需求由大模型训练扩展至推理侧（Inference Cluster），持续看好其阿尔法动量与盈利超预期因子。',
    },
    {
      id: 'doc-3',
      title: '2026 年 A股 AI 多因子选股策略与机器学习模型 IC 衰减研究.pdf',
      source: 'AetherQuant AI Lab',
      pages: 24,
      date: '2026-03-01',
      status: '已提炼 8 个因子',
      category: '量化前沿研报',
      keyMetrics: {
        revenue: 'N/A (学术论文)',
        netProfit: 'N/A',
        peRatio: 'Sharpe 2.14',
        factorScore: '98.0/100',
      },
      extractedFactors: [
        { code: 'ML_RANKIC_DECAY', name: '机器学习 RankIC 20D 衰减因子', ic: '0.095', desc: '针对高频与日线因子的正交衰减补偿' },
      ],
      summary: '本文系统评估了非线性神经网络与 XGBoost 算法在 A股横截面排序中的有效性。实验表明，加入 NLP 研报舆情语义因子后，Top 10 组合多头年化收益率提升 6.8%，最大回撤下降 3.4%。',
    },
  ];

  const selectedDoc = mockDocs.find((d) => d.id === selectedDocId) || mockDocs[0];

  const handleSend = async (queryText?: string) => {
    const query = queryText || inputPrompt;
    if (!query.trim() || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;

    setInputPrompt('');
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        content: query,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setLoading(true);

    try {
      const res = await ResearchService.queryAI(query, selectedStockSymbol);
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          sender: 'assistant',
          content: res.text,
          steps: res.steps,
          resultCard: res.resultCard,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          sender: 'assistant',
          content: '处理请求失败，请稍后重试或检查网络状态。',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeDocPrompt = (text?: string) => {
    const query = text || docPrompt;
    if (!query) return;
    setDocPrompt('');
    setIsAnalyzingDoc(true);

    setTimeout(() => {
      setIsAnalyzingDoc(false);
      setDocAnalysisResult(
        `针对《${selectedDoc.title}》的分析结果：\n` +
        `1. 核心催化剂：${selectedDoc.summary.slice(0, 80)}...\n` +
        `2. 提取的量化信号：已自动转换 ${selectedDoc.extractedFactors.length} 个因子特征，包含 ${selectedDoc.extractedFactors.map(f => f.code).join(', ')}。\n` +
        `3. 估值与因子匹配：针对 ${selectedDoc.keyMetrics.peRatio} 估值区间，建议在策略构建器中分配 15% 权重。`
      );
    }, 900);
  };

  const handleAddFactor = (f: { code: string; name: string; ic: string; desc: string }) => {
    addFactorToLibrary({
      id: f.code,
      code: f.code,
      name: f.name,
      category: '价值',
      ic: parseFloat(f.ic),
      rankIc: parseFloat(f.ic) * 1.1,
      icIr: 1.85,
      turnover: '12%',
      coverage: '99.5%',
      formula: `ZScore(MAD_Filter(${f.code}))`,
      description: f.desc,
    });
    setAddedFactors((prev) => ({ ...prev, [f.code]: true }));
  };

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      {/* Top Header matching exact screenshot style & logo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Exact Logo Icon from Screenshot */}
          <div className="p-2 rounded-xl text-slate-900">
            <Cpu className="w-8 h-8 text-slate-900 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 font-sans">
              AI 交互式量化研究终端
            </h1>
            <p className="text-xs md:text-sm text-slate-500 font-normal mt-0.5">
              基于大模型与向量数据库的交互式因子挖掘、多维归因与自然语言策略构建
            </p>
          </div>
        </div>

        {/* Right Floating Badge / Glowing Logo from Screenshot */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Sub-view Switcher pills */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'chat'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              交互研究
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'docs'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>研报解析</span>
            </button>
          </div>

          {/* Screenshot AetherQuant Glowing App Badge */}
          <div className="relative group cursor-pointer" title="AetherQuant AI Terminal Online">
            <div className="w-11 h-11 rounded-2xl bg-slate-950 flex items-center justify-center border border-slate-800 shadow-md shadow-emerald-500/10 transition-transform group-hover:scale-105">
              {/* Custom High-Tech Trajectory SVG matching image icon */}
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M4 19C7 18 12 16 17 7"
                  stroke="#34d399"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="17.5" cy="6.5" r="2" fill="#34d399" />
              </svg>
            </div>
            {/* Subtle Green Pulse */}
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout from Screenshot */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Sidebar: 研究预设模版 & 环境 (4 cols on xl, equal height with right box) */}
          <div className="lg:col-span-5 xl:col-span-4 bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between h-full space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm font-semibold text-slate-500">
                研究预设模版
              </span>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {presets.length} 个模板
              </span>
            </div>

            <div className="space-y-2.5">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleSend(preset.query)}
                  className="w-full text-left p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/70 hover:border-slate-300 text-xs md:text-sm text-slate-700 font-normal leading-snug transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-sm"
                >
                  {preset.title}
                </button>
              ))}
            </div>

            {/* Research Context & Benchmarks (量化研究环境) */}
            <div className="pt-4 border-t border-slate-100 space-y-3 mt-auto">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  量化研究环境与基准
                </span>
                <span className="text-[10px] font-mono text-emerald-600 font-medium bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200/50 flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  实时就绪
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 text-xs font-mono">
                <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <span className="text-[10px] text-slate-400 font-sans block truncate">默认基准与标的池</span>
                    <span className="font-bold text-slate-800 text-xs font-mono truncate block">沪深300 (000300.SH)</span>
                  </div>
                  <span className="text-[10px] text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs shrink-0 whitespace-nowrap">
                    300 只标的
                  </span>
                </div>

                <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <span className="text-[10px] text-slate-400 font-sans block truncate">主活动特征因子</span>
                    <span className="font-bold text-slate-800 text-xs font-mono truncate block">MOM_60 / VOL_20</span>
                  </div>
                  <span className="text-[10px] text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200/60 font-sans shrink-0 whitespace-nowrap">
                    动量低波
                  </span>
                </div>

                <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <span className="text-[10px] text-slate-400 font-sans block truncate">仿真撮合与税费制度</span>
                    <span className="font-semibold text-slate-700 text-[11px] font-mono truncate block">
                      T+1 · 印花税0.05% · 佣金0.03%
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs font-sans shrink-0 whitespace-nowrap">
                    A股标准
                  </span>
                </div>

                <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <span className="text-[10px] text-slate-400 font-sans block truncate">当前焦点分析标的</span>
                    <span className="font-bold text-slate-900 text-xs font-mono truncate block">{selectedStockSymbol}</span>
                  </div>
                  <button
                    onClick={() => navigateToStockDetail(selectedStockSymbol)}
                    className="text-[10px] text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs transition-colors flex items-center gap-0.5 font-sans shrink-0 whitespace-nowrap"
                  >
                    <span>深度看盘</span>
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Context Bottom Bar */}
            <div className="pt-2.5 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between font-mono">
              <span>AKShare + DeepSeek + D1</span>
              <span className="text-slate-500">v1.2.0 Quant Engine</span>
            </div>
          </div>

          {/* Right Main Chat Card: Aligned height and column span */}
          <div className="lg:col-span-7 xl:col-span-8 bg-white p-5 md:p-7 rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between h-full min-h-[640px] max-h-[820px]">
            {/* Scrollable Conversation Stream */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 -mr-2">
              {messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {/* Assistant or User Message Bubble */}
                  <div
                    className={`max-w-[92%] p-4 md:p-5 rounded-2xl text-xs md:text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-slate-900 text-white shadow-sm font-medium'
                        : 'bg-slate-50/80 text-slate-700 border border-slate-100/90'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {/* Step Badges (if any) */}
                    {msg.steps && msg.steps.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-slate-200/60 space-y-1.5 font-mono text-[11px] text-slate-500">
                        {msg.steps.map((st, sIdx) => (
                          <div key={sIdx} className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{st}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Result Card: Stock Ranking / Factor Details */}
                    {msg.resultCard && (
                      <div className="mt-3.5 pt-3.5 border-t border-slate-200/60 space-y-2.5">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{msg.resultCard.title}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {msg.resultCard.items.map((st: any, sIdx: number) => (
                            <div
                              key={sIdx}
                              onClick={() => navigateToStockDetail(st.symbol)}
                              className="p-3 rounded-xl bg-white border border-slate-200/80 hover:border-slate-400 hover:shadow-sm cursor-pointer transition-all flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900 text-xs">{st.name}</span>
                                  <span className="font-mono text-slate-400 text-[10px]">{st.symbol}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 truncate mt-0.5">{st.reason}</div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="font-mono font-bold text-emerald-600 text-xs">{st.score}分</span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2.5 text-xs text-slate-500 p-3.5 bg-slate-50 rounded-2xl w-fit border border-slate-100 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                  <span>Aether AI 正在执行全市场多因子计算与知识检索...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input Area matching screenshot */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3"
            >
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="输入你的量化问题或指令..."
                className="flex-1 px-4 py-3.5 bg-white text-xs md:text-sm text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 font-normal placeholder:text-slate-400 transition-all"
              />
              <button
                type="submit"
                disabled={!inputPrompt.trim() || loading}
                aria-label="发送量化指令"
                className="p-3.5 bg-slate-900 hover:bg-slate-950 text-white rounded-xl disabled:opacity-40 transition-all flex items-center justify-center shrink-0 shadow-sm hover:shadow"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Document PDF Research Tab */}
      {activeTab === 'docs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Document Catalog Sidebar */}
          <div className="lg:col-span-4 bg-white p-5 rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                机构研报与财报知识库
              </h3>
              <span className="text-[10px] font-mono bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-200">
                {mockDocs.length} 份可用
              </span>
            </div>

            {/* Doc Filter Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                placeholder="搜索研报、机构或财报关键词..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 text-xs text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:bg-white transition-colors"
              />
            </div>

            {/* Docs List */}
            <div className="space-y-3 overflow-y-auto max-h-[580px] pr-1">
              {mockDocs.map((doc) => {
                const isSelected = doc.id === selectedDocId;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.01]'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200/70'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className={`px-2 py-0.5 rounded ${isSelected ? 'bg-slate-800 text-purple-300' : 'bg-slate-200 text-slate-600'}`}>
                        {doc.category}
                      </span>
                      <span className={isSelected ? 'text-slate-400' : 'text-slate-400'}>{doc.date}</span>
                    </div>

                    <h4 className="text-xs font-bold leading-snug line-clamp-2">{doc.title}</h4>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className={isSelected ? 'text-slate-400 font-mono' : 'text-slate-500 font-mono'}>
                        {doc.source} · {doc.pages}页
                      </span>
                      <span className={`font-mono text-[10px] ${isSelected ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        {doc.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PDF Viewer & AI Factor Extraction Workbench */}
          <div className="lg:col-span-8 space-y-6">
            {/* Top Doc Header */}
            <div className="p-5 md:p-6 bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mb-1">
                    <span>{selectedDoc.category}</span>
                    <span>·</span>
                    <span>{selectedDoc.source}</span>
                    <span>·</span>
                    <span>{selectedDoc.pages} 页高清晰度解析</span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900">{selectedDoc.title}</h2>
                </div>
                <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shrink-0">
                  <Download className="w-3.5 h-3.5" />
                  <span>下载原始 PDF</span>
                </button>
              </div>

              {/* Key Financial Metrics Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs font-mono">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 block">营业收入/预告</span>
                  <span className="font-bold text-slate-900">{selectedDoc.keyMetrics.revenue}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 block">净利润增速</span>
                  <span className="font-bold text-emerald-600">{selectedDoc.keyMetrics.netProfit}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 block">PE / 估值或夏普</span>
                  <span className="font-bold text-slate-900">{selectedDoc.keyMetrics.peRatio}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 block">AI 因子置信度</span>
                  <span className="font-bold text-purple-600">{selectedDoc.keyMetrics.factorScore}</span>
                </div>
              </div>
            </div>

            {/* AI Extracted Executive Summary & Alpha Factors */}
            <div className="p-5 md:p-6 bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  AI 智能研报摘要 (Executive Summary)
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed bg-purple-50/40 p-4 rounded-xl border border-purple-100">
                  {selectedDoc.summary}
                </p>
              </div>

              {/* Extracted Factors */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-600" />
                    研报中提炼出的 Alpha 因子候选
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">可一键导入平台因子库</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedDoc.extractedFactors.map((f) => {
                    const isAdded = !!addedFactors[f.code];
                    return (
                      <div key={f.code} className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{f.name}</span>
                          <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                            {f.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">{f.desc}</p>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs font-mono">
                          <span className="text-emerald-600 font-bold">IC: {f.ic}</span>
                          <button
                            onClick={() => handleAddFactor(f)}
                            disabled={isAdded}
                            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                              isAdded
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-900 hover:bg-black text-white'
                            }`}
                          >
                            {isAdded ? <Check className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                            <span>{isAdded ? '已存入因子库' : '+ 加入因子库'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Doc Q&A Bar */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="text-xs font-bold text-slate-900 font-mono">向当前研报提出深度问题:</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={docPrompt}
                    onChange={(e) => setDocPrompt(e.target.value)}
                    placeholder="例如: 提取表4中的资本开支细项，或评估对 2026 年 EBITDA 的影响..."
                    className="flex-1 px-4 py-2 bg-slate-100 text-xs text-slate-900 rounded-xl border border-slate-200 focus:outline-none focus:bg-white font-medium"
                  />
                  <button
                    onClick={() => handleAnalyzeDocPrompt()}
                    disabled={!docPrompt.trim() || isAnalyzingDoc}
                    className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition-colors flex items-center gap-1.5"
                  >
                    {isAnalyzingDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>AI 研报分析</span>
                  </button>
                </div>

                {docAnalysisResult && (
                  <div className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono leading-relaxed whitespace-pre-wrap animate-in fade-in duration-300">
                    {docAnalysisResult}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


