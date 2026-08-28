import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Play, TrendingUp, GitCompare, ArrowRight } from 'lucide-react';
import { ApiClient } from '../../services/apiClient';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export const BacktestViews: React.FC = () => {
  const { workspaceView } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'single' | 'compare'>('single');
  const [strategies, setStrategies] = useState<any[]>([]);
  const [backtests, setBacktests] = useState<any[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  
  const [result, setResult] = useState<any>(null);
  const [navData, setNavData] = useState<any[]>([]);
  const [tradeData, setTradeData] = useState<any[]>([]);

  useEffect(() => {
    fetchStrategies();
    fetchBacktests();
  }, [workspaceView]);

  const fetchStrategies = async () => {
    try {
      const res = await ApiClient.get<any[]>('/strategies');
      if (res) {
        setStrategies(res);
        if (res.length > 0 && !selectedStrategy) {
          setSelectedStrategy(res[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBacktests = async () => {
    try {
      const res = await ApiClient.get<any[]>('/backtests');
      if (res) {
        setBacktests(res);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRun = async () => {
    if (!selectedStrategy) return;
    const strat = strategies.find(s => s.id === selectedStrategy);
    if (!strat) return;

    setIsRunning(true);
    setResult(null);
    setNavData([]);
    setTradeData([]);
    
    try {
      const res = await ApiClient.post<any>('/backtests/run', {
        strategy_id: strat.id,
        strategy_version: strat.version,
        start_date: '2023-01-01',
        end_date: '2024-01-01',
        initial_capital: 1000000,
        commission_rate: 0.0003,
        slippage_bps: 1.0
      });
      
      if (res && res.run_id) {
        setCurrentRunId(res.run_id);
        pollStatus(res.run_id);
      }
    } catch (e) {
      console.error(e);
      setIsRunning(false);
    }
  };

  const pollStatus = async (runId: string) => {
    try {
      const res = await ApiClient.get<any>(`/backtests/${runId}`);
      if (res) {
        if (res.status === 'completed') {
          setIsRunning(false);
          setResult(res);
          loadR2Data(res.result_r2_key);
          fetchBacktests(); // refresh list
        } else if (res.status === 'failed') {
          setIsRunning(false);
          alert('Backtest failed: ' + res.error_message);
        } else {
          setTimeout(() => pollStatus(runId), 2000);
        }
      }
    } catch (e) {
      console.error(e);
      setTimeout(() => pollStatus(runId), 2000);
    }
  };

  const loadR2Data = async (r2Key: string) => {
    try {
      // Assuming frontend can fetch from worker datasets endpoint
      const navRes = await ApiClient.get<any[]>(`/datasets/internal/r2/${r2Key}/nav.json`);
      if (navRes) setNavData(navRes as React.SetStateAction<any[]>);
      
      const tradeRes = await ApiClient.get<any[]>(`/datasets/internal/r2/${r2Key}/trades.json`);
      if (tradeRes) setTradeData(tradeRes as React.SetStateAction<any[]>);
    } catch (e) {
      console.error("Failed to load R2 data", e);
    }
  };

  const handleViewHistorical = (bt: any) => {
    setResult(bt);
    if (bt.result_r2_key) {
      loadR2Data(bt.result_r2_key);
    }
    setActiveSubTab('single');
  };

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Backtest Center</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Historical backtesting and performance attribution powered by Python Engine.
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
        <button
          onClick={() => setActiveSubTab('single')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeSubTab === 'single' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> 回测运行与分析
        </button>
        <button
          onClick={() => setActiveSubTab('compare')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeSubTab === 'compare' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          <GitCompare className="w-4 h-4" /> 多策略对比矩阵
        </button>
      </div>

      {activeSubTab === 'single' && (
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full space-y-3">
              <label className="text-xs font-bold text-neutral-800">选择策略定义 (Strategy Definition)</label>
              <select 
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 font-medium text-xs focus:outline-none"
              >
                {strategies.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (v{s.version})</option>
                ))}
              </select>
            </div>
            
            <button
              onClick={handleRun}
              disabled={isRunning || strategies.length === 0}
              className="w-full md:w-auto px-8 py-3 bg-neutral-900 text-white font-bold text-xs rounded-xl hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-4 md:mt-0"
            >
              {isRunning ? (
                <>正在运行回测...</>
              ) : (
                <><Play className="w-4 h-4 text-emerald-400" /> 开始全量回测仿真</>
              )}
            </button>
          </div>

          {result && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-xl border border-neutral-200/80 shadow-sm">
                  <div className="text-xs text-neutral-400">累计收益 (Total)</div>
                  <div className="text-2xl font-bold font-mono text-emerald-600">+{(result.total_return * 100).toFixed(2)}%</div>
                  <div className="text-[10px] text-neutral-400">年化收益 {(result.annualized_return * 100).toFixed(2)}%</div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-neutral-200/80 shadow-sm">
                  <div className="text-xs text-neutral-400">夏普比率 (Sharpe)</div>
                  <div className="text-2xl font-bold font-mono text-neutral-900">{(result.sharpe_ratio).toFixed(2)}</div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-neutral-200/80 shadow-sm">
                  <div className="text-xs text-neutral-400">最大回撤 (Drawdown)</div>
                  <div className="text-2xl font-bold font-mono text-rose-600">{(result.max_drawdown * 100).toFixed(2)}%</div>
                  <div className="text-[10px] text-neutral-400">Calmar 比率 {(result.calmar_ratio).toFixed(2)}</div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-neutral-200/80 shadow-sm">
                  <div className="text-xs text-neutral-400">胜率 / 换手</div>
                  <div className="text-2xl font-bold font-mono text-neutral-900">{(result.win_rate * 100).toFixed(1)}%</div>
                  <div className="text-[10px] text-neutral-400">年换手率 {(result.turnover_rate).toFixed(2)}</div>
                </div>
              </div>

              <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-800">
                  <span>策略收益曲线 vs Benchmark</span>
                  <span className="font-mono text-neutral-400">{result.start_date} - {result.end_date}</span>
                </div>
                <div className="h-64 w-full">
                  {navData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={navData}>
                      <defs>
                        <linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#171717" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#171717" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#a3a3a3" fontSize={10} tickLine={false} />
                      <YAxis stroke="#a3a3a3" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#171717', borderRadius: '10px', color: '#fff', fontSize: '11px' }} />
                      <Area type="monotone" dataKey="nav" stroke="#171717" strokeWidth={2} fill="url(#navGrad)" />
                      <Area type="monotone" dataKey="benchmark" stroke="#d4d4d4" strokeWidth={1.5} fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                  ) : <div className="flex items-center justify-center h-full text-xs text-neutral-400">Loading chart data...</div>}
                </div>
              </div>

              <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-neutral-900">历史逐笔模拟撮合记录 (Trades Execution)</h3>
                <div className="overflow-x-auto h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="text-neutral-400 border-b border-neutral-100 uppercase">
                        <th className="py-2 px-3 sticky top-0 bg-white">日期</th>
                        <th className="py-2 px-3 sticky top-0 bg-white">标的代码</th>
                        <th className="py-2 px-3 sticky top-0 bg-white">方向</th>
                        <th className="py-2 px-3 sticky top-0 bg-white">成交价格</th>
                        <th className="py-2 px-3 sticky top-0 bg-white">成交数量</th>
                        <th className="py-2 px-3 sticky top-0 bg-white">手续费</th>
                        <th className="py-2 px-3 sticky top-0 bg-white">滑点成本</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {tradeData.map((tr, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50">
                          <td className="py-2.5 px-3 text-neutral-500">{tr.date}</td>
                          <td className="py-2.5 px-3 font-bold text-neutral-900">{tr.symbol}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tr.action === 'BUY' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {tr.action === 'BUY' ? '买入' : '卖出'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold">¥{tr.price.toFixed(2)}</td>
                          <td className="py-2.5 px-3">{tr.amount}</td>
                          <td className="py-2.5 px-3">¥{tr.commission.toFixed(2)}</td>
                          <td className="py-2.5 px-3">¥{tr.slippage_cost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeSubTab === 'compare' && (
        <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-neutral-600" />
            真实历史回测对比矩阵
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="text-neutral-400 border-b border-neutral-100 uppercase font-mono">
                  <th className="py-3 px-3">策略 ID (Version)</th>
                  <th className="py-3 px-3">运行时间</th>
                  <th className="py-3 px-3">状态</th>
                  <th className="py-3 px-3">累计收益</th>
                  <th className="py-3 px-3">夏普比率</th>
                  <th className="py-3 px-3">最大回撤</th>
                  <th className="py-3 px-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-mono">
                {backtests.map((bt) => (
                  <tr key={bt.id} className="hover:bg-neutral-50">
                    <td className="py-3 px-3 font-bold text-neutral-900 font-sans">{bt.strategy_id.substring(0,8)} (v{bt.strategy_version})</td>
                    <td className="py-3 px-3 text-neutral-500 font-sans">{new Date(bt.created_at).toLocaleString()}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${bt.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : bt.status === 'failed' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                        {bt.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-600">{bt.status === 'completed' ? `+${(bt.total_return * 100).toFixed(2)}%` : '--'}</td>
                    <td className="py-3 px-3 font-bold text-neutral-900">{bt.status === 'completed' ? bt.sharpe_ratio.toFixed(2) : '--'}</td>
                    <td className="py-3 px-3 font-bold text-rose-600">{bt.status === 'completed' ? `${(bt.max_drawdown * 100).toFixed(2)}%` : '--'}</td>
                    <td className="py-3 px-3">
                      {bt.status === 'completed' && (
                        <button 
                          onClick={() => handleViewHistorical(bt)}
                          className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-semibold rounded-lg transition-colors"
                        >
                          查看详情 <ArrowRight className="w-3 h-3 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {backtests.length === 0 && <div className="text-center py-6 text-xs text-neutral-400">暂无回测记录</div>}
          </div>
        </div>
      )}
    </div>
  );
};
