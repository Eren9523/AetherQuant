import { Hono } from 'hono';
import { Bindings, Variables } from '../index';

export function createStrategyRouter() {
  const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  const validateStrategyDsl = async (dsl: any, db: any) => {
    const errors: string[] = [];
    if (!dsl.universe || !dsl.universe.type || !dsl.universe.value) {
      errors.push("Missing or invalid universe");
    }
    if (!dsl.signals || !Array.isArray(dsl.signals) || dsl.signals.length === 0) {
      errors.push("Missing or invalid signals array");
    } else {
      let weightSum = 0;
      for (const sig of dsl.signals) {
        if (!sig.factor) errors.push("Signal missing factor code");
        if (typeof sig.weight !== 'number') errors.push(`Signal ${sig.factor} missing valid weight`);
        weightSum += sig.weight;
      }
      if (Math.abs(weightSum - 1.0) > 0.001) {
        errors.push(`Factor weights must sum to 1.0, but got ${weightSum}`);
      }
      
      // Verify factors exist
      const factorCodes = dsl.signals.map((s: any) => s.factor).filter(Boolean);
      if (factorCodes.length > 0) {
        const placeholders = factorCodes.map(() => '?').join(',');
        const res = await db.prepare(`SELECT code FROM factor_definitions WHERE code IN (${placeholders}) AND status = 'active'`).bind(...factorCodes).all();
        const foundCodes = res.results.map((r: any) => r.code);
        for (const code of factorCodes) {
          if (!foundCodes.includes(code)) {
            errors.push(`Factor ${code} not found or inactive`);
          }
        }
      }
    }
    
    if (!dsl.selection || !dsl.selection.method || !dsl.selection.n) {
      errors.push("Missing or invalid selection rules");
    }
    if (!dsl.rebalance || !dsl.rebalance.frequency) {
      errors.push("Missing or invalid rebalance frequency");
    }
    if (!dsl.portfolio || !dsl.portfolio.weighting) {
      errors.push("Missing or invalid portfolio weighting");
    }

    return errors;
  };

  router.post('/validate', async (c) => {
    const body = await c.req.json();
    if (JSON.stringify(body).length > 256000) {
      return c.json({ success: false, error: 'Strategy payload exceeds 256KB limit' }, 400);
    }
    const errors = await validateStrategyDsl(body, c.env.DB);
    if (errors.length > 0) {
      return c.json({ success: false, valid: false, errors }, 400);
    }
    return c.json({ success: true, valid: true });
  });

  router.get('/', async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM strategy_definitions ORDER BY created_at DESC`
    ).all();
    
    const mapped = results.map((r) => ({
      ...r,
      dsl_json: JSON.parse(r.dsl_json as string)
    }));
    return c.json({ success: true, data: mapped });
  });

  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const strat = await c.env.DB.prepare(`SELECT * FROM strategy_definitions WHERE id = ?`).bind(id).first();
    if (!strat) return c.json({ success: false, error: 'NOT_FOUND' }, 404);
    
    const versions = await c.env.DB.prepare(`SELECT * FROM strategy_versions WHERE strategy_id = ? ORDER BY version DESC`).bind(id).all();
    
    return c.json({ 
      success: true, 
      data: {
        ...strat,
        dsl_json: JSON.parse(strat.dsl_json as string),
        versions: versions.results.map(v => ({
           ...v, dsl_json: JSON.parse(v.dsl_json as string)
        }))
      } 
    });
  });

  router.post('/', async (c) => {
    const userId = c.get('authenticatedUserId') || 'guest';
    const body = await c.req.json();
    const dslStr = JSON.stringify(body.dsl);
    
    if (dslStr.length > 256000) return c.json({ success: false, error: 'Payload too large' }, 400);

    const errors = await validateStrategyDsl(body.dsl, c.env.DB);
    if (errors.length > 0) {
      return c.json({ success: false, error: 'Validation failed', details: errors }, 400);
    }

    const id = `strat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const vId = `sv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    await c.env.DB.prepare(`
      INSERT INTO strategy_definitions (id, user_id, name, description, market, universe, dsl_json, version, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, ?)
    `).bind(
      id, userId, body.name, body.description || '', body.market || 'CN', body.dsl.universe.value, dslStr, now, now
    ).run();

    await c.env.DB.prepare(`
      INSERT INTO strategy_versions (id, strategy_id, version, dsl_json, created_at)
      VALUES (?, ?, 1, ?, ?)
    `).bind(vId, id, dslStr, now).run();

    return c.json({ success: true, data: { id, version: 1 } });
  });

  router.put('/:id', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('authenticatedUserId') || 'guest';
    
    // Check ownership
    const strat = await c.env.DB.prepare(`SELECT user_id, version FROM strategy_definitions WHERE id = ?`).bind(id).first();
    if (!strat) return c.json({ success: false, error: 'NOT_FOUND' }, 404);
    if (strat.user_id && strat.user_id !== 'guest' && strat.user_id !== userId) {
      return c.json({ success: false, error: 'UNAUTHORIZED' }, 403);
    }

    const body = await c.req.json();
    const dslStr = JSON.stringify(body.dsl);
    
    if (dslStr.length > 256000) return c.json({ success: false, error: 'Payload too large' }, 400);

    const errors = await validateStrategyDsl(body.dsl, c.env.DB);
    if (errors.length > 0) {
      return c.json({ success: false, error: 'Validation failed', details: errors }, 400);
    }

    const newVersion = (strat.version as number) + 1;
    const vId = `sv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    await c.env.DB.prepare(`
      UPDATE strategy_definitions 
      SET name = ?, description = ?, universe = ?, dsl_json = ?, version = ?, updated_at = ?
      WHERE id = ?
    `).bind(body.name, body.description || '', body.dsl.universe.value, dslStr, newVersion, now, id).run();

    await c.env.DB.prepare(`
      INSERT INTO strategy_versions (id, strategy_id, version, dsl_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(vId, id, newVersion, dslStr, now).run();

    return c.json({ success: true, data: { id, version: newVersion } });
  });

  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('authenticatedUserId') || 'guest';
    
    const strat = await c.env.DB.prepare(`SELECT user_id FROM strategy_definitions WHERE id = ?`).bind(id).first();
    if (!strat) return c.json({ success: false, error: 'NOT_FOUND' }, 404);
    if (strat.user_id && strat.user_id !== 'guest' && strat.user_id !== userId) {
      return c.json({ success: false, error: 'UNAUTHORIZED' }, 403);
    }

    await c.env.DB.prepare(`DELETE FROM strategy_definitions WHERE id = ?`).bind(id).run();
    return c.json({ success: true });
  });

  return router;
}
