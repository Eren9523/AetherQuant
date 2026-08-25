import React, { createContext, useContext, useState, useEffect } from 'react';
import { MarketColorMode, WorkspaceView, PaperAccount, UserProfile } from '../types';
import { mockPaperAccount } from '../mocks/mockPortfolio';
import { UserService } from '../services/userService';
import { formatErrorMessage } from '../utils/formatters';

interface AppContextType {
  currentRoute: 'landing' | 'workspace';
  workspaceView: WorkspaceView;
  selectedStockSymbol: string;
  marketColorMode: MarketColorMode;
  isCmdKOpen: boolean;
  isAskAIOpen: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  selectedBacktestId: string;
  paperAccount: PaperAccount;
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
  buyStock: (symbol: string, quantity: number, price: number) => boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (payload: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUserAvatar: (avatarUrl: string) => Promise<{ success: boolean; user: UserProfile }>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; user: UserProfile }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<'landing' | 'workspace'>('landing');
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('overview');
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string>('600519.SH');
  const [marketColorMode, setMarketColorMode] = useState<MarketColorMode>('CN');
  const [isCmdKOpen, setIsCmdKOpen] = useState<boolean>(false);
  const [isAskAIOpen, setIsAskAIOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [selectedBacktestId, setSelectedBacktestId] = useState<string>('bt_mom_60_v1');
  const [paperAccount] = useState<PaperAccount>(mockPaperAccount);
  const [isTransitioningToWorkspace, setIsTransitioningToWorkspace] = useState<boolean>(false);
  const [userCenterSubTab, setUserCenterSubTab] = useState<'overview' | 'api-keys' | 'research' | 'factors' | 'preferences' | 'profile' | 'security'>('overview');

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => UserService.getProfile());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => UserService.isAuthenticated());

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

  const buyStock = (symbol: string, quantity: number, price: number): boolean => {
    const cost = quantity * price;
    if (paperAccount.cash >= cost) {
      paperAccount.cash -= cost;
      paperAccount.stockValue += cost;
      paperAccount.totalAssets = paperAccount.cash + paperAccount.stockValue;
      return true;
    }
    return false;
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
        buyStock,
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

