import { DataSourceStatus } from '../types';

export const mockDataSources: DataSourceStatus[] = [
  {
    id: 'ds_tushare',
    name: 'Tushare Pro 数据源',
    status: 'online',
    type: 'A股日线',
    lastSync: '2026-08-14 16:32:12',
    itemCount: '5,382只股票 / 12,840,920条',
  },
  {
    id: 'ds_qmt',
    name: '迅投 QMT 行情网关',
    status: 'offline',
    type: 'QMT',
    lastSync: '尚未连接',
    itemCount: '0条实时心跳',
  },
  {
    id: 'ds_us_market',
    name: '美股行情 API (Polygon / Alpaca)',
    status: 'online',
    type: '美股日线',
    lastSync: '2026-08-14 06:30:00',
    itemCount: '3,210只美股 / 8,920,100条',
  },
  {
    id: 'ds_sec_edgar',
    name: 'SEC EDGAR 财报数据库',
    status: 'online',
    type: '复权因子',
    lastSync: '2026-08-13 22:15:00',
    itemCount: '48,200份 PDF / 结构化 XML',
  },
];

export const mockDataQualityStats = {
  overallScore: 98.7,
  completeness: 99.94,
  anomalyRecords: 7,
  missingRecords: 142,
  duplicateRecords: 0,
  lastAudit: '今天 16:45:10',
};

export const mockUploadedDataset = {
  filename: 'user_custom_factor_2026.csv',
  rowCount: 705893,
  symbolCount: 300,
  dateRange: '2014-01-02 → 2026-03-24',
  fieldMappings: [
    { sourceField: 'stock_code', mappedField: 'Symbol', status: 'mapped' },
    { sourceField: 'trade_date', mappedField: 'Date', status: 'mapped' },
    { sourceField: 'open_px', mappedField: 'Open', status: 'mapped' },
    { sourceField: 'high_px', mappedField: 'High', status: 'mapped' },
    { sourceField: 'low_px', mappedField: 'Low', status: 'mapped' },
    { sourceField: 'close_px', mappedField: 'Close', status: 'mapped' },
    { sourceField: 'vol_num', mappedField: 'Volume', status: 'mapped' },
    { sourceField: 'my_alpha_val', mappedField: 'CustomFactor1', status: 'mapped' },
  ],
};
