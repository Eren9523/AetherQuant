import { AutomationTask } from '../types';

export const mockAutomationTasks: AutomationTask[] = [
  {
    id: 'task_sync_cn',
    name: 'A股日线与复权数据同步',
    schedule: '每天 16:30 (盘后自动)',
    status: 'success',
    duration: '12.4s',
    lastRun: '2026-08-14 16:30:00',
    nextRun: '2026-08-15 16:30:00',
    logs: [
      '16:30:00 [INFO] 建立 Tushare Pro REST 数据连接',
      '16:30:02 [INFO] 校验交易日历：2026-08-14 为有效交易日',
      '16:30:04 [INFO] 开始增量拉取 5,382 只股票日线 K 线',
      '16:30:09 [INFO] 数据质量校验完成：0 缺失，0 重复',
      '16:30:12 [SUCCESS] 盘后日线同步成功，已写入数据库缓存',
    ],
  },
  {
    id: 'task_calc_factors',
    name: '全市场 60+ 因子截面重计算',
    schedule: '每天 16:40',
    status: 'success',
    duration: '38.2s',
    lastRun: '2026-08-14 16:40:00',
    nextRun: '2026-08-15 16:40:00',
    logs: [
      '16:40:00 [INFO] 启动 Factor Engine 多进程并行处理',
      '16:40:10 [INFO] 动量类因子计算完毕 (MOM_20D, MOM_60D)',
      '16:40:25 [INFO] 财务类因子匹配完毕 (ROE_TTM, EP_TTM)',
      '16:40:35 [INFO] 进行 MAD 截面去极值与 Z-Score 标准化',
      '16:40:38 [SUCCESS] 全市场因子得分矩阵更新完成',
    ],
  },
  {
    id: 'task_ai_report',
    name: 'AI 每日收盘深度总结报告生成',
    schedule: '每天 17:00',
    status: 'idle',
    duration: '等待中',
    lastRun: '2026-08-13 17:00:00',
    nextRun: '2026-08-14 17:00:00',
    logs: [
      '17:00:00 [PENDING] 等待因子计算任务信号触发',
    ],
  },
  {
    id: 'task_us_sync',
    name: '美股行情与 SEC 财报数据同步',
    schedule: '每天 06:30 (美东盘后)',
    status: 'success',
    duration: '22.8s',
    lastRun: '2026-08-14 06:30:00',
    nextRun: '2026-08-15 06:30:00',
    logs: [
      '06:30:00 [INFO] 连接 Polygon API 美股网关',
      '06:30:12 [INFO] 同步 S&P 500 与 Nasdaq 100 标的行情',
      '06:30:22 [SUCCESS] 美股收盘数据拉取并同步成功',
    ],
  },
];
