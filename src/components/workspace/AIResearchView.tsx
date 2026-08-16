import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ResearchService } from '../../services/quantServices';
import { Sparkles, Send, CheckCircle2, FileText, Database, ArrowRight, Loader2, Download, Search, FileCode, Layers, Cpu, Check, FileCheck, RefreshCw } from 'lucide-react';

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

  // Chat tab state
  const [inputPrompt, setInputPrompt] = useState('');
  const [messages, setMessages] = useState<
    {
      sender: 'user' | 'assistant';
      content: string;
      steps?: string[];
      resultCard?: any;
    }[]
  >([
    {
      sender: 'assistant',
      content: `欢迎来到 Aether AI 研究中心。我可以为您筛选股票、评估因子分布、解析券商研报 PDF 并构建高夏普比率量化策略。`,
      steps: ['已接入 Tushare / SEC EDGAR / 60+ 因子多维知识图谱'],
    },
  ]);
  const [loading, setLoading] = useState(false);

  // Docs tab state
  const [selectedDocId, setSelectedDocId] = useState<string>('doc-1');
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [docPrompt, setDocPrompt] = useState('');
  const [docAnalysisResult, setDocAnalysisResult] = useState<string | null>(null);
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);
  const [addedFactors, setAddedFactors] = useState<Record<string, boolean>>({});

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
        revenue: 'N/A (量化学术)',
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

  const presets = [
    '帮我从沪深300中寻找最近60日趋势较强，同时波动率较低、成交量改善的股票。',
    `详细分析当前股票 [${selectedStockSymbol}] 的动量与估值因子匹配度。`,
    '解释多因子策略在 2024 年如何规避市场系统性回撤。',
    '比较 LSTM 神经网络策略与经典 XGBoost 截面排序模型的 IC 均值区别。',
  ];

  const handleSend = async (text?: string) => {
    const query = text || inputPrompt;
    if (!query.trim() || loading) return;

    setInputPrompt('');
    setMessages((prev) => [...prev, { sender: 'user', content: query }]);
    setLoading(true);

    try {
      const res = await ResearchService.queryAI(query, selectedStockSymbol);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          content: res.text,
          steps: res.steps,
          resultCard: res.resultCard,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: 'assistant', content: '处理请求失败，请稍后重试。' },
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
    }, 1000);
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Selector Tabs */}
      <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'chat' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            AI 多因子对话研究 (Thread)
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'docs' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>研报与财报 PDF 智能解析</span>
          </button>
        </div>

        <span className="text-xs font-mono text-neutral-400">
          AI Engine: Gemini 2.5 Flash · 已同步 Tushare / SEC EDGAR / 研报知识库
        </span>
      </div>

      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Presets Menu */}
          <div className="p-5 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider font-mono">
              Research Presets (预设分析)
            </h3>
            <div className="space-y-2">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p)}
                  className="w-full text-left p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/60 text-xs text-neutral-800 transition-colors line-clamp-3"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Middle Main AI Thread Chat */}
          <div className="lg:col-span-2 p-5 bg-white rounded-2xl border border-neutral-200/80 shadow-sm flex flex-col justify-between h-[640px]">
            {/* Messages Scroll Area */}
            <div className="overflow-y-auto space-y-4 pr-2">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] p-4 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'bg-neutral-50 text-neutral-800 border border-neutral-200/80'
                    }`}
                  >
                    {msg.content}

                    {/* Execution Steps */}
                    {msg.steps && (
                      <div className="mt-3 pt-2.5 border-t border-neutral-200/60 space-y-1 font-mono text-[11px] text-neutral-500">
                        {msg.steps.map((st, sIdx) => (
                          <div key={sIdx} className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{st}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Stock Rank Card */}
                    {msg.resultCard && (
                      <div className="mt-3 pt-3 border-t border-neutral-200/60 space-y-2">
                        <div className="text-xs font-bold text-neutral-900">{msg.resultCard.title}</div>
                        {msg.resultCard.items.map((st: any, sIdx: number) => (
                          <div
                            key={sIdx}
                            onClick={() => navigateToStockDetail(st.symbol)}
                            className="p-2.5 rounded-xl bg-white border border-neutral-200 hover:border-neutral-400 cursor-pointer transition-all flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-neutral-900">{st.name}</span>{' '}
                              <span className="font-mono text-neutral-400">({st.symbol})</span>
                              <div className="text-[11px] text-neutral-500">{st.reason}</div>
                            </div>
                            <span className="font-mono font-bold text-emerald-600">{st.score}分</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-neutral-400 p-3 bg-neutral-50 rounded-xl w-fit">
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-600" />
                  <span>Aether AI 正在执行多因子搜索...</span>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="mt-4 pt-3 border-t border-neutral-100 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="向 Aether AI 发起多因子策略指令..."
                className="flex-1 px-4 py-2.5 bg-neutral-100 text-xs text-neutral-900 rounded-xl focus:outline-none font-medium placeholder:text-neutral-400"
              />
              <button
                type="submit"
                disabled={!inputPrompt.trim() || loading}
                className="p-2.5 bg-neutral-900 text-white rounded-xl hover:bg-black disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Right Research Context Panel */}
          <div className="p-5 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider font-mono">
              Research Context (研究环境)
            </h3>
            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                <span className="text-neutral-400 block text-[10px]">当前默认股票池</span>
                <span className="font-bold text-neutral-900">沪深300 (000300.SH)</span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                <span className="text-neutral-400 block text-[10px]">活动核心因子</span>
                <span className="font-bold text-neutral-900">MOM_60D / LOW_VOL_20D</span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                <span className="text-neutral-400 block text-[10px]">当前选择标的</span>
                <span className="font-bold text-neutral-900">{selectedStockSymbol}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Doc Research Workspace */}
      {activeTab === 'docs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Document Catalog Sidebar */}
          <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                机构研报与财报知识库
              </h3>
              <span className="text-[10px] font-mono bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-200">
                {mockDocs.length} 份可用
              </span>
            </div>

            {/* Doc Filter Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                placeholder="搜索研报、机构或财报关键词..."
                className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 text-xs text-neutral-800 rounded-xl border border-neutral-200 focus:outline-none focus:bg-white transition-colors"
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
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-md scale-[1.01]'
                        : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-200/70'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className={`px-2 py-0.5 rounded ${isSelected ? 'bg-neutral-800 text-purple-300' : 'bg-neutral-200 text-neutral-600'}`}>
                        {doc.category}
                      </span>
                      <span className={isSelected ? 'text-neutral-400' : 'text-neutral-400'}>{doc.date}</span>
                    </div>

                    <h4 className="text-xs font-bold leading-snug line-clamp-2">{doc.title}</h4>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className={isSelected ? 'text-neutral-400 font-mono' : 'text-neutral-500 font-mono'}>{doc.source} · {doc.pages}页</span>
                      <span className={`font-mono text-[10px] ${isSelected ? 'text-emerald-400' : 'text-emerald-600'}`}>{doc.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PDF Viewer & AI Factor Extraction Workbench */}
          <div className="lg:col-span-8 space-y-6">
            {/* Top Doc Header */}
            <div className="p-5 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono mb-1">
                    <span>{selectedDoc.category}</span>
                    <span>·</span>
                    <span>{selectedDoc.source}</span>
                    <span>·</span>
                    <span>{selectedDoc.pages} 页高清晰度解析</span>
                  </div>
                  <h2 className="text-base font-bold text-neutral-900">{selectedDoc.title}</h2>
                </div>
                <button className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shrink-0">
                  <Download className="w-3.5 h-3.5" />
                  <span>下载原始 PDF</span>
                </button>
              </div>

              {/* Key Financial Metrics Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-100 text-xs font-mono">
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                  <span className="text-[10px] text-neutral-400 block">营业收入/预告</span>
                  <span className="font-bold text-neutral-900">{selectedDoc.keyMetrics.revenue}</span>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                  <span className="text-[10px] text-neutral-400 block">净利润增速</span>
                  <span className="font-bold text-emerald-600">{selectedDoc.keyMetrics.netProfit}</span>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                  <span className="text-[10px] text-neutral-400 block">PE / 估值或夏普</span>
                  <span className="font-bold text-neutral-900">{selectedDoc.keyMetrics.peRatio}</span>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                  <span className="text-[10px] text-neutral-400 block">AI 因子置信度</span>
                  <span className="font-bold text-purple-600">{selectedDoc.keyMetrics.factorScore}</span>
                </div>
              </div>
            </div>

            {/* AI Extracted Executive Summary & Alpha Factors */}
            <div className="p-5 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-5">
              <div>
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider font-mono flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  AI 智能研报摘要 (Executive Summary)
                </h3>
                <p className="text-xs text-neutral-700 leading-relaxed bg-purple-50/40 p-4 rounded-xl border border-purple-100">
                  {selectedDoc.summary}
                </p>
              </div>

              {/* Extracted Factors */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider font-mono flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-600" />
                    研报中提炼出的 Alpha 因子候选
                  </h3>
                  <span className="text-[10px] font-mono text-neutral-400">可一键导入平台因子库</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedDoc.extractedFactors.map((f) => {
                    const isAdded = !!addedFactors[f.code];
                    return (
                      <div key={f.code} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-900">{f.name}</span>
                          <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded text-neutral-600 border border-neutral-200">
                            {f.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 leading-tight">{f.desc}</p>
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-200/60 text-xs font-mono">
                          <span className="text-emerald-600 font-bold">IC: {f.ic}</span>
                          <button
                            onClick={() => handleAddFactor(f)}
                            disabled={isAdded}
                            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                              isAdded
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-neutral-900 hover:bg-black text-white'
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
              <div className="pt-4 border-t border-neutral-100 space-y-3">
                <div className="text-xs font-bold text-neutral-900 font-mono">向当前研报提出深度问题:</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={docPrompt}
                    onChange={(e) => setDocPrompt(e.target.value)}
                    placeholder="例如: 提取表4中的资本开支细项，或评估对 2026 年 EBITDA 的影响..."
                    className="flex-1 px-4 py-2 bg-neutral-100 text-xs text-neutral-900 rounded-xl border border-neutral-200 focus:outline-none focus:bg-white font-medium"
                  />
                  <button
                    onClick={() => handleAnalyzeDocPrompt()}
                    disabled={!docPrompt.trim() || isAnalyzingDoc}
                    className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition-colors flex items-center gap-1.5"
                  >
                    {isAnalyzingDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>AI 研报分析</span>
                  </button>
                </div>

                {docAnalysisResult && (
                  <div className="p-4 bg-neutral-900 text-neutral-100 rounded-xl text-xs font-mono leading-relaxed whitespace-pre-wrap animate-in fade-in duration-300">
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

