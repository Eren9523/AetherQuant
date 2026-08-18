import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { WorkspaceView } from '../../types';
import {
  LayoutDashboard,
  Globe,
  LineChart,
  Sparkles,
  FileText,
  Database,
  UploadCloud,
  HardDrive,
  Cpu,
  BarChart2,
  BookOpen,
  Layers,
  Play,
  GitCompare,
  TestTube,
  Briefcase,
  TrendingUp,
  ShieldAlert,
  Clock,
  Settings,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { RUNTIME_CONFIG } from '../../config/runtimeConfig';

interface NavItem {
  id: WorkspaceView;
  label: string;
  icon: React.ReactNode;
  children?: { id: WorkspaceView; label: string }[];
}

export const WorkspaceSidebar: React.FC = () => {
  const { workspaceView, setWorkspaceView, setCurrentRoute } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    market: true,
    research: true,
    data: true,
    factor: true,
    strategy: true,
    backtest: true,
  });

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navGroups: { groupName: string; key: string; items: NavItem[] }[] = [
    {
      groupName: '概览',
      key: 'overview_group',
      items: [
        {
          id: 'overview',
          label: '总览 Dashboard',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
      ],
    },
    {
      groupName: '市场行情',
      key: 'market',
      items: [
        {
          id: 'market',
          label: '市场全景',
          icon: <Globe className="w-4 h-4" />,
        },
        {
          id: 'stock-detail',
          label: '股票深度 Terminal',
          icon: <LineChart className="w-4 h-4" />,
        },
      ],
    },
    {
      groupName: 'AI 研究',
      key: 'research',
      items: [
        {
          id: 'ai-research',
          label: 'AI 交互研究 Thread',
          icon: <Sparkles className="w-4 h-4 text-amber-500" />,
        },
        {
          id: 'doc-research',
          label: '研报与文档解析',
          icon: <FileText className="w-4 h-4" />,
        },
      ],
    },
    {
      groupName: '数据中心',
      key: 'data',
      items: [
        {
          id: 'data-center',
          label: '数据源与质量',
          icon: <Database className="w-4 h-4" />,
        },
        {
          id: 'upload-center',
          label: '上传中心 (BYOD)',
          icon: <UploadCloud className="w-4 h-4" />,
        },
        {
          id: 'data-browser',
          label: '数据浏览器',
          icon: <HardDrive className="w-4 h-4" />,
        },
      ],
    },
    {
      groupName: '因子与策略',
      key: 'factor',
      items: [
        {
          id: 'factor-library',
          label: '因子库',
          icon: <Cpu className="w-4 h-4" />,
        },
        {
          id: 'factor-lab',
          label: '因子实验室 (IC/RankIC)',
          icon: <BarChart2 className="w-4 h-4" />,
        },
        {
          id: 'strategy-library',
          label: '策略库',
          icon: <BookOpen className="w-4 h-4" />,
        },
        {
          id: 'strategy-builder',
          label: '策略构建器',
          icon: <Layers className="w-4 h-4" />,
        },
      ],
    },
    {
      groupName: '回测与 ML',
      key: 'backtest',
      items: [
        {
          id: 'backtest-center',
          label: '回测中心',
          icon: <Play className="w-4 h-4" />,
        },
        {
          id: 'strategy-compare',
          label: '策略对比矩阵',
          icon: <GitCompare className="w-4 h-4" />,
        },
        {
          id: 'ml-lab',
          label: 'ML 实验室 (LSTM/XGB)',
          icon: <TestTube className="w-4 h-4" />,
        },
      ],
    },
    {
      groupName: '交易与组合',
      key: 'trading',
      items: [
        {
          id: 'portfolio',
          label: '组合与持仓归因',
          icon: <Briefcase className="w-4 h-4" />,
        },
        {
          id: 'trading',
          label: '模拟交易 & QMT',
          icon: <TrendingUp className="w-4 h-4" />,
        },
        {
          id: 'risk',
          label: '风险控制卫士',
          icon: <ShieldAlert className="w-4 h-4" />,
        },
        {
          id: 'automation',
          label: '定时任务与 Pipeline',
          icon: <Clock className="w-4 h-4" />,
        },
      ],
    },
    {
      groupName: '系统',
      key: 'settings_group',
      items: [
        {
          id: 'settings',
          label: '系统与 API 设置',
          icon: <Settings className="w-4 h-4" />,
        },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        'h-screen sticky top-0 bg-white border-r border-neutral-200/80 flex flex-col justify-between transition-all duration-200 z-30 select-none',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Top Header */}
      <div>
        <div className="h-16 px-4 flex items-center justify-between border-b border-neutral-100">
          {!collapsed && (
            <div
              onClick={() => setCurrentRoute('landing')}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                AQ
              </div>
              <span className="font-bold text-sm text-neutral-900 tracking-tight group-hover:text-black">
                AetherQuant
              </span>
            </div>
          )}
          {collapsed && (
            <div
              onClick={() => setCurrentRoute('landing')}
              className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-xs mx-auto cursor-pointer"
            >
              AQ
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {RUNTIME_CONFIG.isDemoMode && !collapsed && (
          <div className="px-3 pt-2.5">
            <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 text-[10px] font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>演示模式 (Demo Data)</span>
            </div>
          </div>
        )}

        {/* Nav list */}
        <div className="overflow-y-auto max-h-[calc(100vh-8rem)] p-2 space-y-4">
          {navGroups.map((grp) => (
            <div key={grp.key} className="space-y-1">
              {!collapsed && (
                <div
                  onClick={() => toggleGroup(grp.key)}
                  className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase tracking-wider cursor-pointer hover:text-neutral-600"
                >
                  <span>{grp.groupName}</span>
                  {openGroups[grp.key] ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </div>
              )}

              {(collapsed || openGroups[grp.key] !== false) &&
                grp.items.map((item) => {
                  const isActive = workspaceView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setWorkspaceView(item.id)}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left',
                        isActive
                          ? 'bg-neutral-900 text-white font-semibold shadow-sm'
                          : 'text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-900',
                        collapsed && 'justify-center px-0'
                      )}
                    >
                      <div className={cn(isActive ? 'text-white' : 'text-neutral-500')}>
                        {item.icon}
                      </div>
                      {!collapsed && <span className="line-clamp-1">{item.label}</span>}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Back to Landing button */}
      <div className="p-2 border-t border-neutral-100 bg-neutral-50/50">
        <button
          onClick={() => setCurrentRoute('landing')}
          className="w-full flex items-center justify-center gap-2 py-2 px-2 rounded-xl bg-white border border-neutral-200/80 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors shadow-2xs"
        >
          <Home className="w-3.5 h-3.5 text-neutral-500" />
          {!collapsed && <span>返回产品首页</span>}
        </button>
      </div>
    </aside>
  );
};
