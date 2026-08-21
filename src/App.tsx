import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LandingPage } from './components/landing/LandingPage';
import { WorkspaceLayout } from './components/workspace/WorkspaceLayout';
import { AuthModal } from './components/common/AuthModal';
import { AetherLogo } from './components/common/AetherLogo';
import { Loader2 } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { currentRoute, isTransitioningToWorkspace, isAuthModalOpen, setIsAuthModalOpen, authModalMode } = useApp();

  useEffect(() => {
    document.title = 'AetherQuant - AI量化研究平台';
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Loading overlay during transition to workspace */}
      {isTransitioningToWorkspace && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-md z-50 flex flex-col items-center justify-center text-neutral-900 transition-opacity duration-300">
          <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white border border-neutral-200/80 shadow-2xl max-w-sm text-center">
            <AetherLogo size="lg" showText={true} />
            <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium mt-1">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>正在初始化量化引擎与行情数据...</span>
            </div>
          </div>
        </div>
      )}

      {/* D1 Database Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {currentRoute === 'landing' ? <LandingPage /> : <WorkspaceLayout />}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
