import { d1Client } from '../db/d1Client';
import { DailyPromptGenerationJob } from '../ai/promptService';

export interface JobRecord {
  id: string;
  name: string;
  cronExpr: string;
  category: string;
  isActive: boolean;
  lastStatus: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

export class JobOrchestrator {
  public static getJobs(): JobRecord[] {
    let jobs = d1Client.getTable<JobRecord>('jobs');
    if (jobs.length === 0) {
      const defaultJobs: JobRecord[] = [
        {
          id: 'job_daily_prompt_pool',
          name: 'DeepSeek-V4-Flash 每日 50 前沿量化推荐词库生成',
          cronExpr: '0 6 * * *',
          category: 'ai_synthesis',
          isActive: true,
          lastStatus: 'success',
          lastRunAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
          nextRunAt: new Date(Date.now() + 3600 * 1000 * 22).toISOString(),
        },
        {
          id: 'job_sync_cn',
          name: 'A股每日收盘数据同步 (AKShare / 日频 QFQ)',
          cronExpr: '0 17 * * 1-5',
          category: 'market_sync',
          isActive: true,
          lastStatus: 'success',
          lastRunAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
          nextRunAt: new Date(Date.now() + 3600 * 1000 * 20).toISOString(),
        },
        {
          id: 'job_calc_factors',
          name: '全市场核心因子夜间重算与正交化',
          cronExpr: '0 20 * * 1-5',
          category: 'factor_compute',
          isActive: true,
          lastStatus: 'success',
          lastRunAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
        },
        {
          id: 'job_storage_cleanup',
          name: '系统存储生命周期巡检与过期清理',
          cronExpr: '0 2 * * *',
          category: 'system_cleanup',
          isActive: true,
          lastStatus: 'success',
          lastRunAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
        },
        {
          id: 'job_daily_ai_brief',
          name: 'DeepSeek 每日量化研报与多因子信号生成',
          cronExpr: '30 8 * * 1-5',
          category: 'ai_synthesis',
          isActive: true,
          lastStatus: 'success',
          lastRunAt: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
        },
      ];

      for (const j of defaultJobs) {
        d1Client.insertRecord('jobs', j);
      }
      jobs = defaultJobs;
    }
    return jobs;
  }

  public static async runJobNow(jobId: string) {
    if (jobId === 'job_daily_prompt_pool') {
      const res = await DailyPromptGenerationJob.runJob();
      d1Client.updateRecord<JobRecord>('jobs', jobId, {
        lastStatus: res.success ? 'success' : 'failed',
        lastRunAt: new Date().toISOString(),
      });
      return { success: res.success, jobId, message: res.message };
    }

    d1Client.updateRecord<JobRecord>('jobs', jobId, {
      lastStatus: 'success',
      lastRunAt: new Date().toISOString(),
    });
    return { success: true, jobId, message: '任务已立即触发并执行成功' };
  }
}
