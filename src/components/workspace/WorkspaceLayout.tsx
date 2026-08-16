import React from 'react';
import { useApp } from '../../context/AppContext';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { WorkspaceHeader } from './WorkspaceHeader';
import { CommandPalette } from '../common/CommandPalette';
import { AskAIDrawer } from '../common/AskAIDrawer';

import { DashboardView } from './DashboardView';
import { MarketView } from './MarketView';
import { StockDetailView } from './StockDetailView';
import { AIResearchView } from './AIResearchView';
import { DataCenterView } from './DataCenterView';
import { FactorViews } from './FactorViews';
import { StrategyViews } from './StrategyViews';
import { BacktestViews } from './BacktestViews';
import { MLLabView } from './MLLabView';
import { PortfolioView } from './PortfolioView';
import { TradingView } from './TradingView';
import { RiskView } from './RiskView';
import { AutomationView } from './AutomationView';
import { SettingsView } from './SettingsView';

export const WorkspaceLayout: React.FC = () => {
  const { workspaceView } = useApp();

  const renderView = () => {
    switch (workspaceView) {
      case 'overview':
        return <DashboardView />;
      case 'market':
        return <MarketView />;
      case 'stock-detail':
        return <StockDetailView />;
      case 'ai-research':
      case 'doc-research':
        return <AIResearchView />;
      case 'data-center':
      case 'upload-center':
      case 'data-browser':
        return <DataCenterView />;
      case 'factor-library':
      case 'factor-lab':
        return <FactorViews />;
      case 'strategy-library':
      case 'strategy-builder':
        return <StrategyViews />;
      case 'backtest-center':
      case 'strategy-compare':
        return <BacktestViews />;
      case 'ml-lab':
        return <MLLabView />;
      case 'portfolio':
        return <PortfolioView />;
      case 'trading':
        return <TradingView />;
      case 'risk':
        return <RiskView />;
      case 'automation':
        return <AutomationView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white">
      {/* Sidebar Navigation */}
      <WorkspaceSidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <WorkspaceHeader />
        <main className="flex-1 pb-16">{renderView()}</main>
      </div>

      {/* Global Modals / Drawers */}
      <CommandPalette />
      <AskAIDrawer />
    </div>
  );
};
