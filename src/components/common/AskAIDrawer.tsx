import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ResearchService } from '../../services/quantServices';
import { Bot, X, Send, Sparkles, CheckCircle2, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { TrendBadge } from './TrendBadge';

export const AskAIDrawer: React.FC = () => {
  const {
    isAskAIOpen,
    setIsAskAIOpen,
    selectedStockSymbol,
    navigateToStockDetail,
    workspaceView,
    requireAuth,
  } = useApp();

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
      content: `我是 Aether AI 智能研究助理。我可以全天候为您解析市场、扫描因子分布、诊断股票筹码与评估策略回测风险。`,
      steps: ['已加载 A股/美股 全局行情与多因子知识库'],
    },
  ]);

  const [loading, setLoading] = useState(false);

  if (!isAskAIOpen) return null;

  const presetQuestions = [
    `帮我分析当前股票 [${selectedStockSymbol}] 的因子优势与下行风险`,
    `寻找沪深300中最近60日趋势较强、波动率较低的股票`,
    `解释当前策略的 Sharpe 比率 1.34 代表什么意义`,
    `分析多因子策略在 2024 年最大回撤的主要驱动因子`,
  ];

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputPrompt;
    if (!textToSend.trim() || loading) return;

    // Check interaction authentication
    if (!requireAuth(() => handleSend(queryText))) {
      return;
    }

    setInputPrompt('');
    setMessages((prev) => [...prev, { sender: 'user', content: textToSend }]);
    setLoading(true);

    try {
      const res = await ResearchService.queryAI(textToSend, selectedStockSymbol);
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
        {
          sender: 'assistant',
          content: '分析生成失败，请检查网络或重试。',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-neutral-200 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Drawer Header */}
      <div className="p-4 border-b border-neutral-200/80 flex items-center justify-between bg-neutral-50/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5">
              Ask Aether AI
              <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-mono rounded">
                在线
              </span>
            </div>
            <div className="text-xs text-neutral-400">
              当前上下文: {workspaceView} ({selectedStockSymbol})
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsAskAIOpen(false)}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200/50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50/30">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[88%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-white text-neutral-800 border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)]'
              }`}
            >
              {msg.content}

              {/* Execution Steps */}
              {msg.steps && msg.steps.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-neutral-100 space-y-1.5 text-xs text-neutral-500 font-mono">
                  {msg.steps.map((step, sIdx) => (
                    <div key={sIdx} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Result Card: Stock Rank */}
              {msg.resultCard && msg.resultCard.type === 'stockRank' && (
                <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2">
                  <div className="text-xs font-semibold text-neutral-900 mb-1">
                    {msg.resultCard.title}
                  </div>
                  {msg.resultCard.items.map((st: any, sIdx: number) => (
                    <div
                      key={sIdx}
                      onClick={() => {
                        navigateToStockDetail(st.symbol);
                        setIsAskAIOpen(false);
                      }}
                      className="p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100/80 border border-neutral-200/60 cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                          {st.name}
                          <span className="font-mono text-[10px] text-neutral-400">
                            {st.symbol}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          {st.reason}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-emerald-600">
                          {st.score}分
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-neutral-400 bg-white p-3 rounded-2xl border border-neutral-200/80 w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-neutral-600" />
            <span>Aether AI 正在思考并执行多因子矩阵计算...</span>
          </div>
        )}
      </div>

      {/* Preset Suggestions */}
      <div className="p-3 border-t border-neutral-100 bg-white space-y-1.5">
        <div className="text-[11px] font-medium text-neutral-400 tracking-wide px-1">
          建议探索提问：
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presetQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="text-left text-xs bg-neutral-100 hover:bg-neutral-200/70 text-neutral-700 px-2.5 py-1 rounded-lg transition-colors border border-neutral-200/50 line-clamp-1 max-w-full"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-neutral-200/80 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="输入策略指令、因子名词或市场疑问..."
            className="flex-1 bg-neutral-100/80 hover:bg-neutral-100 text-xs text-neutral-900 placeholder:text-neutral-400 px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-400 font-medium"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || loading}
            className="p-2.5 rounded-xl bg-neutral-900 text-white disabled:opacity-40 hover:bg-black transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
