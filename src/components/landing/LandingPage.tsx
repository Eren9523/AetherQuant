import React from 'react';
import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { NoiseToStructureSection } from './NoiseToStructureSection';
import { InteractiveTerminalDemo } from './InteractiveTerminalDemo';
import { AIResearchShowcase } from './AIResearchShowcase';
import { DataPipelineShowcase } from './DataPipelineShowcase';
import { FactorShowcase } from './FactorShowcase';
import { BacktestShowcase } from './BacktestShowcase';
import { MLLabShowcase } from './MLLabShowcase';
import { ExecutionRiskShowcase } from './ExecutionRiskShowcase';
import { LandingFooter } from './LandingFooter';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#fbfbfd] text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white">
      <LandingHeader />
      <main>
        <HeroSection />
        <NoiseToStructureSection />
        <InteractiveTerminalDemo />
        <AIResearchShowcase />
        <DataPipelineShowcase />
        <FactorShowcase />
        <BacktestShowcase />
        <MLLabShowcase />
        <ExecutionRiskShowcase />
      </main>
      <LandingFooter />
    </div>
  );
};
