import React, { createContext, useContext, useState, useEffect } from 'react';
import { MarketColorMode, WorkspaceView, PaperAccount } from '../types';
import { mockPaperAccount } from '../mocks/mockPortfolio';

interface AppContextType {
  currentRoute: 'landing' | 'workspace';
  workspaceView: WorkspaceView;
  selectedStockSymbol: string;
  marketColorMode: MarketColorMode;
  isCmdKOpen: boolean;
  isAskAIOpen: boolean;
  selectedBacktestId: string;
  paperAccount: PaperAccount;
  isTransitioningToWorkspace: boolean;
  setCurrentRoute: (route: 'landing' | 'workspace') => void;
  setWorkspaceView: (view: WorkspaceView) => void;
  setSelectedStockSymbol: (symbol: string) => void;
  setMarketColorMode: (mode: MarketColorMode) => void;
  setIsCmdKOpen: (open: boolean) => void;
  setIsAskAIOpen: (open: boolean) => void;
  setSelectedBacktestId: (id: string) => void;
  toggleMarketColorMode: () => void;
  enterWorkspaceWithTransition: (targetView?: WorkspaceView) => void;
  navigateToStockDetail: (symbol: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<'landing' | 'workspace'>('landing');
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('overview');
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string>('600519.SH');
  const [marketColorMode, setMarketColorMode] = useState<MarketColorMode>('CN');
  const [isCmdKOpen, setIsCmdKOpen] = useState<boolean>(false);
  const [isAskAIOpen, setIsAskAIOpen] = useState<boolean>(false);
  const [selectedBacktestId, setSelectedBacktestId] = useState<string>('bt_mom_60_v1');
  const [paperAccount] = useState<PaperAccount>(mockPaperAccount);
  const [isTransitioningToWorkspace, setIsTransitioningToWorkspace] = useState<boolean>(false);

  // Global Keyboard listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCmdKOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleMarketColorMode = () => {
    setMarketColorMode((prev) => (prev === 'CN' ? 'US' : 'CN'));
  };

  const enterWorkspaceWithTransition = (targetView: WorkspaceView = 'overview') => {
    setIsTransitioningToWorkspace(true);
    setTimeout(() => {
      setWorkspaceView(targetView);
      setCurrentRoute('workspace');
      setIsTransitioningToWorkspace(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 450);
  };

  const navigateToStockDetail = (symbol: string) => {
    setSelectedStockSymbol(symbol);
    if (currentRoute !== 'workspace') {
      enterWorkspaceWithTransition('stock-detail');
    } else {
      setWorkspaceView('stock-detail');
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentRoute,
        workspaceView,
        selectedStockSymbol,
        marketColorMode,
        isCmdKOpen,
        isAskAIOpen,
        selectedBacktestId,
        paperAccount,
        isTransitioningToWorkspace,
        setCurrentRoute,
        setWorkspaceView,
        setSelectedStockSymbol,
        setMarketColorMode,
        setIsCmdKOpen,
        setIsAskAIOpen,
        setSelectedBacktestId,
        toggleMarketColorMode,
        enterWorkspaceWithTransition,
        navigateToStockDetail,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
