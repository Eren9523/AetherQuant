import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { mockFactors, mockFactorGroupReturns } from '../../mocks/mockFactors';
import { Cpu, BarChart2, Search, Code2, Sparkles, Filter, CheckCircle2, Play } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export const FactorViews: React.FC = () => {
  const { workspaceView, setWorkspaceView } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'library' | 'lab'>(
    workspaceView === 'factor-lab' ? 'lab' : 'library'
  );

  useEffect(() => {
    if (workspaceView === 'factor-lab') setActiveSubTab('lab');
    else if (workspaceView === 'factor-library') setActiveSubTab('library');
  }, [workspaceView]);

  const [selectedFactor, setSelectedFactor] = useState(mockFactors[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部');

  // Custom Alpha Formula State
  const [customFormula, setCustomFormula] = useState('ZScore(Rank(Ts_ArgMax(HIGH, 10)) / StdDev(CLOSE, 20))');
  const [formulaResult, setFormulaResult] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const categories = ['全部', '动量', '波动率', '估值', '质量', 'AI 深度因子'];

  const filteredFactors = mockFactors.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.description.includes(searchTerm);
    const matchesCat = selectedCategory === '全部' || f.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Mock IC Time Series
  const icTimeSeries = [
    { date: '2026-02', ic: 0.082, rankIc: 0.091 },
    { date: '2026-03', ic: 0.071, rankIc: 0.085 },
    { date: '2026-04', ic: 0.095, rankIc: 0.104 },
    { date: '2026-05', ic: 0.063, rankIc: 0.078 },
    { date: '2026-06', ic: 0.088, rankIc: 0.098 },
    { date: '2026-07', ic: 0.079, rankIc: 0.089 },
    { date: '2026-08', ic: 0.091, rankIc: 0.102 },
  ];

  const handleEvaluateFormula = () => {
    setIsEvaluating(true);
    setTimeout(() => {
      setFormulaResult({
        code: 'ALPHA_CUSTOM_01',
        coverage: 99.4,
        meanIC: 0.084,
        rankIC: 0.096,
        ir: 1.82,
        tStat: 4.12,
        status: '有效因子 (Pass t-test)',
      });
      setIsEvaluating(false);
    }, 800);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      {/* Subtabs Menu */}
      <div className="flex items-center gap-2 border-b border-neutral-200/80 pb-3">
        <button
          onClick={() => {
            setActiveSubTab('library');
            setWorkspaceView('factor-library');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'library' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          因子算法库 (Factor Library)
        </button>
        <button
          onClick={() => {
            setActiveSubTab('lab');
            setWorkspaceView('factor-lab');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'lab' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          因子实验室 (IC / RankIC & 分层收益)
        </button>
      </div>

      {activeSubTab === 'library' && (
        <div className="space-y-6">
          {/* Custom Formula Sandbox Header */}
          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-purple-600" />
                  自定义 Alpha 因子公式实时沙盒 (Interactive Expression Engine)
                </h3>
                <p className="text-xs text-neutral-400">支持输入标准 Alpha101 / WorldQuant 算子编写计算表达式</p>
              </div>

              <button
                onClick={handleEvaluateFormula}
                disabled={isEvaluating}
                className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isEvaluating ? '正在截面扫描与提取...' : '实时计算 RankIC 与 IR'}</span>
              </button>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={customFormula}
                onChange={(e) => setCustomFormula(e.target.value)}
                className="flex-1 p-3 bg-neutral-50 rounded-xl border border-neutral-200 font-mono text-xs text-neutral-900 focus:outline-none focus:bg-white focus:border-neutral-900"
                placeholder="例如: ZScore(Rank(Ts_ArgMax(HIGH, 10)) / StdDev(CLOSE, 20))"
              />
            </div>

            {formulaResult && (
              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/80 flex items-center justify-between text-xs font-mono animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{formulaResult.status}</span>
                </div>
                <div className="flex items-center gap-6 text-neutral-700">
                  <span>RankIC: <strong className="text-neutral-900">{formulaResult.rankIC}</strong></span>
                  <span>IR: <strong className="text-neutral-900">{formulaResult.ir}</strong></span>
                  <span>t-stat: <strong className="text-emerald-700">{formulaResult.tStat}</strong></span>
                  <span>全A股覆盖率: <strong>{formulaResult.coverage}%</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-neutral-900 text-white'
                      : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索因子名称/代码..."
                className="pl-9 pr-4 py-2 bg-white rounded-xl border border-neutral-200 text-xs focus:outline-none w-full sm:w-64"
              />
            </div>
          </div>

          {/* Factor Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFactors.map((f) => (
              <div
                key={f.id}
                onClick={() => {
                  setSelectedFactor(f);
                  setActiveSubTab('lab');
                  setWorkspaceView('factor-lab');
                }}
                className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm hover:shadow-md cursor-pointer transition-all space-y-4 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg">
                      {f.category}
                    </span>
                    <span className="text-xs font-mono text-neutral-400">{f.code}</span>
                  </div>
                  <h3 className="text-base font-bold text-neutral-900 mb-1 group-hover:text-indigo-600 transition-colors">
                    {f.name}
                  </h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">{f.description}</p>
                </div>

                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs font-mono">
                  <span>IC: <strong className="text-neutral-900">{f.ic}</strong></span>
                  <span>RankIC: <strong className="text-emerald-600">{f.rankIc}</strong></span>
                  <span className="text-neutral-400">覆盖 {f.coverage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'lab' && (
        <div className="space-y-6">
          {/* Active Selected Factor Summary */}
          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-neutral-400">{selectedFactor.code}</span>
                <h2 className="text-xl font-bold text-neutral-900">{selectedFactor.name} - 因子实验室分析</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 font-mono font-bold text-xs rounded-lg border border-emerald-200">
                  RankIC 均值: {selectedFactor.rankIc}
                </span>
                <span className="px-3 py-1 bg-neutral-100 text-neutral-800 font-mono font-bold text-xs rounded-lg border border-neutral-200">
                  IR 风险调整比: 1.85
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-600">{selectedFactor.description}</p>

            {/* IC Time Series Chart */}
            <div className="pt-4 border-t border-neutral-100 space-y-2">
              <h3 className="text-xs font-bold text-neutral-900">月度 RankIC 时间序列稳定性 (Monthly RankIC Decay)</h3>
              <div className="h-52 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={icTimeSeries}>
                    <XAxis dataKey="date" stroke="#a3a3a3" fontSize={11} tickLine={false} />
                    <YAxis stroke="#a3a3a3" fontSize={11} tickLine={false} domain={[0, 0.15]} />
                    <Tooltip contentStyle={{ backgroundColor: '#171717', borderRadius: '10px', color: '#fff', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="rankIc" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="ic" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Decile Group Returns Chart */}
            <div className="pt-4 border-t border-neutral-100 space-y-2">
              <h3 className="text-xs font-bold text-neutral-900">因子 5 分层多空组合超额收益率 (%)</h3>
              <div className="h-60 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockFactorGroupReturns}>
                    <XAxis dataKey="group" stroke="#a3a3a3" fontSize={11} tickLine={false} />
                    <YAxis stroke="#a3a3a3" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#171717', borderRadius: '10px', color: '#fff', fontSize: '12px' }} />
                    <Bar dataKey="returnRate" fill="#171717" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
