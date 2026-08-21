import React from 'react';
import { AETHER_LOGO_BASE64 } from '../../assets/logoBase64';

interface AetherLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  imgClassName?: string;
  textClassName?: string;
  variant?: 'light' | 'white';
}

const sizeConfig = {
  xs: { box: 'w-6 h-6 rounded-lg p-0.5', text: 'text-sm' },
  sm: { box: 'w-8 h-8 rounded-lg p-0.5', text: 'text-sm' },
  md: { box: 'w-9 h-9 rounded-xl p-0.5', text: 'text-base' },
  lg: { box: 'w-11 h-11 rounded-xl p-1', text: 'text-lg' },
  xl: { box: 'w-16 h-16 rounded-2xl p-1.5', text: 'text-xl' },
};

export const AetherLogo: React.FC<AetherLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  imgClassName = '',
  textClassName = '',
  variant = 'white',
}) => {
  const config = sizeConfig[size] || sizeConfig.md;
  const bgStyle = variant === 'white' 
    ? 'bg-white border border-neutral-200/90 shadow-2xs' 
    : 'bg-neutral-50 border border-neutral-200/80 shadow-2xs';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div
        className={`${config.box} ${bgStyle} flex items-center justify-center overflow-hidden flex-shrink-0 transition-all`}
      >
        <img
          src={AETHER_LOGO_BASE64}
          alt="AetherQuant"
          className={`w-full h-full object-contain ${imgClassName}`}
          loading="eager"
          decoding="sync"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            if (target.src !== '/logo.png') {
              target.src = '/logo.png';
            }
          }}
        />
      </div>
      {showText && (
        <span
          className={`font-bold tracking-tight text-neutral-900 font-sans leading-none ${config.text} ${textClassName}`}
        >
          Aether<span className="font-light text-neutral-500">Quant</span>
        </span>
      )}
    </div>
  );
};
