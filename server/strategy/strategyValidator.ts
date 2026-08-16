import { z } from 'zod';

export const StrategyFactorSchema = z.object({
  id: z.string().min(1),
  weight: z.number().min(-10).max(10),
  direction: z.enum(['positive', 'negative']).optional().default('positive'),
});

export const StrategyDSLSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  market: z.enum(['CN', 'US']).default('CN'),
  universe: z.object({
    type: z.enum(['index', 'custom', 'all', 'dataset']),
    symbol: z.string().default('CSI300'),
    customSymbols: z.array(z.string()).optional(),
  }),
  factors: z.array(StrategyFactorSchema).min(1),
  topN: z.number().int().min(1).max(100).default(10),
  rebalance: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  weighting: z.enum(['equal', 'market_cap', 'score_weighted', 'risk_parity']).default('equal'),
  riskConstraints: z
    .object({
      maxSingleWeight: z.number().min(0.01).max(1.0).default(0.1),
      maxSectorExposure: z.number().min(0.05).max(1.0).default(0.3),
      stopLossPercent: z.number().min(0.01).max(0.5).optional(),
    })
    .optional(),
});

export type StrategyDSL = z.infer<typeof StrategyDSLSchema>;

export class StrategyValidator {
  public static validate(dsl: unknown): { success: boolean; data?: StrategyDSL; error?: string } {
    const result = StrategyDSLSchema.safeParse(dsl);
    if (!result.success) {
      const errorMsg = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: `Strategy DSL validation failed: ${errorMsg}` };
    }
    return { success: true, data: result.data };
  }
}
