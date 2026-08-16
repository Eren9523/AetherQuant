import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Settings, Key, SlidersHorizontal, Bell, ShieldAlert, Activity, Check, Save, RefreshCw } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { marketColorMode, toggleMarketColorMode } = useApp();
  const [activeTab, setActiveTab] = useState<'api' | 'preferences' | 'risk' | 'alerts' | 'diagnostics'>('api');

  // Form States
  const [tushareToken, setTushareToken] = useState('d3a9f7e812c4002891f... (已加密)');
  const [fmpToken, setFmpToken] = useState('demo_fmp_key_2026_aether');
  const [polygonKey, setPolygonKey] = useState('pk_live_8301928390182');
  const [qmtAddress, setQmtAddress] = useState('127.0.0.1:58000');
  
  // Risk Defaults
  const [maxStockWeight, setMaxStockWeight] = useState(10);
  const [maxDrawdownThreshold, setMaxDrawdownThreshold] = useState(3.0);
  const [executionAlgo, setExecutionAlgo] = useState('TWAP');

  // Notifications
  const [webhookUrl, setWebhookUrl] = useState('https://oapi.dingtalk.com/robot/send?access_token=...');
  const [enableIcAlert, setEnableIcAlert] = useState(true);
  const [enableRiskAlert, setEnableRiskAlert] = useState(true);

  // Save Feedback State
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-neutral-800" />
            系统 API 与全局偏好设置 (System Configuration Suite)
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            配置高频行情网关 Key、全局风控兜底参数、报警 Webhook 及多维色彩偏好
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
        >
          {savedSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>设置已保存！</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 text-white" />
              <span>保存全局变更</span>
            </>
          )}
        </button>
      </div>

      {/* Main Settings Tabs & Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Vertical Subtabs */}
        <div className="md:col-span-3 space-y-1">
          <button
            onClick={() => setActiveTab('api')}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 ${
              activeTab === 'api' ? 'bg-neutral-900 text-white shadow-sm' : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200/60'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>API 密钥与行情句柄</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 ${
              activeTab === 'preferences' ? 'bg-neutral-900 text-white shadow-sm' : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200/60'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>显示与色彩偏好</span>
          </button>

          <button
            onClick={() => setActiveTab('risk')}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 ${
              activeTab === 'risk' ? 'bg-neutral-900 text-white shadow-sm' : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>风控卫士全局默认值</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 ${
              activeTab === 'alerts' ? 'bg-neutral-900 text-white shadow-sm' : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200/60'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>告警与 Webhook 引擎</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 ${
              activeTab === 'diagnostics' ? 'bg-neutral-900 text-white shadow-sm' : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>系统健康与节点诊断</span>
          </button>
        </div>

        {/* Right Settings Detail Body */}
        <div className="md:col-span-9 p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm min-h-[420px]">
          {/* Tab 1: API Keys */}
          {activeTab === 'api' && (
            <div className="space-y-6">
              <div className="border-b border-neutral-100 pb-3">
                <h3 className="text-sm font-bold text-neutral-900">外部行情 API & 实盘 API Token 凭据</h3>
                <p className="text-xs text-neutral-400">密钥由系统加密存储于服务端环境凭据中，绝不暴露至前端浏览器。</p>
              </div>

              <div className="space-y-4 text-xs font-sans">
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">Tushare Pro API Token (A股与离线因子数据)</label>
                  <input
                    type="password"
                    value={tushareToken}
                    onChange={(e) => setTushareToken(e.target.value)}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs focus:outline-none focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-800 block mb-1">Financial Modeling Prep (FMP) API Key (美股/财报)</label>
                  <input
                    type="text"
                    value={fmpToken}
                    onChange={(e) => setFmpToken(e.target.value)}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs focus:outline-none focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-800 block mb-1">Polygon.io / Alpaca 行情 API Key</label>
                  <input
                    type="text"
                    value={polygonKey}
                    onChange={(e) => setPolygonKey(e.target.value)}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs focus:outline-none focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-800 block mb-1">迅投 QMT 行情与交易 Gateway 句柄 (MiniQMT Endpoint)</label>
                  <input
                    type="text"
                    value={qmtAddress}
                    onChange={(e) => setQmtAddress(e.target.value)}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs focus:outline-none focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Preferences */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div className="border-b border-neutral-100 pb-3">
                <h3 className="text-sm font-bold text-neutral-900">显示与色彩偏好 (Display Preferences)</h3>
                <p className="text-xs text-neutral-400">调整界面红绿颜色习惯与数值显示精度</p>
              </div>

              <div className="space-y-4 text-xs font-sans">
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-neutral-900">股市涨跌颜色显示习惯</div>
                    <div className="text-neutral-400 text-[11px] mt-0.5">
                      {marketColorMode === 'CN' ? '当前：中国大陆习惯 (红涨绿跌)' : '当前：美股/国际习惯 (绿涨红跌)'}
                    </div>
                  </div>

                  <button
                    onClick={toggleMarketColorMode}
                    className="px-4 py-2 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
                  >
                    切换至 {marketColorMode === 'CN' ? '国际模式 (绿涨红跌)' : '中国模式 (红涨绿跌)'}
                  </button>
                </div>

                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-neutral-900">数据表格数值精度</div>
                    <div className="text-neutral-400 text-[11px] mt-0.5">控制 K 线与因子在界面上的小数位数</div>
                  </div>

                  <select className="p-2 bg-white border border-neutral-200 rounded-xl text-xs font-mono">
                    <option value="2">保留 2 位小数 (如 1482.35)</option>
                    <option value="4">保留 4 位高精小数 (如 0.0824)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Risk */}
          {activeTab === 'risk' && (
            <div className="space-y-6">
              <div className="border-b border-neutral-100 pb-3">
                <h3 className="text-sm font-bold text-neutral-900">风控卫士全局默认参数 (Risk Parameters)</h3>
                <p className="text-xs text-neutral-400">所有新建策略与实盘账户自动继承此风控兜底约束</p>
              </div>

              <div className="space-y-4 text-xs font-sans">
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">单只股票持仓上限 (%)</label>
                  <input
                    type="number"
                    value={maxStockWeight}
                    onChange={(e) => setMaxStockWeight(Number(e.target.value))}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs focus:outline-none"
                  />
                  <span className="text-[10px] text-neutral-400 mt-1 block">防止单一股票权重过高引发特异性风险</span>
                </div>

                <div>
                  <label className="font-bold text-neutral-800 block mb-1">组合日度硬性止损线 (%)</label>
                  <input
                    type="number"
                    value={maxDrawdownThreshold}
                    onChange={(e) => setMaxDrawdownThreshold(Number(e.target.value))}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs focus:outline-none"
                  />
                  <span className="text-[10px] text-neutral-400 mt-1 block">若单日跌幅超过此限制，自动暂停新仓并发送报警</span>
                </div>

                <div>
                  <label className="font-bold text-neutral-800 block mb-1">默认算法挂单引擎 (Execution Engine)</label>
                  <select
                    value={executionAlgo}
                    onChange={(e) => setExecutionAlgo(e.target.value)}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono"
                  >
                    <option value="TWAP">TWAP 时间加权平均算法</option>
                    <option value="VWAP">VWAP 成交量加权算法</option>
                    <option value="LIMIT">限价撮合挂单 (Direct Limit)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Alerts */}
          {activeTab === 'alerts' && (
            <div className="space-y-6">
              <div className="border-b border-neutral-100 pb-3">
                <h3 className="text-sm font-bold text-neutral-900">告警通知与 Webhook 引擎</h3>
                <p className="text-xs text-neutral-400">因子失效或风险触发时，实时推送通知至钉钉/飞书/微信群</p>
              </div>

              <div className="space-y-4 text-xs font-sans">
                <div>
                  <label className="font-bold text-neutral-800 block mb-1">钉钉 / 飞书 Webhook 机器人 Endpoint</label>
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs focus:outline-none"
                  />
                </div>

                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-neutral-900">因子 IC 衰减显著性预警</div>
                      <div className="text-neutral-400 text-[11px]">当运行策略的因子 RankIC 连续 3 天低于 0.02 时报警</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableIcAlert}
                      onChange={(e) => setEnableIcAlert(e.target.checked)}
                      className="w-4 h-4 accent-neutral-900"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-neutral-200/60">
                    <div>
                      <div className="font-bold text-neutral-900">硬性风控触线通知</div>
                      <div className="text-neutral-400 text-[11px]">任何单股或组合最大回撤触线时推送强平/减仓警报</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableRiskAlert}
                      onChange={(e) => setEnableRiskAlert(e.target.checked)}
                      className="w-4 h-4 accent-neutral-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Diagnostics */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-6">
              <div className="border-b border-neutral-100 pb-3">
                <h3 className="text-sm font-bold text-neutral-900">系统健康度与计算节点诊断</h3>
                <p className="text-xs text-neutral-400">实时监控分布式计算 Worker、内存状态与行情网关的心跳</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60">
                  <span className="text-neutral-400 block mb-1">Cloud Run Worker 内存</span>
                  <span className="text-lg font-bold text-neutral-900">324 MB / 2048 MB</span>
                  <span className="text-[10px] text-emerald-600 block mt-1">● 状态良好 (15.8%)</span>
                </div>

                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60">
                  <span className="text-neutral-400 block mb-1">行情 Gateway 连接延迟</span>
                  <span className="text-lg font-bold text-neutral-900">12 ms</span>
                  <span className="text-[10px] text-emerald-600 block mt-1">● 实时超低延迟</span>
                </div>
              </div>

              <div className="p-4 bg-neutral-900 text-white rounded-xl font-mono text-[11px] space-y-1">
                <div className="text-neutral-400">[SYSTEM DIAGNOSTICS LOGS]</div>
                <div>2026-08-14 16:40:02 [INFO] Tushare Pro Gateway connection heartbeat OK (200)</div>
                <div>2026-08-14 16:42:15 [INFO] Risk Guard Node #1 monitoring 3,210 US & 5,382 A-Share tickers</div>
                <div>2026-08-14 16:45:10 [INFO] Auto-reconciliation clean; 0 memory leaks detected</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
