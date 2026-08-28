import { Hono } from 'hono';
import { Bindings, Variables } from '../index';

export function createFactorRouter() {
  const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  // 1. List Factors (Library)
  router.get('/', async (c) => {
    const userId = c.get('authenticatedUserId') || 'guest';
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM factor_definitions ORDER BY created_at DESC`
    ).all();

    // Attach latest run summary if available
    const factors = [];
    for (const row of results) {
       const latestRun = await c.env.DB.prepare(
         `SELECT * FROM factor_runs WHERE factor_id = ? ORDER BY started_at DESC LIMIT 1`
       ).bind(row.id).first();
       
       factors.push({
         ...row,
         latest_run: latestRun ? {
            ...latestRun,
            summary: latestRun.summary_json ? JSON.parse(latestRun.summary_json as string) : null
         } : null
       });
    }

    return c.json({ success: true, data: factors });
  });

  // 2. Create Factor
  router.post('/', async (c) => {
    const userId = c.get('authenticatedUserId') || 'guest';
    const body = await c.req.json();
    const id = `fct_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    await c.env.DB.prepare(`
      INSERT INTO factor_definitions (id, user_id, code, name, category, description, formula, version, source_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'active', ?, ?)
    `).bind(
      id, userId, body.code || id, body.name, body.category || 'custom', 
      body.description || '', body.formula, body.source_type || 'dsl', now, now
    ).run();

    return c.json({ success: true, data: { id } });
  });

  // 3. Update Factor
  router.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const now = new Date().toISOString();

    await c.env.DB.prepare(`
      UPDATE factor_definitions SET
        name = ?, category = ?, description = ?, formula = ?, version = version + 1, updated_at = ?
      WHERE id = ?
    `).bind(body.name, body.category, body.description, body.formula, now, id).run();

    return c.json({ success: true });
  });

  // 4. Get specific factor
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const factor = await c.env.DB.prepare(`SELECT * FROM factor_definitions WHERE id = ?`).bind(id).first();
    if (!factor) return c.json({ success: false, error: { code: 'NOT_FOUND' } }, 404);

    const runs = await c.env.DB.prepare(`SELECT * FROM factor_runs WHERE factor_id = ? ORDER BY started_at DESC`).bind(id).all();

    return c.json({
      success: true,
      data: {
        ...factor,
        runs: runs.results.map(r => ({
           ...r,
           summary: r.summary_json ? JSON.parse(r.summary_json as string) : null
        }))
      }
    });
  });

  // 5. Run Factor (Call Quant Service)
  router.post('/:id/run', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('authenticatedUserId') || 'guest';
    const body = await c.req.json();
    
    const factor = await c.env.DB.prepare(`SELECT * FROM factor_definitions WHERE id = ?`).bind(id).first();
    if (!factor) return c.json({ success: false, error: 'NOT_FOUND' }, 404);

    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    // Create run record
    await c.env.DB.prepare(`
      INSERT INTO factor_runs (id, factor_id, user_id, universe, start_date, end_date, forward_period, status, provider, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'running', 'quant_service', ?)
    `).bind(runId, id, userId, body.universe || 'HS300', body.start_date || '2023-01-01', body.end_date || '2024-01-01', body.forward_period || 1, now).run();

    const quantUrl = c.env.QUANT_SERVICE_URL;
    const origin = c.env.APP_ORIGIN || c.req.url.split('/api')[0];

    try {
      const resp = await fetch(`${quantUrl}/factors/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factor_id: id,
          run_id: runId,
          formula: factor.formula,
          dataset_id: body.dataset_id || null,
          start_date: body.start_date || '2023-01-01',
          end_date: body.end_date || '2024-01-01',
          forward_period: body.forward_period || 1,
          worker_url: origin,
          worker_token: c.env.QUANT_SERVICE_TOKEN
        })
      });

      const resJson = await resp.json() as any;

      if (resJson.success) {
        await c.env.DB.prepare(`
          UPDATE factor_runs SET status = 'success', result_r2_key = ?, summary_json = ?, finished_at = ?
          WHERE id = ?
        `).bind(resJson.result_r2_key, JSON.stringify(resJson.summary), new Date().toISOString(), runId).run();
        
        return c.json({ success: true, data: { run_id: runId, summary: resJson.summary } });
      } else {
        await c.env.DB.prepare(`
          UPDATE factor_runs SET status = 'failed', error_message = ?, finished_at = ?
          WHERE id = ?
        `).bind(resJson.error || 'Unknown Error', new Date().toISOString(), runId).run();
        
        return c.json({ success: false, error: resJson.error }, 500);
      }
    } catch (e: any) {
      await c.env.DB.prepare(`
        UPDATE factor_runs SET status = 'failed', error_message = ?, finished_at = ?
        WHERE id = ?
      `).bind(e.message, new Date().toISOString(), runId).run();
      
      return c.json({ success: false, error: e.message }, 500);
    }
  });

  // 6. Get Factor Run Results (IC series etc)
  router.get('/:id/runs/:runId/results', async (c) => {
    const { id, runId } = c.req.param();
    const run = await c.env.DB.prepare(`SELECT * FROM factor_runs WHERE id = ? AND factor_id = ?`).bind(runId, id).first();
    
    if (!run || !run.result_r2_key) {
      return c.json({ success: false, error: 'Run results not found' }, 404);
    }

    // Read IC Series from R2
    const object = await c.env.DATA_BUCKET.get(`${run.result_r2_key}/ic_series.json`);
    if (!object) {
      return c.json({ success: false, error: 'IC series not found in R2' }, 404);
    }

    const icSeriesDict = await object.json();
    // Convert to array format for Recharts [{date: 'xxx', ic: 0.05}]
    const icSeries = Object.entries(icSeriesDict).map(([date, ic]) => ({
      date,
      ic
    }));

    return c.json({
      success: true,
      data: {
        ic_series: icSeries,
        summary: run.summary_json ? JSON.parse(run.summary_json as string) : null
      }
    });
  });

  return router;
}
