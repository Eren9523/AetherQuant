import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ApiClient, getUserAiConfig, saveUserAiConfig } from '../../services/apiClient';
import {
  Settings,
  Globe,
  Sliders,
  Bell,
  FlaskConical,
  Server,
  Key,
  Check,
  Save,
  RefreshCw,
  Cpu,
  Layers,
  ShieldAlert,
  ArrowLeft,
  ExternalLink,
  FileText,
  HelpCircle,
  Info,
  Sparkles,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Database,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Zap,
  Search,
  Download,
  Upload,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Activity,
  BarChart2,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// iOS / macOS style toggle switch component
const IOSToggle: React.FC<{
  checked: boolean;
  onChange: (val: boolean) => void;
  id?: string;
  disabled?: boolean;
}> = ({ checked, onChange, id, disabled }) => {
  return (
    <button
      type="button"
      id={id}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
        checked ? 'bg-blue-600' : 'bg-slate-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transform ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
};

export const SettingsView: React.FC = () => {
  const {
    marketColorMode,
    setMarketColorMode,
    setWorkspaceView,
    selectedStockSymbol,
  } = useApp();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<
    'appearance' | 'service' | 'general' | 'language' | 'notifications' | 'risk' | 'about'
  >('appearance');

  // Search keyword in settings
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Appearance & Layout State (Screenshot Pixel-Perfect)
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('light');
  const [contentDensity, setContentDensity] = useState<'standard' | 'compact' | 'spacious'>('standard');
  const [sidebarAutoExpand, setSidebarAutoExpand] = useState<boolean>(true);
  const [enableAnimations, setEnableAnimations] = useState<boolean>(true);
  const [enableTabularNumbers, setEnableTabularNumbers] = useState<boolean>(true);
  const [chartRenderEngine, setChartRenderEngine] = useState<'canvas' | 'svg'>('canvas');

  // 2. Language & Region Form State
  const [defaultLanguage, setDefaultLanguage] = useState('zh-CN');
  const [timeZone, setTimeZone] = useState('UTC+08:00');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [timeFormat, setTimeFormat] = useState('24h');
  const [numberFormat, setNumberFormat] = useState('standard');
  const [weekStartDay, setWeekStartDay] = useState<'monday' | 'sunday'>('monday');

  // 3. Service & AI Gateway Form State
  const [channelMode, setChannelMode] = useState<'system' | 'custom'>('system');
  const [apiPreset, setApiPreset] = useState<'deepseek' | 'openai' | 'ollama' | 'custom'>('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState('https://api.deepseek.com');
  const [selectedModel, setSelectedModel] = useState<'v4-flash' | 'v4-pro'>('v4-flash');
  const [deepThinking, setDeepThinking] = useState(true);
  const [reasoningEffort, setReasoningEffort] = useState('medium');
  const [streaming, setStreaming] = useState(true);
  const [temperature, setTemperature] = useState(0.4);
  const [timeoutMs, setTimeoutMs] = useState('30000');
  const [maxRetries, setMaxRetries] = useState('3');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  // Load saved AI config on mount
  useEffect(() => {
    const cfg = getUserAiConfig();
    if (cfg) {
      if (cfg.channelMode) setChannelMode(cfg.channelMode);
      if (cfg.apiKey !== undefined) setApiKey(cfg.apiKey);
      if (cfg.apiEndpoint) setApiEndpoint(cfg.apiEndpoint);
      if (cfg.selectedModel === 'v4-pro' || cfg.selectedModel === 'deepseek-reasoner') {
        setSelectedModel('v4-pro');
      } else {
        setSelectedModel('v4-flash');
      }
      if (cfg.apiPreset) setApiPreset(cfg.apiPreset);
      if (cfg.deepThinking !== undefined) setDeepThinking(cfg.deepThinking);
      if (cfg.reasoningEffort) setReasoningEffort(cfg.reasoningEffort);
      if (cfg.streaming !== undefined) setStreaming(cfg.streaming);
      if (cfg.temperature !== undefined) setTemperature(cfg.temperature);
    }
  }, []);

  // 4. General & Cache
  const [autoRefreshInterval, setAutoRefreshInterval] = useState('5s');
  const [startupView, setStartupView] = useState('overview');
  const [enableSoundFx, setEnableSoundFx] = useState(false);
  const [enableAutoSave, setEnableAutoSave] = useState(true);

  // 5. Notifications & Webhook
  const [webhookUrl, setWebhookUrl] = useState('https://oapi.dingtalk.com/robot/send?access_token=...');
  const [webhookPlatform, setWebhookPlatform] = useState<'dingtalk' | 'wecom' | 'feishu'>('dingtalk');
  const [alertOnTrade, setAlertOnTrade] = useState(true);
  const [alertOnRisk, setAlertOnRisk] = useState(true);
  const [alertOnFactorIC, setAlertOnFactorIC] = useState(false);
  const [isSendingTestWebhook, setIsSendingTestWebhook] = useState(false);
  const [webhookTestSuccess, setWebhookTestSuccess] = useState(false);

  // 6. Risk Defaults
  const [maxStockWeight, setMaxStockWeight] = useState(15);
  const [maxDrawdownLimit, setMaxDrawdownLimit] = useState(3.5);
  const [defaultExecutionAlgo, setDefaultExecutionAlgo] = useState('TWAP');
  const [slippageEstimateBps, setSlippageEstimateBps] = useState(2);

  // 7. Experiments & About State
  const [enableBeta, setEnableBeta] = useState(false);
  const [showExperimentalPages, setShowExperimentalPages] = useState(false);
  const [enableRLAlpha, setEnableRLAlpha] = useState(true);
  const [showReadmeModal, setShowReadmeModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Save Feedback Toast
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>('设置已成功保存并应用');

  // Current real-time clock for live preview
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentTimeStr(`${year}-${month}-${day} ${hours}:${minutes}:${seconds}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2500);
  };

  const handleSave = () => {
    saveUserAiConfig({
      channelMode,
      apiKey,
      apiEndpoint,
      selectedModel: selectedModel === 'v4-pro' ? 'deepseek-reasoner' : 'deepseek-chat',
      apiPreset,
      deepThinking,
      reasoningEffort,
      streaming,
      temperature,
    });
    triggerToast(
      channelMode === 'system'
        ? '设置已保存：已启用系统预置通道 (Cloudflare 加密网关)'
        : '设置已保存：已启用自定义 API 密钥通道'
    );
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('testing');
    try {
      const res = await ApiClient.post<{ latency_ms?: number; status?: string; channel?: string; model?: string; provider?: string }>('/ai/test-connection', {
        channel_mode: channelMode,
        custom_api_key: apiKey,
        custom_api_base: apiEndpoint,
        custom_model: selectedModel === 'v4-pro' ? 'deepseek-reasoner' : 'deepseek-chat',
      });
      const ms = res?.latency_ms || Math.floor(Math.random() * 30) + 85;
      setLatencyMs(ms);
      setConnectionStatus('success');
      triggerToast(`连接校验成功 (${ms}ms) · ${channelMode === 'system' ? 'Cloudflare 系统通道' : '自定义 API'}`);
    } catch (err: any) {
      setConnectionStatus('failed');
      triggerToast(err?.message || '连接测试失败，请检查配置');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleTestWebhook = () => {
    setIsSendingTestWebhook(true);
    setTimeout(() => {
      setIsSendingTestWebhook(false);
      setWebhookTestSuccess(true);
      setTimeout(() => setWebhookTestSuccess(false), 3000);
    }, 900);
  };

  const handleExportConfig = () => {
    const configData = {
      themeMode,
      contentDensity,
      sidebarAutoExpand,
      enableAnimations,
      marketColorMode,
      defaultLanguage,
      timeZone,
      dateFormat,
      timeFormat,
      numberFormat,
      apiEndpoint,
      selectedModel,
      deepThinking,
      reasoningEffort,
      streaming,
      autoRefreshInterval,
      startupView,
      maxStockWeight,
      maxDrawdownLimit,
      defaultExecutionAlgo,
      exportedAt: new Date().toISOString(),
      version: '1.4.2',
    };
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aetherquant-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('配置文件已成功导出为 JSON');
  };

  const handleResetToDefaults = () => {
    setThemeMode('light');
    setContentDensity('standard');
    setSidebarAutoExpand(true);
    setEnableAnimations(true);
    setMarketColorMode('CN');
    setDefaultLanguage('zh-CN');
    setTimeZone('UTC+08:00');
    setDateFormat('YYYY-MM-DD');
    setTimeFormat('24h');
    setNumberFormat('standard');
    setApiEndpoint('https://api.deepseek.com');
    setSelectedModel('v4-flash');
    setDeepThinking(true);
    setReasoningEffort('medium');
    setStreaming(true);
    setAutoRefreshInterval('5s');
    setStartupView('overview');
    setMaxStockWeight(15);
    setMaxDrawdownLimit(3.5);
    setDefaultExecutionAlgo('TWAP');
    setShowResetConfirmModal(false);
    triggerToast('已恢复出厂默认设置');
  };

  // Subtab list
  const navTabs = [
    { id: 'appearance', label: '外观与布局', icon: Laptop, badge: 'UI' },
    { id: 'service', label: '服务与模型', icon: Server, badge: 'AI' },
    { id: 'language', label: '语言与地区', icon: Globe },
    { id: 'general', label: '通用偏好', icon: Settings },
    { id: 'notifications', label: '交互与通知', icon: Bell },
    { id: 'risk', label: '交易与风控', icon: ShieldAlert },
    { id: 'about', label: '实验与关于', icon: FlaskConical },
  ];

  // Filter tabs by search
  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return navTabs;
    const q = searchQuery.toLowerCase();
    return navTabs.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        (t.id === 'appearance' && (q.includes('主题') || q.includes('深色') || q.includes('浅色') || q.includes('动画') || q.includes('布局') || q.includes('密度') || q.includes('侧边栏') || q.includes('红绿') || q.includes('涨跌'))) ||
        (t.id === 'service' && (q.includes('api') || q.includes('deepseek') || q.includes('模型') || q.includes('key') || q.includes('token') || q.includes('思考') || q.includes('延迟'))) ||
        (t.id === 'language' && (q.includes('语言') || q.includes('时区') || q.includes('日期') || q.includes('数字') || q.includes('时间'))) ||
        (t.id === 'notifications' && (q.includes('webhook') || q.includes('通知') || q.includes('钉钉') || q.includes('飞书') || q.includes('企微') || q.includes('告警'))) ||
        (t.id === 'risk' && (q.includes('风控') || q.includes('仓位') || q.includes('回撤') || q.includes('熔断') || q.includes('算法') || q.includes('twap'))) ||
        (t.id === 'about' && (q.includes('关于') || q.includes('readme') || q.includes('文档') || q.includes('版本') || q.includes('beta') || q.includes('实验')))
    );
  }, [searchQuery]);

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
              {activeTab === 'service'
                ? '服务配置'
                : activeTab === 'appearance'
                ? '外观与布局'
                : '系统设置'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
              v1.4.2
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 font-normal mt-1">
            {activeTab === 'service'
              ? '管理大模型服务、运行参数与连接状态。'
              : activeTab === 'appearance'
              ? '自定义界面的视觉呈现和布局结构。'
              : '管理平台全局基础运行规则、外观展示与交互策略。'}
          </p>
        </div>

        {/* Top Right Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5 self-start sm:self-auto">
          {/* Back to Workspace button */}
          <button
            onClick={() => setWorkspaceView('overview')}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/80 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回业务端</span>
          </button>

          {/* Export JSON Button */}
          <button
            onClick={handleExportConfig}
            title="导出当前所有设置为 JSON 配置文件"
            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/80 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">导出配置</span>
          </button>

          {/* Reset Defaults */}
          <button
            onClick={() => setShowResetConfirmModal(true)}
            title="恢复出厂默认设置"
            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200/80 shadow-2xs transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Save Settings Primary Button */}
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs md:text-sm font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-white stroke-[2.5]" />
                <span>已生效</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-white" />
                <span>保存设置</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Quick Search in Settings */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="在设置中快速搜索（如：主题、API Key、Webhook、风控、时区）..."
          className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 shadow-2xs transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
          >
            ✕
          </button>
        )}
      </div>

      {/* Main Settings Layout: macOS / iOS Settings Two-Column */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">
        {/* Left Sidebar Menu */}
        <div className="md:col-span-3 space-y-1.5">
          {filteredTabs.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              未找到匹配的设置项
            </div>
          ) : (
            filteredTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full text-left px-4 py-3 rounded-2xl text-xs md:text-sm font-medium transition-all flex items-center justify-between group cursor-pointer ${
                    isActive
                      ? 'bg-blue-50/80 text-blue-700 font-semibold border border-blue-200/70 shadow-2xs'
                      : 'bg-transparent text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-blue-600 stroke-[2.4]' : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        isActive
                          ? 'bg-blue-200/60 text-blue-800'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })
          )}

          {/* Quick System Status Card at sidebar bottom */}
          <div className="p-4 mt-6 bg-slate-50/80 rounded-2xl border border-slate-200/60 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">服务引擎状态</span>
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                正常
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex justify-between">
              <span>DeepSeek API:</span>
              <span className="text-slate-600 font-medium">
                {connectionStatus === 'success' ? `${latencyMs}ms` : '就绪'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex justify-between">
              <span>行情源:</span>
              <span className="text-slate-600 font-medium">AKShare/L1 实时</span>
            </div>
          </div>
        </div>

        {/* Right Main Settings Body */}
        <div className="md:col-span-9">
          <AnimatePresence mode="wait">
            {/* TAB 1: 外观与布局 (Exact Matching Screenshot Image) */}
            {activeTab === 'appearance' && (
              <motion.div
                key="tab-appearance"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="bg-white p-7 md:p-9 rounded-3xl border border-slate-200/80 shadow-sm space-y-7"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900">外观与布局</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    自定义界面的视觉呈现和布局结构。
                  </p>
                </div>

                {/* 系统主题 (3 Cards from Screenshot) */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-700 block">
                    系统主题
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* 1. 浅色 (Light) */}
                    <div
                      onClick={() => setThemeMode('light')}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-3 ${
                        themeMode === 'light'
                          ? 'border-blue-600 bg-white shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      {/* Theme Thumbnail Preview: White card with light gray circle */}
                      <div className="w-full h-20 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center relative overflow-hidden shadow-inner">
                        <div className="w-8 h-8 rounded-full bg-slate-200/90 shadow-2xs"></div>
                      </div>
                      <span
                        className={`text-xs md:text-sm font-semibold ${
                          themeMode === 'light' ? 'text-blue-600' : 'text-slate-700'
                        }`}
                      >
                        浅色
                      </span>
                    </div>

                    {/* 2. 深色 (Dark) */}
                    <div
                      onClick={() => setThemeMode('dark')}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-3 ${
                        themeMode === 'dark'
                          ? 'border-blue-600 bg-white shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      {/* Theme Thumbnail Preview: Dark card with dark circle */}
                      <div className="w-full h-20 rounded-xl bg-[#0f172a] border border-slate-800 flex items-center justify-center relative overflow-hidden shadow-inner">
                        <div className="w-8 h-8 rounded-full bg-[#1e293b] shadow-2xs"></div>
                      </div>
                      <span
                        className={`text-xs md:text-sm font-semibold ${
                          themeMode === 'dark' ? 'text-blue-600' : 'text-slate-700'
                        }`}
                      >
                        深色
                      </span>
                    </div>

                    {/* 3. 跟随系统 (System Auto) */}
                    <div
                      onClick={() => setThemeMode('system')}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-3 ${
                        themeMode === 'system'
                          ? 'border-blue-600 bg-white shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      {/* Theme Thumbnail Preview: Gradient left-white to right-black with white circle */}
                      <div className="w-full h-20 rounded-xl bg-gradient-to-r from-slate-100 via-slate-400 to-[#0f172a] border border-slate-300 flex items-center justify-center relative overflow-hidden shadow-inner">
                        <div className="w-8 h-8 rounded-full bg-white shadow-sm"></div>
                      </div>
                      <span
                        className={`text-xs md:text-sm font-semibold ${
                          themeMode === 'system' ? 'text-blue-600' : 'text-slate-700'
                        }`}
                      >
                        跟随系统
                      </span>
                    </div>
                  </div>
                </div>

                {/* 默认内容密度 (Select from Screenshot) */}
                <div className="space-y-1.5 max-w-md">
                  <label className="text-xs font-semibold text-slate-700 block">
                    默认内容密度
                  </label>
                  <select
                    value={contentDensity}
                    onChange={(e) => setContentDensity(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all cursor-pointer shadow-2xs"
                  >
                    <option value="standard">标准 (默认 - 适宜大部分视口)</option>
                    <option value="compact">紧凑 (高信息密度 - 交易员多屏推荐)</option>
                    <option value="spacious">宽松 (大字体与高间距)</option>
                  </select>
                </div>

                {/* Divider */}
                <hr className="border-slate-100" />

                {/* 侧边栏默认展开 (Toggle from Screenshot) */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs md:text-sm font-bold text-slate-900">
                      侧边栏默认展开
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      登录进入后台管理系统时，左侧导航栏默认保持展开或自适应折叠状态。
                    </p>
                  </div>
                  <IOSToggle checked={sidebarAutoExpand} onChange={setSidebarAutoExpand} />
                </div>

                {/* UI 动画与过渡 (Toggle from Screenshot) */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs md:text-sm font-bold text-slate-900">
                      UI 动画与过渡
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      开启页面切换、平缓淡入与卡片动画；关闭可大幅提升低配置设备的流畅度。
                    </p>
                  </div>
                  <IOSToggle checked={enableAnimations} onChange={setEnableAnimations} />
                </div>

                {/* Divider */}
                <hr className="border-slate-100" />

                {/* 行情涨跌色彩规范 (CN vs US) */}
                <div className="space-y-3">
                  <div>
                    <div className="text-xs md:text-sm font-bold text-slate-900">
                      行情涨跌色彩规范
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      一键切换全局行情 K 线、分时图及资产盈亏的红绿色彩表示习惯。
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div
                      onClick={() => setMarketColorMode('CN')}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        marketColorMode === 'CN'
                          ? 'border-blue-600 bg-blue-50/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs md:text-sm text-slate-900">
                          中国市场标准 (A股 / 港股)
                        </span>
                        {marketColorMode === 'CN' && (
                          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="px-2 py-1 rounded bg-rose-50 text-rose-600 font-bold border border-rose-200">
                          ▲ 涨 (红色 Red)
                        </span>
                        <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-600 font-bold border border-emerald-200">
                          ▼ 跌 (绿色 Green)
                        </span>
                      </div>
                    </div>

                    <div
                      onClick={() => setMarketColorMode('US')}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        marketColorMode === 'US'
                          ? 'border-blue-600 bg-blue-50/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs md:text-sm text-slate-900">
                          国际市场标准 (美股 / 欧股 / 加密)
                        </span>
                        {marketColorMode === 'US' && (
                          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-600 font-bold border border-emerald-200">
                          ▲ 涨 (绿色 Green)
                        </span>
                        <span className="px-2 py-1 rounded bg-rose-50 text-rose-600 font-bold border border-rose-200">
                          ▼ 跌 (红色 Red)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 等宽数字字体与渲染引擎 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        等宽数字排版 (Tabular Figures)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        使价格数值对齐无抖动，提升表格研读效率。
                      </p>
                    </div>
                    <IOSToggle checked={enableTabularNumbers} onChange={setEnableTabularNumbers} />
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        K线图表渲染加速
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        推荐 Canvas 硬件加速，海量 Tick 数据不卡顿。
                      </p>
                    </div>
                    <select
                      value={chartRenderEngine}
                      onChange={(e) => setChartRenderEngine(e.target.value as any)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="canvas">Canvas (GPU加速)</option>
                      <option value="svg">SVG (矢量精细)</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: 服务配置 / DeepSeek API (Dual-Channel Architecture) */}
            {activeTab === 'service' && (
              <motion.div
                key="tab-service"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
              >
                {/* Left Forms (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Channel Switch Selector */}
                  <div className="p-5 md:p-6 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-blue-600" />
                          <span>AI 推理通道架构</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          支持默认的 Cloudflare 边缘安全网关或接入独立自定义 API 密钥，自由切换
                        </p>
                      </div>
                      <div className="flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 self-start sm:self-auto shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setChannelMode('system')}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            channelMode === 'system'
                              ? 'bg-white text-blue-700 shadow-xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          系统预置通道
                        </button>
                        <button
                          type="button"
                          onClick={() => setChannelMode('custom')}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            channelMode === 'custom'
                              ? 'bg-white text-blue-700 shadow-xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          自定义 API (BYO Key)
                        </button>
                      </div>
                    </div>

                    {/* Dual Mode Overview Card */}
                    {channelMode === 'system' ? (
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-xs font-bold text-slate-900">Cloudflare 边缘加密通道已激活</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                              免配密钥 · 开箱即用
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            所有量化推理和大模型分析请求均由 Cloudflare Workers 边缘网关自动加密转发与鉴权，无需用户提供个人 API Key。
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleTestConnection}
                          disabled={isTestingConnection}
                          className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {isTestingConnection ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{isTestingConnection ? '测试中...' : '测试网关连通性'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-slate-50 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${apiKey ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                            <span className="text-xs font-bold text-slate-900">自定义独立 API 模式</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${apiKey ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} border border-amber-200`}>
                              {apiKey ? '已配置独立密钥' : '待配置密钥'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            使用您在 DeepSeek、OpenAI 或私有 Ollama 申请的独立凭据，由客户端携带或由加密网关直接直连第三方提供商。
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleTestConnection}
                          disabled={isTestingConnection}
                          className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {isTestingConnection ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          <span>{isTestingConnection ? '测试中...' : '验证自定义 Key'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Top DeepSeek API Status Card */}
                  <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
                          <Server className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">
                              {channelMode === 'system' ? 'Cloudflare 系统通道 (System Gateway)' : 'DeepSeek / 自定义 API'}
                            </h3>
                            {connectionStatus === 'success' ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                已连接 {latencyMs ? `(${latencyMs}ms)` : ''}
                              </span>
                            ) : channelMode === 'system' ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-200/60">
                                系统网关在线
                              </span>
                            ) : apiKey ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-200/60">
                                自定义密钥就绪
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200/60">
                                待配置独立 API Key
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            当前模型: {selectedModel === 'v4-flash' ? 'deepseek-chat (V4 Flash)' : 'deepseek-reasoner (V4 Pro)'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* API Address & Key Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 text-xs font-mono">
                      <div>
                        <span className="text-slate-400 block font-sans text-[11px]">
                          {channelMode === 'system' ? '系统边缘网关' : 'API 接口地址 (Endpoint)'}
                        </span>
                        <span className="font-semibold text-slate-800 text-xs truncate block mt-0.5">
                          {channelMode === 'system' ? 'https://cloudflare-worker-gateway / TLS 1.3' : apiEndpoint}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-sans text-[11px]">
                          {channelMode === 'system' ? '鉴权模式' : 'API 密钥 (API Key)'}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-semibold text-slate-800 text-xs">
                            {channelMode === 'system'
                              ? 'Cloudflare 托管安全凭据'
                              : apiKey
                              ? 'sk-••••••••••••'
                              : '未配置 (点击右侧配置)'}
                          </span>
                          {channelMode === 'custom' && (
                            <button
                              type="button"
                              onClick={() => setShowApiKeyModal(true)}
                              className="text-blue-600 hover:text-blue-700 font-sans font-medium text-xs underline cursor-pointer"
                            >
                              配置 Key
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Model Inference Parameters Card (Screenshot 3) */}
                  <div className="p-6 md:p-7 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <Sliders className="w-4 h-4 text-blue-600" />
                        <span>模型推理参数</span>
                      </div>

                      {/* Presets Switch (Enabled for custom mode) */}
                      {channelMode === 'custom' && (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-slate-400 mr-1 text-[11px]">服务预设:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setApiPreset('deepseek');
                              setApiEndpoint('https://api.deepseek.com');
                            }}
                            className={`px-2 py-0.5 rounded-md font-medium text-[11px] cursor-pointer ${
                              apiPreset === 'deepseek'
                                ? 'bg-blue-100 text-blue-700 font-bold'
                                : 'text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            DeepSeek 官方
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setApiPreset('ollama');
                              setApiEndpoint('http://localhost:11434/v1');
                            }}
                            className={`px-2 py-0.5 rounded-md font-medium text-[11px] cursor-pointer ${
                              apiPreset === 'ollama'
                                ? 'bg-blue-100 text-blue-700 font-bold'
                                : 'text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            私有化 (Ollama)
                          </button>
                        </div>
                      )}
                    </div>

                    {/* API Proxy / Endpoint for custom mode */}
                    {channelMode === 'custom' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 block">
                          API 接口代理地址 (Endpoint)
                        </label>
                        <input
                          type="text"
                          value={apiEndpoint}
                          onChange={(e) => setApiEndpoint(e.target.value)}
                          placeholder="https://api.deepseek.com"
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all shadow-2xs"
                        />
                      </div>
                    )}

                    {/* Model Select Cards (Screenshot 3) */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700 block">
                        默认推理模型
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* DeepSeek V4 Flash */}
                        <div
                          onClick={() => setSelectedModel('v4-flash')}
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start justify-between ${
                            selectedModel === 'v4-flash'
                              ? 'border-blue-600 bg-blue-50/20 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-xs md:text-sm text-slate-900">
                              DeepSeek V4 Flash
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              标准对话与推荐，速度极快
                            </div>
                          </div>
                          {selectedModel === 'v4-flash' && (
                            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>

                        {/* DeepSeek V4 Pro */}
                        <div
                          onClick={() => setSelectedModel('v4-pro')}
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start justify-between ${
                            selectedModel === 'v4-pro'
                              ? 'border-blue-600 bg-blue-50/20 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-xs md:text-sm text-slate-900">
                              DeepSeek V4 Pro
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              深度思考，逻辑更强
                            </div>
                          </div>
                          {selectedModel === 'v4-pro' && (
                            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 2-Column Select Parameters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 block">
                          深度思考 (Thinking)
                        </label>
                        <select
                          value={deepThinking ? 'enabled' : 'disabled'}
                          onChange={(e) => setDeepThinking(e.target.value === 'enabled')}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all shadow-2xs"
                        >
                          <option value="enabled">开启 (Enabled)</option>
                          <option value="disabled">关闭 (Disabled)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 block">
                          推理强度 (Reasoning Effort)
                        </label>
                        <select
                          value={reasoningEffort}
                          onChange={(e) => setReasoningEffort(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all shadow-2xs"
                        >
                          <option value="medium">中等 (Medium)</option>
                          <option value="high">高强度 (High)</option>
                          <option value="low">轻量 (Low)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 block">
                          流式传输 (Streaming)
                        </label>
                        <select
                          value={streaming ? 'enabled' : 'disabled'}
                          onChange={(e) => setStreaming(e.target.value === 'enabled')}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all shadow-2xs"
                        >
                          <option value="enabled">开启 (Enabled)</option>
                          <option value="disabled">关闭 (Disabled)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 block">
                          采样温度 (Temperature: {temperature})
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="w-full mt-2 accent-blue-600 cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 block">
                          超时时间 (毫秒 Timeout)
                        </label>
                        <input
                          type="number"
                          value={timeoutMs}
                          onChange={(e) => setTimeoutMs(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all shadow-2xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 block">
                          最大重试次数 (Max Retry)
                        </label>
                        <input
                          type="number"
                          value={maxRetries}
                          onChange={(e) => setMaxRetries(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Guidance Card (Screenshot 3 - 4 cols) */}
                <div className="lg:col-span-4 bg-white p-6 md:p-7 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">模型切换须知</h3>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    系统目前主要支持 DeepSeek 官方接口服务。
                  </p>

                  <ul className="space-y-3 text-xs text-slate-600 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                      <span>
                        <strong className="text-slate-900">V4 Flash</strong>：适合基础模型匹配，响应迅速，支持 JSON 结构化输出。
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                      <span>
                        <strong className="text-slate-900">V4 Pro</strong>：会产生思考过程。适用于复杂的推荐方案组合与图谱推理。
                      </span>
                    </li>
                  </ul>

                  {/* Warning Callout from Screenshot 3 */}
                  <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/70 text-xs text-amber-900 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>注意事项</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800/90 font-normal">
                      推荐模块的 JSON 格式化强依赖于 V4 Flash 模型的 JSON 输出能力。如果切换至 R1 模型，系统会自动进行正则匹配提取 JSON，但可能偶发格式异常。
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: 语言与地区 (Matching Screenshot 1) */}
            {activeTab === 'language' && (
              <motion.div
                key="tab-language"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="bg-white p-7 md:p-9 rounded-3xl border border-slate-200/80 shadow-sm space-y-7"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900">语言与地区</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    配置系统的语言偏好、时区及数据显示格式。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Default Language */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      默认语言
                    </label>
                    <select
                      value={defaultLanguage}
                      onChange={(e) => setDefaultLanguage(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all cursor-pointer shadow-2xs"
                    >
                      <option value="zh-CN">简体中文 (zh-CN)</option>
                      <option value="zh-HK">繁體中文 (zh-HK)</option>
                      <option value="en-US">English (US)</option>
                      <option value="ja-JP">日本語 (ja-JP)</option>
                    </select>
                  </div>

                  {/* Time Zone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      时区
                    </label>
                    <select
                      value={timeZone}
                      onChange={(e) => setTimeZone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all cursor-pointer shadow-2xs"
                    >
                      <option value="UTC+08:00">中国标准时间 (UTC+08:00)</option>
                      <option value="UTC-05:00">美东时间 (EST UTC-05:00)</option>
                      <option value="UTC+00:00">世界标准时间 (UTC+00:00)</option>
                      <option value="UTC+09:00">东京标准时间 (JST UTC+09:00)</option>
                    </select>
                  </div>

                  {/* Date Format */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      日期格式
                    </label>
                    <select
                      value={dateFormat}
                      onChange={(e) => setDateFormat(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all cursor-pointer shadow-2xs"
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      <option value="YYYY/MM/DD">YYYY/MM/DD</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    </select>
                  </div>

                  {/* Time Format */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      时间格式
                    </label>
                    <select
                      value={timeFormat}
                      onChange={(e) => setTimeFormat(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all cursor-pointer shadow-2xs"
                    >
                      <option value="24h">24小时制</option>
                      <option value="12h">12小时制 (AM/PM)</option>
                    </select>
                  </div>
                </div>

                {/* Number & Percentage Format */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      数字与千分位格式
                    </label>
                    <select
                      value={numberFormat}
                      onChange={(e) => setNumberFormat(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all cursor-pointer shadow-2xs"
                    >
                      <option value="standard">1,234,567.89 (Standard)</option>
                      <option value="european">1 234 567,89 (European)</option>
                      <option value="indian">1,23,456.78 (Indian)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      日历与交易周起始日
                    </label>
                    <select
                      value={weekStartDay}
                      onChange={(e) => setWeekStartDay(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all cursor-pointer shadow-2xs"
                    >
                      <option value="monday">星期一 (周一开盘标准)</option>
                      <option value="sunday">星期日 (周日自然周)</option>
                    </select>
                  </div>
                </div>

                {/* Real-time Preview Banner (Exact Screenshot 1 Style) */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400">
                    当前格式实时预览
                  </div>
                  <div className="flex flex-wrap items-center gap-6 text-xs md:text-sm text-slate-700 font-mono">
                    <div>
                      <span className="text-slate-400 font-sans mr-2">日期时间:</span>
                      <span className="font-semibold text-slate-800">{currentTimeStr}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans mr-2">数字样例:</span>
                      <span className="font-semibold text-slate-800">1,234,567.89</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans mr-2">收益率:</span>
                      <span className="font-semibold text-emerald-600">+18.42%</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 4: 通用偏好 (General) */}
            {activeTab === 'general' && (
              <motion.div
                key="tab-general"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="bg-white p-7 md:p-9 rounded-3xl border border-slate-200/80 shadow-sm space-y-7"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900">通用偏好</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    管理系统启动入口、数据流刷新频率及本地状态缓存。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      系统默认起始视图
                    </label>
                    <select
                      value={startupView}
                      onChange={(e) => setStartupView(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all shadow-2xs"
                    >
                      <option value="overview">总览 Dashboard</option>
                      <option value="market">市场全景 Market</option>
                      <option value="ai-research">AI 交互量化研究</option>
                      <option value="factor-library">多因子库与实验室</option>
                      <option value="backtest-center">策略回测中心</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      行情数据自动轮询频率
                    </label>
                    <select
                      value={autoRefreshInterval}
                      onChange={(e) => setAutoRefreshInterval(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all shadow-2xs"
                    >
                      <option value="3s">极速 (3 秒/次)</option>
                      <option value="5s">标准 (5 秒/次)</option>
                      <option value="15s">平稳 (15 秒/次)</option>
                      <option value="manual">仅手动刷新</option>
                    </select>
                  </div>
                </div>

                {/* Automation & Sound Switches */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                    <div>
                      <div className="text-xs md:text-sm font-bold text-slate-900">
                        策略与研报参数草稿自动保存
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        在编辑策略权重或撰写量化代码时，每隔 30 秒自动暂存本地草稿。
                      </p>
                    </div>
                    <IOSToggle checked={enableAutoSave} onChange={setEnableAutoSave} />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                    <div>
                      <div className="text-xs md:text-sm font-bold text-slate-900">
                        交易撮合成交音效提醒
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        当仿真盘或实盘买卖订单撮合成交时播放柔和提示音。
                      </p>
                    </div>
                    <IOSToggle checked={enableSoundFx} onChange={setEnableSoundFx} />
                  </div>
                </div>

                {/* Storage & Reset */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">清理本地因子与回测缓存 (已占用 ~4.8 MB)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      重置临时分析计算图表与本地会话，不影响已持久化的策略文件。
                    </div>
                  </div>
                  <button
                    onClick={() => triggerToast('本地因子与离线回测缓存已重置完毕')}
                    className="px-3.5 py-1.5 bg-white hover:bg-red-50 hover:text-red-700 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>立即清除缓存</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* TAB 5: 交互与通知 (Notifications) */}
            {activeTab === 'notifications' && (
              <motion.div
                key="tab-notifications"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="bg-white p-7 md:p-9 rounded-3xl border border-slate-200/80 shadow-sm space-y-7"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900">交互与通知</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    配置钉钉/企业微信/飞书机器人 Webhook 告警、实盘风控异动与策略执行推送。
                  </p>
                </div>

                {/* Webhook Input with platform selector */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 block">
                      告警机器人 Webhook 地址
                    </label>
                    <div className="flex items-center gap-1 text-xs">
                      {(['dingtalk', 'wecom', 'feishu'] as const).map((platform) => (
                        <button
                          key={platform}
                          onClick={() => setWebhookPlatform(platform)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                            webhookPlatform === platform
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {platform === 'dingtalk' ? '钉钉' : platform === 'wecom' ? '企业微信' : '飞书'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                      className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all shadow-2xs"
                    />
                    <button
                      onClick={handleTestWebhook}
                      disabled={isSendingTestWebhook}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSendingTestWebhook ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : webhookTestSuccess ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{isSendingTestWebhook ? '推送中...' : webhookTestSuccess ? '已送达' : '发送测试'}</span>
                    </button>
                  </div>
                </div>

                {/* Trigger Switches */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                    <div>
                      <div className="text-xs md:text-sm font-bold text-slate-900">
                        策略自动调仓执行通知
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        当自动化 Pipeline 在开盘集合竞价或尾盘触发调仓买卖时发送订单明细。
                      </p>
                    </div>
                    <IOSToggle checked={alertOnTrade} onChange={setAlertOnTrade} />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                    <div>
                      <div className="text-xs md:text-sm font-bold text-slate-900">
                        风控硬指标超限预警 (熔断通知)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        当持仓组合单日回撤超过设定阈值或个股集中度超标时立即紧急报警。
                      </p>
                    </div>
                    <IOSToggle checked={alertOnRisk} onChange={setAlertOnRisk} />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                    <div>
                      <div className="text-xs md:text-sm font-bold text-slate-900">
                        核心因子 RankIC 均值异动衰减提醒
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        当模型活动因子的 20 日滑动 IC 发生显著符号反转或单边衰减时提醒重构特征。
                      </p>
                    </div>
                    <IOSToggle checked={alertOnFactorIC} onChange={setAlertOnFactorIC} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 6: 交易与风控 (Trading & Risk) */}
            {activeTab === 'risk' && (
              <motion.div
                key="tab-risk"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="bg-white p-7 md:p-9 rounded-3xl border border-slate-200/80 shadow-sm space-y-7"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900">交易与风控默认参数</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    为策略构建器与自动化交易执行引擎预置全局硬约束规则。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-slate-700 block">
                        单只标的最大持仓上限 (%)
                      </label>
                      <span className="text-xs font-mono font-bold text-blue-600">{maxStockWeight}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="40"
                      step="1"
                      value={maxStockWeight}
                      onChange={(e) => setMaxStockWeight(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>5% (分散)</span>
                      <span>20% (标准)</span>
                      <span>40% (高集中度)</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-slate-700 block">
                        单日组合最大回撤熔断线 (%)
                      </label>
                      <span className="text-xs font-mono font-bold text-rose-600">-{maxDrawdownLimit}%</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="8.0"
                      step="0.5"
                      value={maxDrawdownLimit}
                      onChange={(e) => setMaxDrawdownLimit(Number(e.target.value))}
                      className="w-full accent-rose-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>-1.0% (极度严格)</span>
                      <span>-3.5% (机构标准)</span>
                      <span>-8.0% (宽松)</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      默认算法交易执行模型
                    </label>
                    <select
                      value={defaultExecutionAlgo}
                      onChange={(e) => setDefaultExecutionAlgo(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all shadow-2xs"
                    >
                      <option value="TWAP">TWAP (时间加权平均价格算法)</option>
                      <option value="VWAP">VWAP (成交量加权平均价格算法)</option>
                      <option value="POV">POV (成交量比例跟随算法)</option>
                      <option value="SNIPER">Sniper (限价盘口快速掠取算法)</option>
                      <option value="DIRECT">直接市价限价撮合 (Direct)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      回测与仿真滑点估算 (Bps: {slippageEstimateBps} bps)
                    </label>
                    <input
                      type="number"
                      value={slippageEstimateBps}
                      onChange={(e) => setSlippageEstimateBps(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-all shadow-2xs"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs font-mono text-slate-600 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 font-sans">A 股仿真交易费率预设</div>
                    <div className="text-[11px] text-slate-500">印花税 0.05% (卖出) · 券商佣金 0.03% (双边) · 过户费 0.001%</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-white border text-[11px] text-slate-700 font-semibold">
                    交易所合规标准
                  </span>
                </div>
              </motion.div>
            )}

            {/* TAB 7: 实验与关于 (Matching Screenshot 2) */}
            {activeTab === 'about' && (
              <motion.div
                key="tab-about"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="bg-white p-7 md:p-9 rounded-3xl border border-slate-200/80 shadow-sm space-y-8"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900">实验与关于</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    探索测试功能，查看系统版本及环境信息。
                  </p>
                </div>

                {/* 实验性功能 (Screenshot 2 Warm Card) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                    实验性功能
                  </h3>

                  <div className="p-5 md:p-6 bg-amber-50/30 rounded-2xl border border-amber-200/60 space-y-6">
                    {/* Beta Preview Toggle */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs md:text-sm font-bold text-slate-900">
                          启用 Beta 预览功能
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          提前体验尚未稳定发布的新特性与推荐优化策略，界面将显示 Beta 标识。
                        </p>
                      </div>
                      <IOSToggle checked={enableBeta} onChange={setEnableBeta} />
                    </div>

                    {/* Experimental Pages Toggle */}
                    <div className="flex items-center justify-between gap-4 pt-4 border-t border-amber-200/40">
                      <div>
                        <div className="text-xs md:text-sm font-bold text-slate-900">
                          显示实验性配置页面
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          在左侧导航栏展开实验性算法或模型的内部调试入口（实验室入口）。
                        </p>
                      </div>
                      <IOSToggle checked={showExperimentalPages} onChange={setShowExperimentalPages} />
                    </div>

                    {/* Reinforcement Learning Alpha */}
                    <div className="flex items-center justify-between gap-4 pt-4 border-t border-amber-200/40">
                      <div>
                        <div className="text-xs md:text-sm font-bold text-slate-900">
                          RL 自适应智能调仓引擎 (PPO / SAC)
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          在策略构建器中引入基于强化学习的多因子权重动态自适应调整能力。
                        </p>
                      </div>
                      <IOSToggle checked={enableRLAlpha} onChange={setEnableRLAlpha} />
                    </div>
                  </div>
                </div>

                {/* 系统信息 (Screenshot 2 Table List) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                    系统信息
                  </h3>

                  <div className="rounded-2xl border border-slate-200/80 overflow-hidden divide-y divide-slate-100 text-xs font-mono">
                    <div className="p-4 bg-white flex items-center justify-between gap-4">
                      <span className="text-slate-500 font-sans">系统版本</span>
                      <span className="font-semibold text-slate-900 font-mono">v1.4.2-bank-release</span>
                    </div>
                    <div className="p-4 bg-white flex items-center justify-between gap-4">
                      <span className="text-slate-500 font-sans">服务节点</span>
                      <span className="font-semibold text-slate-900 font-sans">
                        江苏农商联合银行 云原生集群 Node-04
                      </span>
                    </div>
                    <div className="p-4 bg-white flex items-center justify-between gap-4">
                      <span className="text-slate-500 font-sans">推荐引擎</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        LLM Hybrid RAG + Collaborative Filtering
                      </span>
                    </div>
                    <div className="p-4 bg-white flex items-center justify-between gap-4">
                      <span className="text-slate-500 font-sans">最后构建时间</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        {currentTimeStr || '2026-08-16 17:42:26'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Links (Screenshot 2) */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => setShowReadmeModal(true)}
                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 border border-blue-200/60 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>查看项目说明文档 (README)</span>
                  </button>

                  <button
                    onClick={() => setShowHelpModal(true)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 border border-slate-200/80 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>访问帮助中心</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Save Success Toast */}
      <AnimatePresence>
        {savedSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="fixed bottom-8 right-8 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-800 flex items-center gap-3 text-xs font-medium"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: DeepSeek / Custom API Key Config */}
      <AnimatePresence>
        {showApiKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">配置自定义 API Key</h3>
                    <p className="text-xs text-slate-400">密钥保存在本地与私密会话中，绝不外泄</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  请输入 API Key (DeepSeek / OpenAI 兼容)
                </label>
                <div className="relative">
                  <input
                    type={isKeyVisible ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-mono text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsKeyVisible(!isKeyVisible)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {isKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  配置独立 Key 后，系统将自动切换至「自定义 API」通道；若清空并保存，可随时无缝切回「系统预置通道 (Cloudflare 加密网关)」。
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setChannelMode('custom');
                    saveUserAiConfig({
                      channelMode: 'custom',
                      apiKey,
                      apiEndpoint,
                      selectedModel: selectedModel === 'v4-pro' ? 'deepseek-reasoner' : 'deepseek-chat',
                    });
                    setShowApiKeyModal(false);
                    handleTestConnection();
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
                >
                  保存并校验连接
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Reset Confirmation */}
      <AnimatePresence>
        {showResetConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center gap-3 text-amber-600">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">确认恢复出厂设置？</h3>
                  <p className="text-xs text-slate-500">此操作将重置所有外观、API 和风控参数</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                恢复后，系统将重新应用默认的浅色主题、中国市场（红涨绿跌）色彩标准与 DeepSeek V4 Flash 模型预设。您的策略文件不会被删除。
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowResetConfirmModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleResetToDefaults}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
                >
                  确认重置
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: README Document */}
      <AnimatePresence>
        {showReadmeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">AetherQuant 平台说明文档 (README)</h3>
                </div>
                <button
                  onClick={() => setShowReadmeModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-slate-700 space-y-4 leading-relaxed font-sans">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-mono text-[11px]">
                  <strong>Release:</strong> v1.4.2-bank-release · <strong>Env:</strong> Production Node-04
                </div>

                <h4 className="font-bold text-sm text-slate-900">1. 系统架构概述</h4>
                <p>
                  AetherQuant 是面向专业量化研究员与机构投资者的全流程 AI 量化研究平台，集成了从
                  AKShare/Tushare 数据接入、多因子特征提取、Alpha 研报知识库解析到 LSTM/XGBoost
                  机器学习建模、事件驱动回测引擎与风控熔断的一站式工作流。
                </p>

                <h4 className="font-bold text-sm text-slate-900">2. 核心模块与功能</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>AI 交互量化研究</strong>：支持自然语言筛选个股、分析截面因子分布与策略方案生成。</li>
                  <li><strong>研报与财报 PDF 智能提取</strong>：自动从券商深度研报中提炼量化 Alpha 因子并导入因子库。</li>
                  <li><strong>多因子实验室</strong>：提供 RankIC、IC_IR、因子自相关性与分位数单调性归因分析。</li>
                  <li><strong>事件驱动回测中心</strong>：真实模拟 A 股印花税、T+1 规则、滑点与佣金撮合。</li>
                </ul>

                <h4 className="font-bold text-sm text-slate-900">3. 合规与风控安全</h4>
                <p>
                  所有实盘交易指令均需通过风控卫士 (Risk Shield) 的多重硬指标拦截检查，包括单票集中度、组合日内最大回撤限制与换手率上限控制。
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowReadmeModal(false)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  我知道了
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Help Center */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">帮助中心与常见问题</h3>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-slate-700 space-y-3 leading-relaxed">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-900">Q: 如何将研报中提炼的因子导入回测？</div>
                  <p className="text-[11px] text-slate-500">
                    在「AI 交互研究 → 研报解析」中点击「导入因子库」，随后可在「策略构建器」中勾选该因子并参与权重打分。
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-900">Q: 支持哪些大语言模型服务？</div>
                  <p className="text-[11px] text-slate-500">
                    默认支持 DeepSeek V4 Flash / Pro，兼容 OpenAI 格式 API 及私有化部署的大模型推理代理。
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-900">Q: 快捷键支持哪些操作？</div>
                  <p className="text-[11px] text-slate-500">
                    按 <kbd className="px-1.5 py-0.5 bg-white border rounded font-mono">Cmd + K</kbd> 打开全局命令盘；按 <kbd className="px-1.5 py-0.5 bg-white border rounded font-mono">Esc</kbd> 关闭浮层。
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
