import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ResearchService } from '../../services/quantServices';
import { RUNTIME_CONFIG } from '../../config/runtimeConfig';
import {
  Send,
  CheckCircle2,
  FileText,
  Loader2,
  Download,
  Layers,
  Check,
  TrendingUp,
  Sparkles,
  ChevronRight,
  BarChart3,
  Plus,
  MessageSquare,
  Clock,
  Paperclip,
  Mic,
  Zap,
  Workflow,
  Bot,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  Dice5,
  Trash2,
  Pin,
  Search,
  Activity,
  Database,
  BookOpen,
} from 'lucide-react';

interface PromptCard {
  id: string;
  category: string;
  title: string;
  summary: string;
  prompt: string;
  tags: string[];
  requires_realtime_data?: boolean;
  freshness_weight?: number;
  source_basis?: string[];
  source_symbols?: string[];
  is_stable_template?: boolean;
}

export const AIResearchView: React.FC = () => {
  const { workspaceView, selectedStockSymbol, navigateToStockDetail, addFactorToLibrary } = useApp();

  // Primary Tab: Chat vs Research Docs
  const [activeTab, setActiveTab] = useState<'chat' | 'docs'>(
    workspaceView === 'doc-research' ? 'docs' : 'chat'
  );

  // Model Selection
  const [selectedModel, setSelectedModel] = useState<'v4-flash' | 'v4-pro'>('v4-flash');

  // Sidebar toggle & search
  const [showSidebar, setShowSidebar] = useState(true);
  const [historySearch, setHistorySearch] = useState('');

  // Current active session ID
  const [currentThreadId, setCurrentThreadId] = useState<string>('');

  // Chat State
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
  >([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Audio recording toggle
  const [isRecording, setIsRecording] = useState(false);

  // Attachment Upload Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  // History sessions (loaded from Cloudflare D1 + R2)
  const [threadsList, setThreadsList] = useState<
    {
      id: string;
      title: string;
      active_symbol: string;
      last_message_at: string;
      pinned: boolean;
      message_count: number;
    }[]
  >([]);

  // Prompt Recommendation Cards State (Local Pool + Daily Pool)
  const [promptSeed, setPromptSeed] = useState<number>(101);
  const [displayedPrompts, setDisplayedPrompts] = useState<PromptCard[]>([]);

  // Docs tab state
  const [selectedDocId, setSelectedDocId] = useState<string>('doc-1');
  const [addedFactors, setAddedFactors] = useState<Record<string, boolean>>({});

  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (workspaceView === 'doc-research') {
      setActiveTab('docs');
    } else if (workspaceView === 'ai-research') {
      setActiveTab('chat');
    }
  }, [workspaceView]);

  // Initial Load on Component Mount
  useEffect(() => {
    loadThreadsFromDatabase();
    loadPromptsFromService(promptSeed);
  }, []);

  // Reload prompts when active symbol changes
  useEffect(() => {
    loadPromptsFromService(promptSeed);
  }, [selectedStockSymbol]);

  const loadThreadsFromDatabase = async () => {
    try {
      const fetchedThreads = await ResearchService.getThreads(historySearch, 30);
      if (fetchedThreads && fetchedThreads.length > 0) {
        setThreadsList(fetchedThreads);
        const firstThread = fetchedThreads[0];
        if (firstThread) {
          selectThread(firstThread.id);
        }
      } else {
        createNewThread();
      }
    } catch (err) {
      console.warn('Failed to load threads from database, using initial session:', err);
      createNewThread();
    }
  };

  const loadPromptsFromService = async (seedValue: number) => {
    const prompts = await ResearchService.getRecommendedPrompts({
      limit: 6,
      activeSymbol: selectedStockSymbol,
      seed: seedValue,
    });
    if (prompts && prompts.length > 0) {
      setDisplayedPrompts(prompts);
    } else {
      setDisplayedPrompts(defaultPromptsFallback);
    }
  };

  const handleRefreshPrompts = () => {
    const newSeed = Math.floor(Math.random() * 100000);
    setPromptSeed(newSeed);
    loadPromptsFromService(newSeed);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load thread detail messages
  const selectThread = async (threadId: string) => {
    setCurrentThreadId(threadId);
    const detail = await ResearchService.getThreadDetail(threadId);
    if (detail && detail.messages && detail.messages.length > 0) {
      const formattedMsgs = detail.messages.map((m: any) => ({
        id: m.id,
        sender: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
        steps: m.steps_json ? safeJsonParse(m.steps_json, []) : undefined,
        resultCard: m.result_card_json ? safeJsonParse(m.result_card_json, null) : undefined,
        timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '刚刚',
      }));
      setMessages(formattedMsgs);
    } else {
      // Empty thread fallback to welcome greeting
      setMessages([getWelcomeMessage()]);
    }
  };

  const createNewThread = async () => {
    const welcomeMsg = getWelcomeMessage();
    try {
      const created = await ResearchService.createThread({
        title: '新量化研究会话',
        activeSymbol: selectedStockSymbol,
      });
      const newId = created?.id || `demo_thread_${Date.now()}`;
      setCurrentThreadId(newId);
      setMessages([welcomeMsg]);

      setThreadsList((prev) => [
        {
          id: newId,
          title: created?.title || '新量化研究会话',
          active_symbol: selectedStockSymbol,
          last_message_at: new Date().toISOString(),
          pinned: false,
          message_count: 0,
        },
        ...prev,
      ]);
    } catch (e) {
      console.error('Failed to create thread:', e);
      if (RUNTIME_CONFIG.isDemoMode) {
        const demoId = `demo_thread_${Date.now()}`;
        setCurrentThreadId(demoId);
        setMessages([welcomeMsg]);
      }
    }
  };

  const getWelcomeMessage = () => ({
    id: 'welcome-msg',
    sender: 'assistant' as const,
    content: `你可以使用 AetherQuant 进行量化研究、策略设计与数据分析；部分行情、因子与文档能力将根据当前已连接的数据服务提供。例如：“从沪深300中筛选60日动量排名前20%且波动率较低的股票”`,
    steps: ['支持多因子量化研究与策略设计', '支持量化指标归因与智能分析', '数据与行情服务将根据实际连接环境提供'],
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  // Handle clicking on prompt card -> FILLS COMPOSER ONLY!
  const handlePromptCardClick = (cardPrompt: string) => {
    setInputPrompt(cardPrompt);
    if (composerRef.current) {
      composerRef.current.focus();
    }
  };

  const handleSend = async (overrideText?: string) => {
    const query = (overrideText || inputPrompt).trim();
    if (!query || loading) return;

    let activeId = currentThreadId;
    if (!activeId) {
      try {
        const created = await ResearchService.createThread({
          title: query.slice(0, 24) || '新量化研究会话',
          activeSymbol: selectedStockSymbol,
        });
        activeId = created?.id || `demo_thread_${Date.now()}`;
        setCurrentThreadId(activeId);
      } catch (e) {
        console.error('Failed to create initial thread for prompt:', e);
        if (RUNTIME_CONFIG.isDemoMode) {
          activeId = `demo_thread_${Date.now()}`;
          setCurrentThreadId(activeId);
        } else {
          throw e;
        }
      }
    }

    const userMsgId = `usr_${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      sender: 'user' as const,
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const assistantMsgId = `ast_${Date.now()}`;
    const initialAssistantMsg = {
      id: assistantMsgId,
      sender: 'assistant' as const,
      content: '',
      steps: ['语义解析与实体识别', '加载 Alpha 因子与行情截面', 'DeepSeek 量化大模型推理'],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setInputPrompt('');
    const newMessages = [...messages, userMsg, initialAssistantMsg];
    setMessages(newMessages);
    setLoading(true);

    let accumulatedText = '';

    try {
      await ResearchService.queryAIStream(
        query,
        selectedStockSymbol,
        (chunk) => {
          accumulatedText += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: accumulatedText }
                : msg
            )
          );
        },
        async (full) => {
          accumulatedText = full || accumulatedText;
        }
      );

      const isClean = accumulatedText.trim().length > 0;
      const finalContent = isClean
        ? accumulatedText
        : '⚠️ **[空响应异常 (AI_EMPTY_RESPONSE)]**: 模型未返回任何有效分析文本，请检查提示词或重试。';

      // Finalize messages list
      const finalMsgs = newMessages.map((msg) =>
        msg.id === assistantMsgId
          ? {
              ...msg,
              content: finalContent,
            }
          : msg
      );
      setMessages(finalMsgs);

      // Update thread list
      const titleCandidate = newMessages.find((m) => m.sender === 'user')?.content.slice(0, 24) || '量化策略问答';
      setThreadsList((prev) => {
        const found = prev.some((t) => t.id === activeId);
        if (found) {
          return prev.map((t) =>
            t.id === activeId
              ? { ...t, title: titleCandidate, last_message_at: new Date().toISOString(), message_count: finalMsgs.length }
              : t
          );
        } else {
          return [
            {
              id: activeId,
              title: titleCandidate,
              active_symbol: selectedStockSymbol,
              last_message_at: new Date().toISOString(),
              pinned: false,
              message_count: finalMsgs.length,
            },
            ...prev,
          ];
        }
      });
    } catch (err: any) {
      console.error('Failed to query AI stream:', err);
      const errorCode = err?.code || 'AI_REQUEST_FAILED';
      const errorMessage = err?.message || '无法连接到 AI 服务，请检查上游配置与网络状态';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: accumulatedText
                  ? `${accumulatedText}\n\n⚠️ **[传输中断 (${errorCode})]**: ${errorMessage}`
                  : `⚠️ **AI 服务调用失败 (${errorCode})**: ${errorMessage}\n\n如需配置密钥，请在系统设置或环境变量中设置 \`DEEPSEEK_API_KEY\`。`,
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePinThread = async (e: React.MouseEvent, threadId: string, currentPinned: boolean) => {
    e.stopPropagation();
    const newPinned = !currentPinned;
    await ResearchService.updateThread(threadId, { pinned: newPinned });
    setThreadsList((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, pinned: newPinned } : t))
        .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1))
    );
  };

  const handleDeleteThread = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    await ResearchService.deleteThread(threadId);
    setThreadsList((prev) => prev.filter((t) => t.id !== threadId));

    if (currentThreadId === threadId) {
      createNewThread();
    }
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileName = e.target.files[0].name;
      setUploadedFiles((prev) => [...prev, fileName]);
      setShowUploadModal(false);
      setInputPrompt((prev) => (prev ? `${prev} [附件: ${fileName}]` : `请解析文件【${fileName}】中的多因子与财务数据`));
    }
  };

  const getPromptIcon = (category: string) => {
    if (category.includes('诊股')) return TrendingUp;
    if (category.includes('选股')) return Layers;
    if (category.includes('财报')) return FileText;
    if (category.includes('策略')) return Workflow;
    if (category.includes('宏观')) return RefreshCw;
    if (category.includes('AI') || category.includes('预测')) return Bot;
    return Sparkles;
  };

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
        revenue: '¥1685.2 亿 (+15.2%)',
        netProfit: '¥862.0 亿 (+16.1%)',
        peRatio: '24.2x',
        factorScore: '92.5/100',
      },
      extractedFactors: [
        { code: 'MAOTAI_VAL_ROE', name: '茅台专用 ROE 稳定度', ic: '0.084', desc: '持续 5 年 ROE > 25% 且波动率 < 3%' },
        { code: 'BEVERAGE_MOM_30D', name: '白酒板块 30D 动量溢价', ic: '0.062', desc: '基于渠道批价与动量组合收益' },
      ],
      summary: '公司 2025 年营业收入和归母净利润保持双位数稳健增长，系列酒产品结构优化超预期。直销渠道占比进一步提升至 46.2%，现金流充沛。基于多因子评估模型，其质量因子与估值安全边际极其优异。',
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
      summary: 'Data Center 收入再创新高，Blackwell 芯片满产满销。毛利率维持在 75.2% 高位。算力需求由大模型训练扩展至推理侧，持续看好其阿尔法动量与盈利超预期因子。',
    },
    {
      id: 'doc-3',
      title: '2026 年 A股 AI 多因子选股策略与机器学习模型 IC 衰减研究.pdf',
      source: 'AetherQuant AI Lab',
      pages: 24,
      date: '2026-03-01',
      status: '已提炼 8 个因子',
      category: '量化研报',
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

  return (
    <div className="min-h-[calc(100vh-60px)] bg-slate-50/60 text-slate-800 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      {/* Apple-style Ultra-Clean Top Bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 md:px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title={showSidebar ? '隐藏侧栏' : '显示侧栏'}
          >
            {showSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold tracking-tight text-slate-900">Aether Research</span>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200 font-semibold">
              DeepSeek V4-Flash
            </span>
          </div>
        </div>

        {/* Segmented Control (Apple-Style Pills) */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-full border border-slate-200/80 shadow-2xs">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'chat'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>智能量化问答</span>
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'docs'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>机构研报知识库</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={createNewThread}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-full transition-all shadow-xs flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">新建研究</span>
          </button>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collapsible History Sidebar (Connected to D1 + R2 Storage) */}
        {showSidebar && activeTab === 'chat' && (
          <aside className="w-64 border-r border-slate-200/60 bg-white/70 backdrop-blur-md p-3.5 flex flex-col justify-between shrink-0 transition-all hidden md:flex">
            <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1 pt-1">
                <span className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  历史记录
                </span>
                <span className="font-mono text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                  D1+R2 持久化
                </span>
              </div>

              {/* History Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value);
                    ResearchService.getThreads(e.target.value).then((res) => {
                      if (res) setThreadsList(res);
                    });
                  }}
                  placeholder="搜索研究会话..."
                  className="w-full bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs text-slate-800 pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200/60 focus:outline-none focus:ring-1 focus:ring-slate-300 font-sans transition-all"
                />
              </div>

              {/* Session Items List */}
              <div className="space-y-1 overflow-y-auto flex-1 pr-1 scrollbar-none">
                {threadsList.map((thread) => {
                  const isActive = thread.id === currentThreadId;
                  return (
                    <div
                      key={thread.id}
                      onClick={() => selectThread(thread.id)}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-center justify-between group cursor-pointer border ${
                        isActive
                          ? 'bg-slate-900 text-white font-medium border-slate-900 shadow-2xs'
                          : 'bg-white/60 hover:bg-slate-100/90 text-slate-700 border-slate-200/50'
                      }`}
                    >
                      <div className="truncate pr-2 flex-1">
                        <div className="truncate font-semibold text-xs flex items-center gap-1">
                          {thread.pinned && <Pin className="w-3 h-3 text-amber-500 shrink-0 fill-amber-500" />}
                          <span className="truncate">{thread.title || '新研究会话'}</span>
                        </div>
                        <div
                          className={`text-[10px] font-mono mt-0.5 ${
                            isActive ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          {thread.last_message_at
                            ? new Date(thread.last_message_at).toLocaleDateString([], { month: '2-digit', day: '2-digit' })
                            : '刚刚'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleTogglePinThread(e, thread.id, thread.pinned)}
                          title={thread.pinned ? '取消置顶' : '置顶会话'}
                          className={`p-1 rounded hover:bg-slate-200/60 transition-colors ${
                            isActive ? 'hover:bg-slate-800 text-slate-200' : 'text-slate-500'
                          }`}
                        >
                          <Pin className={`w-3 h-3 ${thread.pinned ? 'fill-amber-500 text-amber-500' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteThread(e, thread.id)}
                          title="删除会话"
                          className={`p-1 rounded hover:text-rose-500 transition-colors ${
                            isActive ? 'hover:bg-slate-800 text-slate-200' : 'text-slate-500'
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Current Focus Stock Target Pill */}
            <div className="p-3 bg-slate-100/80 rounded-2xl border border-slate-200/60 space-y-2 text-xs mt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">聚焦标的</span>
                <span className="font-mono font-bold bg-white text-slate-900 px-2 py-0.5 rounded text-[10px] border border-slate-200">
                  {selectedStockSymbol}
                </span>
              </div>
              <button
                onClick={() => handleSend(`深度诊股标的 [${selectedStockSymbol}] 的 60日动量与资金流向`)}
                className="w-full py-1.5 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-semibold rounded-xl border border-slate-200/80 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>诊股 {selectedStockSymbol}</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          </aside>
        )}

        {/* Main Canvas Area */}
        {activeTab === 'chat' && (
          <main className="flex-1 flex flex-col justify-between overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
            {/* Header & Prompts Recommendation Cards (Built-in + Daily AI Pool + Smart Random Refresh) */}
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex items-end justify-between border-b border-slate-200/60 pb-3">
                <div className="space-y-1">
                  <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                    <span>探索 AI 驱动的量化研究</span>
                    <span className="text-[11px] font-mono px-2.5 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-200/80 font-bold">
                      每日 AI 智能问题库
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 font-normal">
                    系统每日自动生成 50 个最新量化研究问题，点击卡片填入对话框快速发起发起诊股、选股与策略回测
                  </p>
                </div>

                {/* Refresh Prompt Pool Button */}
                <button
                  onClick={handleRefreshPrompts}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-full border border-slate-200/80 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Dice5 className="w-3.5 h-3.5 text-purple-600 animate-spin-once" />
                  <span>换一批灵感</span>
                </button>
              </div>

              {/* 6 Recommended Cards Grid (Clicking fills composer!) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {displayedPrompts.map((p) => {
                  const Icon = getPromptIcon(p.category);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handlePromptCardClick(p.prompt)}
                      className="p-4 bg-white hover:bg-slate-50/90 border border-slate-200/80 hover:border-slate-300 rounded-2xl shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
                          {p.category}
                        </span>
                        {p.is_stable_template ? (
                          <span className="text-[9px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                            🏛 稳定模板
                          </span>
                        ) : p.freshness_weight === 1.0 ? (
                          <span className="text-[9px] font-mono font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            ⚡ 今日动态
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            ⏱ 近日热点
                          </span>
                        )}
                        <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 transition-colors ml-auto" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-black">
                          {p.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                          {p.summary || p.prompt}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100/80 text-[10px] font-mono text-slate-400">
                        {p.tags.slice(0, 2).map((t, idx) => (
                          <span key={idx} className="bg-slate-50 px-1.5 py-0.5 rounded">
                            #{t}
                          </span>
                        ))}
                        <span className="ml-auto text-purple-600 font-semibold group-hover:underline text-[10px]">
                          填入提问 ↵
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Conversation Flow Area */}
            <div className="space-y-5 flex-1 pt-2">
              {messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] md:max-w-[85%] p-4 md:p-5 rounded-2xl text-xs md:text-sm leading-relaxed transition-all ${
                      msg.sender === 'user'
                        ? 'bg-slate-900 text-white shadow-xs font-medium rounded-br-none'
                        : 'bg-white text-slate-800 border border-slate-200/80 shadow-xs rounded-bl-none'
                    }`}
                  >
                    {/* Header bar for Assistant Message (especially welcome message) */}
                    {msg.sender === 'assistant' && (
                      <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-slate-100 text-xs font-bold text-slate-900">
                        <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-extrabold">
                          A
                        </div>
                        <span>AetherQuant AI 量化研究助手</span>
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            ● 行情可用 ● 因子可用
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 font-normal">{msg.timestamp || '刚刚'}</span>
                        </div>
                      </div>
                    )}

                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {/* Step Execution Logs */}
                    {msg.steps && msg.steps.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 font-mono text-[11px] text-slate-500">
                        {msg.steps.map((st, sIdx) => (
                          <div key={sIdx} className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{st}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quant Result Card */}
                    {msg.resultCard && (
                      <div className="mt-3.5 pt-3.5 border-t border-slate-100 space-y-2">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{msg.resultCard.title}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5">
                          {msg.resultCard.items.map((st: any, sIdx: number) => (
                            <div
                              key={sIdx}
                              onClick={() => navigateToStockDetail(st.symbol)}
                              className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 cursor-pointer transition-all flex items-center justify-between"
                            >
                              <div>
                                <div className="font-bold text-slate-900 text-xs">
                                  {st.name} <span className="font-mono text-slate-400 text-[10px]">({st.symbol})</span>
                                </div>
                                <div className="text-[11px] text-slate-500">{st.reason}</div>
                              </div>
                              <span className="font-mono font-bold text-emerald-600 text-xs">{st.score}分</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 p-3.5 bg-white rounded-2xl w-fit border border-slate-200/70 shadow-xs animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                  <span>Aether AI 正在计算与整合因子特征...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Apple Floating Command Input Capsule (Attached below conversation) */}
            <div className="sticky bottom-4 z-20 space-y-2.5 pt-1">
              {/* Shortcut Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-full border border-slate-200/80 shadow-2xs shrink-0 transition-all flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Paperclip className="w-3 h-3 text-slate-400" />
                  <span>上传研报/数据</span>
                </button>

                {quickChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(chip.query)}
                    className="px-3 py-1 bg-white/90 hover:bg-white text-slate-600 hover:text-slate-900 rounded-full border border-slate-200/80 shadow-2xs shrink-0 transition-all font-medium cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Uploaded Files Pills */}
              {uploadedFiles.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {uploadedFiles.map((f, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 bg-slate-900 text-white rounded-full font-mono text-[10px] flex items-center gap-1"
                    >
                      <Paperclip className="w-3 h-3" />
                      <span>{f}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Input Form Capsule */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 p-3 space-y-2 focus-within:ring-2 focus-within:ring-slate-300 transition-all"
              >
                <textarea
                  ref={composerRef}
                  rows={2}
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="输入股票代码、策略思路或选股需求 (例如：筛选 ROE > 20% 且估值处于近五年低位标的)..."
                  className="w-full px-3 py-1 bg-transparent text-xs md:text-sm text-slate-800 focus:outline-none resize-none placeholder:text-slate-400 font-sans"
                />

                <div className="flex items-center justify-between px-1">
                  {/* Model Toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedModel((prev) => (prev === 'v4-flash' ? 'v4-pro' : 'v4-flash'))
                    }
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-[10px] font-mono font-bold rounded-full transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3 h-3 text-amber-500" />
                    <span>{selectedModel === 'v4-flash' ? 'DeepSeek V4-Flash' : 'DeepSeek V4-Pro'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRecording(!isRecording)}
                      className={`p-2 rounded-full transition-colors ${
                        isRecording ? 'bg-rose-100 text-rose-600 animate-pulse' : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      <Mic className="w-4 h-4" />
                    </button>

                    <button
                      type="submit"
                      disabled={!inputPrompt.trim() || loading}
                      aria-label="发送消息"
                      className="p-2 bg-slate-900 hover:bg-black text-white rounded-full disabled:opacity-20 transition-all shadow-xs flex items-center justify-center cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </main>
        )}

        {/* Document Research Tab */}
        {activeTab === 'docs' && (
          <div className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
            {/* Left Doc Catalog */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                  研报知识库
                </h3>
                <span className="text-[10px] font-mono text-slate-400">{mockDocs.length} 篇</span>
              </div>

              <div className="space-y-2">
                {mockDocs.map((doc) => {
                  const isSelected = doc.id === selectedDocId;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                          : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200/80 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className={`px-2 py-0.5 rounded-full ${isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                          {doc.category}
                        </span>
                        <span className="text-slate-400">{doc.date}</span>
                      </div>
                      <h4 className="text-xs font-bold leading-snug line-clamp-2">{doc.title}</h4>
                      <div className="flex items-center justify-between text-[11px] pt-1 font-mono text-slate-400">
                        <span>{doc.source}</span>
                        <span className={isSelected ? 'text-emerald-400' : 'text-emerald-600'}>
                          {doc.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Doc Detail & Extraction */}
            <div className="lg:col-span-8 space-y-6">
              <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs text-slate-400 font-mono">{selectedDoc.category} · {selectedDoc.source}</span>
                    <h2 className="text-base font-bold text-slate-900 mt-1">{selectedDoc.title}</h2>
                  </div>
                  <button className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-full flex items-center gap-1.5 transition-colors shrink-0">
                    <Download className="w-3.5 h-3.5" />
                    <span>原件</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs font-mono">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                    <span className="text-[10px] text-slate-400 block">营收预告</span>
                    <span className="font-bold text-slate-900">{selectedDoc.keyMetrics.revenue}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                    <span className="text-[10px] text-slate-400 block">净利润增速</span>
                    <span className="font-bold text-emerald-600">{selectedDoc.keyMetrics.netProfit}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                    <span className="text-[10px] text-slate-400 block">估值 / 夏普</span>
                    <span className="font-bold text-slate-900">{selectedDoc.keyMetrics.peRatio}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                    <span className="text-[10px] text-slate-400 block">因子得分</span>
                    <span className="font-bold text-purple-600">{selectedDoc.keyMetrics.factorScore}</span>
                  </div>
                </div>
              </div>

              {/* Summary & Factors */}
              <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    AI 研报摘要
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                    {selectedDoc.summary}
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                    已提炼 Alpha 因子候选
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedDoc.extractedFactors.map((f) => {
                      const isAdded = !!addedFactors[f.code];
                      return (
                        <div key={f.code} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{f.name}</span>
                            <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border text-slate-600">
                              {f.code}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">{f.desc}</p>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs font-mono">
                            <span className="text-emerald-600 font-bold">IC: {f.ic}</span>
                            <button
                              onClick={() => handleAddFactor(f)}
                              disabled={isAdded}
                              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                                isAdded ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-900 text-white'
                              }`}
                            >
                              {isAdded ? <Check className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                              <span>{isAdded ? '已在因子库' : '加入因子库'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload File Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-slate-700" />
                上传附件或行情数据
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <label className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50">
              <Paperclip className="w-8 h-8 text-slate-400" />
              <span className="text-xs font-semibold text-slate-700">点击选择 PDF / CSV / 图片文件</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.csv,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
              />
            </label>

            <div className="flex justify-end">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

const quickChips = [
  { label: '⚡ 策略代码生成', query: '请为我生成一套标准 Python / Backtrader 双均线与 RSI 量化策略代码范例。' },
  { label: '🔍 深度诊断 600519.SH', query: '深度分析 [600519.SH] 当前 K 线形态、主力资金净流入与换手率。' },
  { label: '📊 茅台 vs 宁德 财报评估', query: '对比 贵州茅台 (600519) 与 宁德时代 (300750) 最新季报净利润增速与估值性价比。' },
  { label: '🧪 因子 RankIC 计算', query: '计算全市场动量 (MOM_60) 与波动率 (VOL_20) 因子在最近 24 个月的 RankIC 均值与 IC/IR 稳定度。' },
];

const defaultPromptsFallback: PromptCard[] = [
  { id: 'f1', category: '行情诊股', title: '诊断 [600519.SH] 筹码与动量', summary: '评估 600519.SH 60日动量评分、估值分位数与筹码分布。', prompt: '详细诊断标的 [600519.SH] 的 60 日动量评分、估值分位数、筹码集中度与同业比较优势。', tags: ['600519.SH', '动量'] },
  { id: 'f2', category: '因子选股', title: '沪深300高动量低波动精选', summary: '筛选近60日动量前20%、20日波动率低、换手率改善的优质标的。', prompt: '帮我从沪深300中寻找最近60日动量排名位于前20%，同时20日已实现波动率较低、换手率改善的股票。', tags: ['沪深300', '选股'] },
  { id: 'f3', category: '财报拆解', title: 'NVIDIA (NVDA) 算力财报深度剖析', summary: '拆解 NVDA 最新财报，重点分析 Data Center 算力需求与 Blackwell 毛利率。', prompt: '拆解 NVIDIA 最新季度财报，重点分析 Data Center 算力需求与 Blackwell 架构芯片毛利率变化趋势。', tags: ['NVDA', '算力'] },
  { id: 'f4', category: '策略构建', title: '质量成长多因子策略与回测', summary: '以 ROE + 自由现金流为核心，设计 A 股质量成长多因子调仓模型。', prompt: '请为我设计一个以 ROE + 自由现金流为核心的 A 股质量成长多因子策略，包含因子权重、调仓周期与止损建议。', tags: ['多因子', '策略'] },
  { id: 'f5', category: '宏观轮动', title: '红利低波与科技成长股轮动', summary: '评估当前利率与流动性下，高股息红利与半导体科技的调仓性价比。', prompt: '结合当前宏观利率环境与市场流动性，深度评估高股息红利股与半导体科技股的轮动性价比与调仓时机。', tags: ['宏观', '轮动'] },
  { id: 'f6', category: 'AI 预测', title: 'LightGBM 多因子超额收益预测', summary: '基于 14 个基本面与高频特征，预测下个周期全市场 TOP10 超额股票。', prompt: '使用 LightGBM 模型基于 14 个基本面与高频因子，预测下一个 20 日调仓周期的全市场超额收益 TOP10 股票。', tags: ['LightGBM', 'AI'] },
];
