/**
 * Penguin Quant Runtime Configuration & Mode Manager
 * Modes:
 * - 'real': Strict Production mode. API failures throw real errors. No silent mock fallbacks.
 * - 'demo': Sandbox / Prototype mode with explicit UI 'Demo / 演示数据' badges.
 */

export type AppRuntimeMode = 'real' | 'demo';

const getEnvMode = (): string => {
  const metaEnv = (import.meta as any)?.env?.VITE_APP_MODE;
  if (metaEnv) return metaEnv;

  if (typeof process !== 'undefined' && process?.env?.VITE_APP_MODE) {
    return process.env.VITE_APP_MODE;
  }
  return 'real';
};

const runtimeModeEnv = getEnvMode().toLowerCase();

export const RUNTIME_CONFIG = {
  mode: (runtimeModeEnv === 'demo' ? 'demo' : 'real') as AppRuntimeMode,
  isRealMode: runtimeModeEnv !== 'demo',
  isDemoMode: runtimeModeEnv === 'demo',
  version: '1.0.0-p0.1',
  gateway: 'Cloudflare Worker (Hono)',
};
