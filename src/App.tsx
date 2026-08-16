import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LandingPage } from './components/landing/LandingPage';
import { WorkspaceLayout } from './components/workspace/WorkspaceLayout';
import { Loader2 } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { currentRoute, isTransitioningToWorkspace } = useApp();

  return (
    <div className="relative min-h-screen">
      {/* Loading overlay during transition to workspace */}
      {isTransitioningToWorkspace && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white transition-opacity duration-300">
          <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <div className="text-center">
              <p className="text-sm font-semibold tracking-wider text-neutral-200 uppercase">
                Loading Quant Terminal
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Initializing market feeds, factor engines & risk models...
              </p>
            </div>
          </div>
        </div>
      )}

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
