import React, { createContext, useContext, useState, useEffect } from 'react';
import { MarketColorMode, WorkspaceView, PaperAccount, UserProfile } from '../types';
import { mockPaperAccount } from '../mocks/mockPortfolio';
import { UserService } from '../services/userService';
import { PortfolioService } from '../services/quantServices';
import { formatErrorMessage } from '../utils/formatters';

interface AppContextType {
  themeMode: 'light' | 'dark' | 'system';
  contentDensity: 'standard' | 'compact' | 'spacious';
  sidebarAutoExpand: boolean;
  enableAnimations: boolean;
  enableTabularNumbers: boolean;
  chartRenderEngine: 'canvas' | 'svg';
  
  // Localization Settings
  language: string;
  timeZone: string;
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
  weekStartDay: 'monday' | 'sunday';

  setLanguage: (lang: string) => void;
  setTimeZone: (tz: string) => void;
  setDateFormat: (format: string) => void;
  setTimeFormat: (format: string) => void;
  setNumberFormat: (format: string) => void;
  setWeekStartDay: (day: 'monday' | 'sunday') => void;
  
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  setContentDensity: (density: 'standard' | 'compact' | 'spacious') => void;
  setSidebarAutoExpand: (expand: boolean) => void;
  setEnableAnimations: (enable: boolean) => void;
  setEnableTabularNumbers: (enable: boolean) => void;
  setChartRenderEngine: (engine: 'canvas' | 'svg') => void;

  currentRoute: 'landing' | 'workspace';
  workspaceView: WorkspaceView;
  selectedStockSymbol: string;
  marketColorMode: MarketColorMode;
  isCmdKOpen: boolean;
  isAskAIOpen: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  selectedBacktestId: string;
  paperAccount: PaperAccount | null;
  isTransitioningToWorkspace: boolean;
  userCenterSubTab: 'overview' | 'api-keys' | 'research' | 'factors' | 'preferences' | 'profile' | 'security';
  currentUser: UserProfile;
  isAuthenticated: boolean;
  setCurrentRoute: (route: 'landing' | 'workspace') => void;
  setWorkspaceView: (view: WorkspaceView) => void;
  setSelectedStockSymbol: (symbol: string) => void;
  setMarketColorMode: (mode: MarketColorMode) => void;
  setIsCmdKOpen: (open: boolean) => void;
  setIsAskAIOpen: (open: boolean) => void;
  setIsAuthModalOpen: (open: boolean) => void;
  openAuthModal: (mode?: 'login' | 'register') => void;
  requireAuth: (callback?: () => void) => boolean;
  setSelectedBacktestId: (id: string) => void;
  setUserCenterSubTab: (tab: 'overview' | 'api-keys' | 'research' | 'factors' | 'preferences' | 'profile' | 'security') => void;
  navigateToUserCenter: (tab?: 'overview' | 'api-keys' | 'research' | 'factors' | 'preferences' | 'profile' | 'security') => void;
  toggleMarketColorMode: () => void;
  enterWorkspaceWithTransition: (targetView?: WorkspaceView) => void;
  navigateToStockDetail: (symbol: string) => void;
  addFactorToLibrary: (factor: any) => void;
  refreshPaperAccount: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (payload: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUserAvatar: (avatarUrl: string) => Promise<{ success: boolean; user: UserProfile }>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; user: UserProfile }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => (localStorage.getItem('app_themeMode') as any) || 'light');
  const [contentDensity, setContentDensity] = useState<'standard' | 'compact' | 'spacious'>(() => (localStorage.getItem('app_contentDensity') as any) || 'standard');
  const [sidebarAutoExpand, setSidebarAutoExpand] = useState<boolean>(() => localStorage.getItem('app_sidebarAutoExpand') !== 'false');
  const [enableAnimations, setEnableAnimations] = useState<boolean>(() => localStorage.getItem('app_enableAnimations') !== 'false');
  const [enableTabularNumbers, setEnableTabularNumbers] = useState<boolean>(() => localStorage.getItem('app_enableTabularNumbers') !== 'false');
  const [chartRenderEngine, setChartRenderEngine] = useState<'canvas' | 'svg'>(() => (localStorage.getItem('app_chartRenderEngine') as any) || 'canvas');
  const [marketColorMode, setMarketColorMode] = useState<MarketColorMode>(() => (localStorage.getItem('app_marketColorMode') as any) || 'CN');

  const [language, setLanguage] = useState<string>(() => localStorage.getItem('app_language') || 'zh-CN');
  const [timeZone, setTimeZone] = useState<string>(() => localStorage.getItem('app_timeZone') || 'UTC+08:00');
  const [dateFormat, setDateFormat] = useState<string>(() => localStorage.getItem('app_dateFormat') || 'YYYY-MM-DD');
  const [timeFormat, setTimeFormat] = useState<string>(() => localStorage.getItem('app_timeFormat') || '24h');
  const [numberFormat, setNumberFormat] = useState<string>(() => localStorage.getItem('app_numberFormat') || 'standard');
  const [weekStartDay, setWeekStartDay] = useState<'monday' | 'sunday'>(() => (localStorage.getItem('app_weekStartDay') as any) || 'monday');

  // Sync settings to localStorage and DOM
  useEffect(() => {
    localStorage.setItem('app_marketColorMode', marketColorMode);
    localStorage.setItem('app_themeMode', themeMode);
    localStorage.setItem('app_contentDensity', contentDensity);
    localStorage.setItem('app_sidebarAutoExpand', sidebarAutoExpand.toString());
    localStorage.setItem('app_enableAnimations', enableAnimations.toString());
    localStorage.setItem('app_enableTabularNumbers', enableTabularNumbers.toString());
    localStorage.setItem('app_chartRenderEngine', chartRenderEngine);
    localStorage.setItem('app_language', language);
    localStorage.setItem('app_timeZone', timeZone);
    localStorage.setItem('app_dateFormat', dateFormat);
    localStorage.setItem('app_timeFormat', timeFormat);
    localStorage.setItem('app_numberFormat', numberFormat);
    localStorage.setItem('app_weekStartDay', weekStartDay);

    const root = document.documentElement;
    // Theme Mode
    root.classList.remove('dark');
    if (themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    }
    // Content Density
    root.classList.remove('density-compact', 'density-spacious');
    if (contentDensity !== 'standard') root.classList.add(`density-${contentDensity}`);
    // Animations
    if (!enableAnimations) {
      root.classList.add('disable-animations');
    } else {
      root.classList.remove('disable-animations');
    }
    // Tabular Numbers
    if (enableTabularNumbers) {
      root.classList.add('font-tabular');
    } else {
      root.classList.remove('font-tabular');
    }
  }, [themeMode, contentDensity, sidebarAutoExpand, enableAnimations, enableTabularNumbers, chartRenderEngine, marketColorMode]);

  const [currentRoute, setCurrentRoute] = useState<'landing' | 'workspace'>('landing');
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('overview');
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string>('600519.SH');
  const [isCmdKOpen, setIsCmdKOpen] = useState<boolean>(false);
  const [isAskAIOpen, setIsAskAIOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [selectedBacktestId, setSelectedBacktestId] = useState<string>('bt_mom_60_v1');
  const [paperAccount, setPaperAccount] = useState<PaperAccount | null>(null);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => UserService.getProfile());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => UserService.isAuthenticated());

  useEffect(() => {
    if (isAuthenticated) {
      PortfolioService.getPaperAccount().then(setPaperAccount).catch(console.error);
    } else {
      setPaperAccount(null);
    }
  }, [isAuthenticated]);
  const [isTransitioningToWorkspace, setIsTransitioningToWorkspace] = useState<boolean>(false);
  const [userCenterSubTab, setUserCenterSubTab] = useState<'overview' | 'api-keys' | 'research' | 'factors' | 'preferences' | 'profile' | 'security'>('overview');

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

  // Check auth session on boot & sync latest cloud profile
  useEffect(() => {
    const session = UserService.getCurrentSession();
    if (session) {
      setIsAuthenticated(true);
      setCurrentUser(UserService.getProfile());
      UserService.fetchRemoteProfile().then((cloudProfile) => {
        if (cloudProfile) {
          setCurrentUser(cloudProfile);
        }
      });
    }
  }, []);

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const pendingAuthCallbackRef = React.useRef<(() => void) | null>(null);

  /**
   * Action guard: returns true if already authenticated.
   * If not authenticated, registers the callback to execute after login, opens login modal, and returns false.
   */
  const requireAuth = (callback?: () => void): boolean => {
    if (isAuthenticated) {
      return true;
    }
    pendingAuthCallbackRef.current = callback || null;
    openAuthModal('login');
    return false;
  };

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const res = await UserService.loginWithD1(username, password);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setIsAuthenticated(true);
      setIsAuthModalOpen(false);
      if (pendingAuthCallbackRef.current) {
        const cb = pendingAuthCallbackRef.current;
        pendingAuthCallbackRef.current = null;
        try {
          cb();
        } catch (e) {
          console.warn('Error executing pending auth callback after login:', e);
        }
      }
      return { success: true };
    }
    return { success: false, error: formatErrorMessage(res.error, '登录失败') };
  };

  const register = async (payload: any): Promise<{ success: boolean; error?: string }> => {
    const res = await UserService.registerWithD1(payload);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setIsAuthenticated(true);
      setIsAuthModalOpen(false);
      if (pendingAuthCallbackRef.current) {
        const cb = pendingAuthCallbackRef.current;
        pendingAuthCallbackRef.current = null;
        try {
          cb();
        } catch (e) {
          console.warn('Error executing pending auth callback after registration:', e);
        }
      }
      return { success: true };
    }
    return { success: false, error: formatErrorMessage(res.error, '注册失败') };
  };

  const logout = async () => {
    await UserService.logout();
    setIsAuthenticated(false);
    setCurrentUser(UserService.getProfile());
    // Keep user on the current page/view when logging out instead of forcing route back to landing
    setIsAuthModalOpen(false);
    setIsCmdKOpen(false);
    setIsAskAIOpen(false);
  };

  const updateUserAvatar = async (avatarUrl: string): Promise<{ success: boolean; user: UserProfile }> => {
    const res = await UserService.updateAvatarCloud(avatarUrl);
    setCurrentUser(res.user);
    return res;
  };

  const updateUserProfile = async (updates: Partial<UserProfile>): Promise<{ success: boolean; user: UserProfile }> => {
    const res = await UserService.updateProfileCloud(updates);
    setCurrentUser(res.user);
    return res;
  };

  const toggleMarketColorMode = () => {
    setMarketColorMode((prev) => (prev === 'CN' ? 'US' : 'CN'));
  };

  const navigateToUserCenter = (tab: 'overview' | 'api-keys' | 'research' | 'factors' | 'preferences' | 'profile' | 'security' = 'overview') => {
    setUserCenterSubTab(tab);
    setWorkspaceView('user-center');
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

  const addFactorToLibrary = (_factor: any) => {
    // Factor added to library state
  };

  const refreshPaperAccount = async () => {
    if (isAuthenticated) {
      try {
        const account = await PortfolioService.getPaperAccount();
        setPaperAccount(account);
      } catch (e) {
        console.error(e);
      }
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
        isAuthModalOpen,
        authModalMode,
        selectedBacktestId,
        paperAccount,
        isTransitioningToWorkspace,
        userCenterSubTab,
        currentUser,
        isAuthenticated,
        themeMode,
        contentDensity,
        sidebarAutoExpand,
        enableAnimations,
        enableTabularNumbers,
        chartRenderEngine,
        language,
        timeZone,
        dateFormat,
        timeFormat,
        numberFormat,
        weekStartDay,
        setThemeMode,
        setContentDensity,
        setSidebarAutoExpand,
        setEnableAnimations,
        setEnableTabularNumbers,
        setChartRenderEngine,
        setLanguage,
        setTimeZone,
        setDateFormat,
        setTimeFormat,
        setNumberFormat,
        setWeekStartDay,
        setUserCenterSubTab,
        navigateToUserCenter,
        setCurrentRoute,
        setWorkspaceView,
        setSelectedStockSymbol,
        setMarketColorMode,
        setIsCmdKOpen,
        setIsAskAIOpen,
        setIsAuthModalOpen,
        openAuthModal,
        requireAuth,
        setSelectedBacktestId,
        toggleMarketColorMode,
        enterWorkspaceWithTransition,
        navigateToStockDetail,
        addFactorToLibrary,
        refreshPaperAccount,
        login,
        register,
        logout,
        updateUserAvatar,
        updateUserProfile,
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

