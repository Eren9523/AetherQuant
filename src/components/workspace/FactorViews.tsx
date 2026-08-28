import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Play, CheckCircle2, FlaskConical, LayoutGrid, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ApiClient } from '../../services/apiClient';

export const FactorViews: React.FC = () => {
  const { workspaceView, setWorkspaceView } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'library' | 'lab'>(
    workspaceView === 'factor-lab' ? 'lab' : 'library'
  );

  useEffect(() => {
    if (workspaceView === 'factor-library') setActiveSubTab('library');
    else if (workspaceView === 'factor-lab') setActiveSubTab('lab');
  }, [workspaceView]);

  const [factors, setFactors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFactor, setSelectedFactor] = useState<any>(null);
  
  // Custom formula state
  const [customFormula, setCustomFormula] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [formulaResult, setFormulaResult] = useState<any>(null);

  const fetchFactors = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.get('/factors');
      if (res && res.data) {
        setFactors(res.data);
        if (res.data.length > 0 && !selectedFactor) {
          setSelectedFactor(res.data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFactors();
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const categories = ['All', 'momentum', 'volatility', 'volume', 'quality', 'value', 'technical'];
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredFactors = factors.filter((f) => {
    const matchSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = selectedCategory === 'All' || f.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const handleEvaluateFormula = async (factorIdToRun?: string, formula?: string) => {
    setIsEvaluating(true);
    setFormulaResult(null);
    try {
      let fId = factorIdToRun;
      
      // If evaluating custom formula from the top bar
      if (!fId) {
        if (!formula) formula = customFormula;
        // Create custom factor ad-hoc
        const createRes = await ApiClient.post('/factors', {
          name: 'Custom Factor',
          category: 'custom',
          formula: formula,
          description: 'Ad-hoc user evaluated factor',
          source_type: 'custom'
        });
        if (createRes && createRes.data) {
          fId = createRes.data.id;
        }
      }
      
      if (!fId) throw new Error("Failed to create or find factor");

      // Kick off run
      const runRes = await ApiClient.post(`/factors/${fId}/run`, {
        universe: 'HS300',
        start_date: '2023-01-01',
        end_date: '2024-01-01',
        forward_period: 1
      });

      if (runRes && runRes.data) {
         setFormulaResult({
           status: 'Calculated successfully',
           summary: runRes.data.summary,
           runId: runRes.data.run_id
         });
         
         // If we are looking at the lab, we should refresh the factor run details
         if (factorIdToRun) {
            await loadFactorLabData(fId, runRes.data.run_id);
         }
         
         fetchFactors(); // Refresh library stats
      }
    } catch (e: any) {
      console.error("Evaluation failed", e);
      setFormulaResult({
        status: 'Failed: ' + (e.response?.data?.error || e.message),
        error: true
      });
    }
    setIsEvaluating(false);
  };

  const [labData, setLabData] = useState<{ ic_series: any[], summary: any } | null>(null);
  const [labLoading, setLabLoading] = useState(false);

  const loadFactorLabData = async (factorId: string, runId: string) => {
    setLabLoading(true);
    try {
      const res = await ApiClient.get(`/factors/${factorId}/runs/${runId}/results`);
      if (res && res.data) {
         setLabData(res.data);
      }
    } catch (e) {
      console.error(e);
      setLabData(null);
    }
    setLabLoading(false);
  };

  const openLab = (f: any) => {
    setSelectedFactor(f);
    setActiveSubTab('lab');
    setWorkspaceView('factor-lab');
    setLabData(null);
    if (f.latest_run?.id && f.latest_run?.status === 'success') {
      loadFactorLabData(f.id, f.latest_run.id);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Factor Generation & Lab</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Write DSL expressions safely, analyze RankIC decays, and compute layered returns dynamically via Python microservices.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
        <button
          onClick={() => setActiveSubTab('library')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeSubTab === 'library' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          <LayoutGrid className="w-4 h-4" /> 因子库 (Factor Library)
        </button>
        <button
          onClick={() => {
            if (!selectedFactor && factors.length > 0) setSelectedFactor(factors[0]);
            setActiveSubTab('lab');
          }}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeSubTab === 'lab' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          <FlaskConical className="w-4 h-4" /> 实验室 (Factor Lab)
        </button>
      </div>

      {activeSubTab === 'library' && (
        <div className="space-y-6">
          {/* Custom Alpha Maker */}
          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-neutral-900">自定义 Alpha 因子表达式</h3>
                <p className="text-xs text-neutral-500">支持安全的 AST 校验，无 Eval/Exec。计算时实时分层回测。</p>
              </div>
              <button
                onClick={() => handleEvaluateFormula()}
                disabled={isEvaluating || !customFormula}
                className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isEvaluating ? '正在计算中...' : '运行公式验证'}</span>
              </button>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={customFormula}
                onChange={(e) => setCustomFormula(e.target.value)}
                className="flex-1 p-3 bg-neutral-50 rounded-xl border border-neutral-200 font-mono text-xs text-neutral-900 focus:outline-none focus:bg-white focus:border-neutral-900"
                placeholder="例如: ZScore(Rank(TsMax(HIGH, 10)) / TsStd(CLOSE, 20))"
              />
            </div>

            {formulaResult && (
              <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-mono animate-in fade-in duration-200 ${formulaResult.error ? 'bg-red-50/60 border-red-200/80 text-red-800' : 'bg-emerald-50/60 border-emerald-200/80 text-emerald-800'}`}>
                <div className="flex items-center gap-2 font-bold">
                  {formulaResult.error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{formulaResult.status}</span>
                </div>
                {!formulaResult.error && formulaResult.summary && (
                  <div className="flex items-center gap-6 text-neutral-700">
                    <span>RankIC: <strong className="text-neutral-900">{formulaResult.summary.rank_ic?.toFixed(4)}</strong></span>
                    <span>IR: <strong className="text-neutral-900">{formulaResult.summary.ir?.toFixed(4)}</strong></span>
                    <span>t-stat: <strong className="text-emerald-700">{formulaResult.summary.t_stat?.toFixed(4)}</strong></span>
                    <span>覆盖率: <strong>{(formulaResult.summary.coverage * 100).toFixed(1)}%</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Filter & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors capitalize ${
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
                placeholder="搜索因子名称..."
                className="pl-9 pr-4 py-2 bg-white rounded-xl border border-neutral-200 text-xs focus:outline-none w-full sm:w-64"
              />
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="text-xs text-neutral-500 py-10 col-span-3 text-center">Loading factors...</div>
            ) : (
              filteredFactors.map((f) => {
                const s = f.latest_run?.summary;
                return (
                  <div
                    key={f.id}
                    onClick={() => openLab(f)}
                    className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm hover:shadow-md cursor-pointer transition-all space-y-4 flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2.5 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg capitalize">
                          {f.category}
                        </span>
                        <span className="text-xs font-mono text-neutral-400">{f.code}</span>
                      </div>
                      <h3 className="text-base font-bold text-neutral-900 mb-1 group-hover:text-indigo-600 transition-colors">
                        {f.name}
                      </h3>
                      <p className="text-[10px] bg-neutral-50 p-1.5 rounded font-mono text-neutral-600 mb-2 truncate">
                        {f.formula}
                      </p>
                      <p className="text-xs text-neutral-500 leading-relaxed truncate">{f.description}</p>
                    </div>

                    <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs font-mono">
                      <span>IC: <strong className="text-neutral-900">{s ? s.ic_mean?.toFixed(4) : '--'}</strong></span>
                      <span>RankIC: <strong className="text-emerald-600">{s ? s.rank_ic?.toFixed(4) : '--'}</strong></span>
                      <span className="text-neutral-400">IR {s ? s.ir?.toFixed(2) : '--'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'lab' && selectedFactor && (
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-neutral-400">{selectedFactor.code}</span>
                <h2 className="text-xl font-bold text-neutral-900">{selectedFactor.name}</h2>
                <div className="text-xs font-mono text-neutral-500 bg-neutral-50 px-2 py-1 rounded inline-block mt-2">
                  {selectedFactor.formula}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEvaluateFormula(selectedFactor.id, selectedFactor.formula)}
                  disabled={isEvaluating}
                  className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-bold hover:bg-neutral-800 disabled:opacity-50"
                >
                  {isEvaluating ? '运行中...' : '重新运行分析'}
                </button>
              </div>
            </div>
            
            {isEvaluating && <div className="text-xs text-neutral-500 text-center py-4">调用 Python Quant Service 处理底层数据与向量运算，请稍候...</div>}
            
            {labLoading && !isEvaluating && <div className="text-xs text-neutral-500 text-center py-4">从 R2 读取缓存结果...</div>}

            {labData && !isEvaluating && !labLoading && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-neutral-100">
                   <div><div className="text-xs text-neutral-500">RankIC</div><div className="text-lg font-bold font-mono">{labData.summary?.rank_ic?.toFixed(4)}</div></div>
                   <div><div className="text-xs text-neutral-500">IC Mean</div><div className="text-lg font-bold font-mono">{labData.summary?.ic_mean?.toFixed(4)}</div></div>
                   <div><div className="text-xs text-neutral-500">IR</div><div className="text-lg font-bold font-mono">{labData.summary?.ir?.toFixed(2)}</div></div>
                   <div><div className="text-xs text-neutral-500">t-Stat</div><div className="text-lg font-bold font-mono text-emerald-600">{labData.summary?.t_stat?.toFixed(2)}</div></div>
                </div>

                {/* IC Time Series Chart */}
                <div className="pt-4 border-t border-neutral-100 space-y-2">
                  <h3 className="text-xs font-bold text-neutral-900">RankIC 时间序列</h3>
                  <div className="h-52 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={labData.ic_series || []}>
                        <XAxis dataKey="date" stroke="#a3a3a3" fontSize={11} tickLine={false} minTickGap={30} />
                        <YAxis stroke="#a3a3a3" fontSize={11} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#171717', borderRadius: '10px', color: '#fff', fontSize: '12px' }} />
                        <Line type="monotone" dataKey="ic" stroke="#10b981" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Decile Group Returns Chart */}
                <div className="pt-4 border-t border-neutral-100 space-y-2">
                  <h3 className="text-xs font-bold text-neutral-900">分层超额收益率 (%)</h3>
                  <div className="h-60 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={labData.summary?.quantile_returns || []}>
                        <XAxis dataKey="quantile" stroke="#a3a3a3" fontSize={11} tickLine={false} />
                        <YAxis stroke="#a3a3a3" fontSize={11} tickLine={false} tickFormatter={(v) => (v * 100).toFixed(1)} />
                        <Tooltip contentStyle={{ backgroundColor: '#171717', borderRadius: '10px', color: '#fff', fontSize: '12px' }} formatter={(val: any) => [(val * 100).toFixed(2) + '%', 'Return']} />
                        <Bar dataKey="return" fill="#171717" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
            
            {!labData && !isEvaluating && !labLoading && (
              <div className="text-center py-10 text-xs text-neutral-400 border-t border-neutral-100">
                该因子尚未进行全市场截面计算，请点击上方「运行分析」。
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
