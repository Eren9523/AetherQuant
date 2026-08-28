import { FactorItem } from '../types';

export const mockFactors: FactorItem[] = [
  { id: 'fct_1', code: 'MOM_20D', name: '20日动量', category: '动量', ic: 0.082, rankIc: 0.096, coverage: 99.8, description: '20个交易日累计收益率', updatedAt: '2023-10-01T10:00:00Z', score: 92 },
  { id: 'fct_2', code: 'VOL_20D', name: '20日波动率', category: '低波动', ic: -0.065, rankIc: -0.071, coverage: 99.5, description: '20日收益率标准差', updatedAt: '2023-10-01T10:05:00Z', score: 85 }
];

export const mockFactorGroupReturns = [];
