import { Hono } from 'hono';
import { Bindings, Variables } from '../index';

export function createBacktestRouter() {
  const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  router.get('/', async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM backtest_runs ORDER BY created_at DESC LIMIT 50`
    ).all();
    return c.json({ success: true, data: results });
  });

  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const run = await c.env.DB.prepare(`SELECT * FROM backtest_runs WHERE id = ?`).bind(id).first();
    if (!run) return c.json({ success: false, error: 'NOT_FOUND' }, 404);
    return c.json({ success: true, data: run });
  });

  router.get('/:id/nav', async (c) => {
    const id = c.req.param('id');
    const run = await c.env.DB.prepare(`SELECT result_r2_key FROM backtest_runs WHERE id = ?`).bind(id).first();
    if (!run || !run.result_r2_key) return c.json({ success: false, error: 'NOT_FOUND' }, 404);
    
    // We expect nav to be read from R2, but here we can just return the key for the client to fetch or we can proxy.
    // Client can fetch via /api/v1/datasets/internal/r2/:key
    return c.json({ success: true, r2_key: `${run.result_r2_key}/nav.parquet` });
  });

  router.post('/run', async (c) => {
    const userId = c.get('authenticatedUserId') || 'guest';
    const body = await c.req.json();
    const { strategy_id, strategy_version, start_date, end_date, initial_capital, commission_rate, slippage_bps } = body;

    if (!strategy_id || !strategy_version) return c.json({ success: false, error: 'Missing strategy info' }, 400);

    const strat = await c.env.DB.prepare(`SELECT dsl_json FROM strategy_versions WHERE strategy_id = ? AND version = ?`).bind(strategy_id, strategy_version).first();
    if (!strat) return c.json({ success: false, error: 'Strategy version not found' }, 404);

    const runId = `bt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    await c.env.DB.prepare(`
      INSERT INTO backtest_runs (
        id, user_id, strategy_id, strategy_version, status, market, start_date, end_date, initial_capital, commission_rate, slippage_bps, created_at, started_at
      ) VALUES (
        ?, ?, ?, ?, 'running', 'CN', ?, ?, ?, ?, ?, ?, ?
      )
    `).bind(
      runId, userId, strategy_id, strategy_version, start_date, end_date, initial_capital || 1000000, commission_rate || 0.0003, slippage_bps || 1.0, now, now
    ).run();

    const dsl = JSON.parse(strat.dsl_json as string);

    // Call python quant worker
    try {
      const pyUrl = 'http://127.0.0.1:8001/api/v1/backtest/run';
      const pyReq = {
        user_id: userId,
        run_id: runId,
        strategy_id,
        strategy_version,
        dsl,
        start_date,
        end_date,
        initial_capital: initial_capital || 1000000,
        commission_rate: commission_rate || 0.0003,
        slippage_bps: slippage_bps || 1.0,
        worker_url: 'http://127.0.0.1:3000'
      };

      c.executionCtx.waitUntil((async () => {
        try {
          const res = await fetch(pyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pyReq)
          });
          
          if (!res.ok) throw new Error(`Python worker error: ${res.status}`);
          const data: any = await res.json();
          
          if (data.success) {
            const sum = data.summary;
            await c.env.DB.prepare(`
              UPDATE backtest_runs SET
                status = 'completed',
                finished_at = ?,
                result_r2_key = ?,
                total_return = ?,
                annualized_return = ?,
                sharpe_ratio = ?,
                max_drawdown = ?,
                calmar_ratio = ?,
                win_rate = ?,
                turnover_rate = ?
              WHERE id = ?
            `).bind(
              new Date().toISOString(), data.result_r2_key, sum.total_return, sum.annualized_return, sum.sharpe_ratio, sum.max_drawdown, sum.calmar_ratio, sum.win_rate, sum.turnover_rate, runId
            ).run();
          } else {
            throw new Error(data.error || 'Unknown error');
          }
        } catch (e: any) {
          await c.env.DB.prepare(`
            UPDATE backtest_runs SET status = 'failed', finished_at = ?, error_message = ? WHERE id = ?
          `).bind(new Date().toISOString(), e.message, runId).run();
        }
      })());
      
      return c.json({ success: true, run_id: runId, status: 'running' });
    } catch (e: any) {
      await c.env.DB.prepare(`
        UPDATE backtest_runs SET status = 'failed', finished_at = ?, error_message = ? WHERE id = ?
      `).bind(now, e.message, runId).run();
      return c.json({ success: false, error: e.message }, 500);
    }
  });

  return router;
}
