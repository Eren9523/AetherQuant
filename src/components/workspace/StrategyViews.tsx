import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { LayoutGrid, Sliders, Play, Save, CheckCircle2, AlertCircle, Zap, ShieldCheck, Edit3 } from 'lucide-react';
import { ApiClient } from '../../services/apiClient';

export const StrategyViews: React.FC = () => {
  const { workspaceView, setWorkspaceView } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'library' | 'builder'>(
    workspaceView === 'strategy-builder' ? 'builder' : 'library'
  );

  useEffect(() => {
    if (workspaceView === 'strategy-library') setActiveSubTab('library');
    else if (workspaceView === 'strategy-builder') setActiveSubTab('builder');
  }, [workspaceView]);

  // Strategy Library State
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Strategy Builder State
  const [currentStrategyId, setCurrentStrategyId] = useState<string | null>(null);
  const [name, setName] = useState('My Custom Alpha Strategy');
  const [description, setDescription] = useState('');
  const [universe, setUniverse] = useState('ALL_A');
  const [holdingCount, setHoldingCount] = useState(20);
  const [rebalanceFreq, setRebalanceFreq] = useState('weekly');
  
  // Available Factors
  const [factors, setFactors] = useState<any[]>([]);
  // Current signals configuration [{factorCode: string, weight: number}]
  const [signals, setSignals] = useState<{factor: string, weight: number}[]>([
    { factor: 'MOM_60D', weight: 40 },
    { factor: 'LOW_VOL_20D', weight: 30 },
    { factor: 'MOM_20D', weight: 30 }
  ]);

  const [validationResult, setValidationResult] = useState<{valid: boolean, errors?: string[]} | null>(null);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    fetchStrategies();
    fetchFactors();
  }, []);

  const fetchStrategies = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.get('/strategies');
      if (res && res.data) {
        setStrategies(res.data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchFactors = async () => {
    try {
      const res = await ApiClient.get('/factors');
      if (res && res.data) {
        setFactors(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = (strat: any) => {
    setCurrentStrategyId(strat.id);
    setName(strat.name);
    setDescription(strat.description || '');
    setUniverse(strat.dsl_json.universe.value);
    setHoldingCount(strat.dsl_json.selection.n);
    setRebalanceFreq(strat.dsl_json.rebalance.frequency);
    setSignals(strat.dsl_json.signals.map((s: any) => ({
      factor: s.factor,
      weight: s.weight * 100
    })));
    setActiveSubTab('builder');
  };

  const currentDsl = {
    universe: { type: 'index', value: universe },
    signals: signals.map(s => ({ factor: s.factor, weight: s.weight / 100 })),
    selection: { method: 'top_n', n: holdingCount },
    rebalance: { frequency: rebalanceFreq },
    portfolio: { weighting: 'equal' }
  };

  const weightSum = signals.reduce((acc, curr) => acc + curr.weight, 0);

  const handleValidate = async () => {
    setValidationResult(null);
    try {
      const res = await ApiClient.post('/strategies/validate', currentDsl);
      if (res && res.valid) {
        setValidationResult({ valid: true });
      }
    } catch (e: any) {
      setValidationResult({ 
        valid: false, 
        errors: e.response?.data?.errors || [e.message] 
      });
    }
  };

  const handleSave = async () => {
    setSaveStatus('Saving...');
    try {
      if (currentStrategyId) {
        // Update existing (creates new version in DB)
        const res = await ApiClient.put(`/strategies/${currentStrategyId}`, {
          name,
          description,
          dsl: currentDsl
        });
        if (res && res.success) {
          setSaveStatus(`Saved new version ${res.data.version}!`);
        }
      } else {
        // Create new
        const res = await ApiClient.post('/strategies', {
          name,
          description,
          market: 'CN',
          dsl: currentDsl
        });
        if (res && res.success) {
          setSaveStatus('Created successfully!');
          setCurrentStrategyId(res.data.id);
        }
      }
      fetchStrategies();
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (e: any) {
      console.error(e);
      setSaveStatus('Save failed: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleRunBacktest = (strategyId: string, version: number) => {
    // Pass strategy to backtest center
    // For P3, we just transition view
    setWorkspaceView('backtest-center');
  };

  const handleResetBuilder = () => {
    setCurrentStrategyId(null);
    setName('New Strategy');
    setDescription('');
    setSignals([
      { factor: 'MOM_60D', weight: 40 },
      { factor: 'LOW_VOL_20D', weight: 30 },
      { factor: 'MOM_20D', weight: 30 }
    ]);
    setValidationResult(null);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Strategy Architect</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Design, validate, and compile multi-factor strategies into strict execution DSLs.
        </p>
      </div>

      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('library')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              activeSubTab === 'library' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> 策略库 (Library)
          </button>
          <button
            onClick={() => setActiveSubTab('builder')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              activeSubTab === 'builder' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <Sliders className="w-4 h-4" /> 策略构建器 (Builder)
          </button>
        </div>
        {activeSubTab === 'builder' && (
          <button onClick={handleResetBuilder} className="text-xs text-neutral-500 hover:text-neutral-800">
            + 创建全新策略
          </button>
        )}
      </div>

      {activeSubTab === 'library' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="text-xs text-neutral-500 py-10 col-span-3 text-center">Loading strategies...</div>
            ) : strategies.length === 0 ? (
              <div className="text-xs text-neutral-500 py-10 col-span-3 text-center">No strategies found. Go to Builder to create one.</div>
            ) : (
              strategies.map((s) => (
                <div key={s.id} className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm flex flex-col justify-between group">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg uppercase">
                        V{s.version}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400">{s.id.substring(0, 15)}...</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <h3 className="text-base font-bold text-neutral-900 mb-1">{s.name}</h3>
                      <button onClick={() => handleEdit(s)} className="text-neutral-400 hover:text-neutral-800" title="编辑策略">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500 leading-relaxed mb-4">{s.description || 'No description provided'}</p>
                    
                    <div className="space-y-1 mb-4">
                       {s.dsl_json.signals.map((sig: any, idx: number) => (
                         <div key={idx} className="flex justify-between text-[10px] font-mono text-neutral-600 bg-neutral-50 px-2 py-1 rounded">
                           <span>{sig.factor}</span>
                           <span className="font-bold text-neutral-900">{(sig.weight * 100).toFixed(0)}%</span>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
                     <div className="flex gap-4 text-xs font-mono">
                        <div className="flex flex-col">
                           <span className="text-neutral-400">Sharpe</span>
                           <strong className="text-neutral-900">--</strong>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-neutral-400">Ann Ret</span>
                           <strong className="text-neutral-900">--</strong>
                        </div>
                     </div>
                     <button
                      onClick={() => handleRunBacktest(s.id, s.version)}
                      className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors"
                     >
                      回测
                     </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 p-8 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-6">
            <div className="border-b border-neutral-100 pb-4 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-neutral-600" />
                  自定义多因子权重与调仓规则
                </h3>
                <p className="text-xs text-neutral-400">
                  {currentStrategyId ? `正在编辑: ${currentStrategyId.substring(0,8)}...` : '配置策略 DSL，验证权重并保存版本'}
                </p>
              </div>
              <div className="flex gap-2">
                 <button onClick={handleValidate} className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-xs font-bold hover:bg-neutral-200">
                    验证 DSL
                 </button>
                 <button onClick={handleSave} disabled={weightSum !== 100} className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-bold hover:bg-black disabled:opacity-50 flex gap-2 items-center">
                    <Save className="w-3.5 h-3.5" /> {currentStrategyId ? '保存新版本' : '保存策略'}
                 </button>
              </div>
            </div>

            {saveStatus && <div className="text-xs font-bold text-emerald-600">{saveStatus}</div>}

            <div className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">策略名称</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 font-medium focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">选股股票池 (Universe)</label>
                  <select
                    value={universe}
                    onChange={(e) => setUniverse(e.target.value)}
                    className="w-full p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 font-medium focus:outline-none"
                  >
                    <option value="ALL_A">全 A 股 (ALL_A)</option>
                    <option value="000300">沪深300 (000300.SH) - DATA_NOT_READY</option>
                    <option value="000905">中证500 (000905.SH) - DATA_NOT_READY</option>
                  </select>
                </div>
              </div>

              {/* Signals Configurator */}
              <div className="p-4 bg-neutral-50 rounded-xl space-y-4 border border-neutral-200/60">
                <div className="flex justify-between items-center">
                   <span className="font-bold text-neutral-800">因子配置 (Signals)</span>
                   <span className={`font-mono font-bold ${weightSum === 100 ? 'text-emerald-600' : 'text-red-500'}`}>总权重: {weightSum}%</span>
                </div>
                
                {signals.map((sig, idx) => (
                  <div key={idx} className="flex gap-4 items-center">
                    <div className="flex-1">
                      <select 
                        value={sig.factor} 
                        onChange={(e) => {
                          const newSigs = [...signals];
                          newSigs[idx].factor = e.target.value;
                          setSignals(newSigs);
                        }}
                        className="w-full p-2 bg-white rounded-lg border border-neutral-200 font-mono text-xs focus:outline-none"
                      >
                         {factors.length === 0 ? <option value={sig.factor}>{sig.factor}</option> : factors.map(f => (
                           <option key={f.code} value={f.code}>{f.code} ({f.name})</option>
                         ))}
                      </select>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={sig.weight}
                        onChange={(e) => {
                           const newSigs = [...signals];
                           newSigs[idx].weight = Number(e.target.value);
                           setSignals(newSigs);
                        }}
                        className="w-full accent-neutral-900"
                      />
                      <span className="font-mono text-neutral-900 w-10 text-right">{sig.weight}%</span>
                    </div>
                    <button 
                      onClick={() => {
                        const newSigs = [...signals];
                        newSigs.splice(idx, 1);
                        setSignals(newSigs);
                      }}
                      className="text-red-500 font-bold px-2 hover:bg-red-50 rounded"
                    >
                      X
                    </button>
                  </div>
                ))}

                <button 
                  onClick={() => setSignals([...signals, {factor: factors[0]?.code || 'MOM_20D', weight: 0}])}
                  className="w-full py-2 border-2 border-dashed border-neutral-200 rounded-lg text-neutral-500 font-bold hover:border-neutral-300 hover:bg-neutral-100 transition-all"
                >
                  + 添加因子
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">持仓数量 (Top N)</label>
                  <input
                    type="number"
                    value={holdingCount}
                    onChange={(e) => setHoldingCount(Number(e.target.value))}
                    className="w-full p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 font-mono text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">调仓频率 (Rebalance)</label>
                  <select
                    value={rebalanceFreq}
                    onChange={(e) => setRebalanceFreq(e.target.value)}
                    className="w-full p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 font-medium text-xs focus:outline-none"
                  >
                    <option value="daily">每日 (Daily)</option>
                    <option value="weekly">每周 (Weekly)</option>
                    <option value="monthly">每月 (Monthly)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Structure Preview */}
          <div className="lg:col-span-5 p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm flex flex-col space-y-6">
            <div>
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  策略结构预览 (DSL Structure)
                </h3>
              </div>
              
              <div className="mt-4 p-4 bg-neutral-900 text-emerald-400 font-mono text-[10px] sm:text-xs rounded-xl overflow-x-auto">
                 <pre>{JSON.stringify(currentDsl, null, 2)}</pre>
              </div>
            </div>

            {validationResult && (
              <div className={`p-4 rounded-xl border ${validationResult.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'} text-xs font-mono space-y-2`}>
                <div className="flex items-center gap-2 font-bold">
                  {validationResult.valid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{validationResult.valid ? 'DSL 验证通过，准许回测' : 'DSL 验证失败'}</span>
                </div>
                {validationResult.errors && (
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    {validationResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}

            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-2 text-xs font-mono mt-auto">
              <div className="font-bold text-neutral-900 font-sans flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                回测引擎就绪状态
              </div>
              <div className="text-neutral-500">
                策略定义已通过 D1 持久化，等待提交至 Python Quant Worker 进行全量历史截面扫描与归因。
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
