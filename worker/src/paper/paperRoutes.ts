import { Hono } from 'hono';
import { Bindings, Variables } from '../index';

export function createPaperRouter() {
  const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  // 1. Get Paper Account & Portfolio
  router.get('/account', async (c) => {
    const userId = c.get('authenticatedUserId') || 'guest';
    
    // Check if account exists
    let account = await c.env.DB.prepare(`SELECT * FROM paper_accounts WHERE user_id = ?`).bind(userId).first();
    if (!account) {
      const accountId = `pa_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();
      await c.env.DB.prepare(`
        INSERT INTO paper_accounts (id, user_id, base_currency, initial_cash, cash_balance, frozen_cash, created_at, updated_at)
        VALUES (?, ?, 'CNY', 1000000.0, 1000000.0, 0.0, ?, ?)
      `).bind(accountId, userId, now, now).run();
      account = await c.env.DB.prepare(`SELECT * FROM paper_accounts WHERE user_id = ?`).bind(userId).first();
    }

    if (!account) {
      return c.json({ success: false, error: 'Could not create paper account' }, 500);
    }

    // Fetch positions
    const { results: positions } = await c.env.DB.prepare(`
      SELECT * FROM paper_positions WHERE account_id = ? AND quantity > 0
    `).bind(account.id).all();

    let totalMarketValue = 0;
    let dailyPnl = 0; // Simplified daily PnL without previous day snapshot
    let totalUnrealizedPnl = 0;

    const enrichedPositions = [];

    if (positions.length > 0) {
      const symbols = positions.map(p => p.symbol as string);
      const placeholders = symbols.map(() => '?').join(',');
      
      const { results: snapshots } = await c.env.DB.prepare(`
        SELECT symbol, last as current_price, name, change_pct as price_change_pct 
        FROM market_quotes_snapshot 
        WHERE symbol IN (${placeholders})
        AND snapshot_id = (SELECT active_snapshot_id FROM market_snapshot_pointer WHERE market = 'CN' LIMIT 1)
      `).bind(...symbols).all();

      const snapshotMap = new Map(snapshots.map(s => [s.symbol, s]));

      for (const p of positions) {
        const snap = snapshotMap.get(p.symbol as string);
        const currentPrice = snap ? (snap.current_price as number) : (p.avg_cost as number);
        const name = snap ? snap.name : p.symbol;
        
        const marketValue = (p.quantity as number) * currentPrice;
        const unrealizedPnl = marketValue - ((p.quantity as number) * (p.avg_cost as number));
        const unrealizedPnlPercent = ((currentPrice - (p.avg_cost as number)) / (p.avg_cost as number)) * 100;
        
        totalMarketValue += marketValue;
        totalUnrealizedPnl += unrealizedPnl;
        
        if (snap) {
            dailyPnl += marketValue * ((snap.price_change_pct as number)/100 || 0);
        }

        enrichedPositions.push({
          symbol: p.symbol,
          name: name,
          quantity: p.quantity,
          available_quantity: p.available_quantity,
          avgCost: p.avg_cost,
          currentPrice: currentPrice,
          marketValue: marketValue,
          unrealizedPnl: unrealizedPnl,
          unrealizedPnlPercent: unrealizedPnlPercent,
          realizedPnl: p.realized_pnl
        });
      }
    }

    const totalEquity = (account.cash_balance as number) + totalMarketValue;
    const totalPnlPercent = ((totalEquity - (account.initial_cash as number)) / (account.initial_cash as number)) * 100;

    return c.json({
      success: true,
      data: {
        account: {
          id: account.id,
          initialCash: account.initial_cash,
          cashBalance: account.cash_balance,
          frozenCash: account.frozen_cash,
          totalEquity: totalEquity,
          marketValue: totalMarketValue,
          dailyPnl: dailyPnl,
          totalPnlPercent: totalPnlPercent
        },
        positions: enrichedPositions
      }
    });
  });

  // 2. Submit Order
  router.post('/orders', async (c) => {
    const userId = c.get('authenticatedUserId') || 'guest';
    const body = await c.req.json();
    const { client_order_id, symbol, side, order_type, quantity, limit_price } = body;

    if (!client_order_id || !symbol || !side || !order_type || !quantity || quantity <= 0 || quantity % 100 !== 0) {
      return c.json({ success: false, error: 'Invalid order parameters (must be lot of 100)' }, 400);
    }

    const account = await c.env.DB.prepare(`SELECT * FROM paper_accounts WHERE user_id = ?`).bind(userId).first();
    if (!account) return c.json({ success: false, error: 'Paper account not found' }, 404);

    // Idempotency check
    const existingOrder = await c.env.DB.prepare(`SELECT * FROM paper_orders WHERE client_order_id = ?`).bind(client_order_id).first();
    if (existingOrder) {
      return c.json({ success: true, data: { order_id: existingOrder.id, status: existingOrder.status, note: 'Idempotent return' } });
    }

    const orderId = `po_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    // Fetch Market Snapshot
    const snapshot = await c.env.DB.prepare(`
      SELECT last as current_price FROM market_quotes_snapshot 
      WHERE symbol = ? AND snapshot_id = (SELECT active_snapshot_id FROM market_snapshot_pointer WHERE market = 'CN' LIMIT 1)
    `).bind(symbol).first();
    
    // Stale check (e.g. older than 1 day in real life, but we just check if it exists for simplicity, or timestamp)
    if (!snapshot) {
      await recordRejectedOrder(c.env.DB, orderId, userId, account.id as string, client_order_id, symbol, side, order_type, quantity, limit_price, 'NO_MARKET_DATA');
      return c.json({ success: false, error: 'MARKET_DATA_STALE / NO_MARKET_DATA' }, 400);
    }
    
    const currentPrice = snapshot.current_price as number;

    // Simulate match
    let matchPrice = currentPrice;
    if (order_type === 'LIMIT') {
      if (side === 'BUY' && limit_price < currentPrice) {
         await recordPendingOrder(c.env.DB, orderId, userId, account.id as string, client_order_id, symbol, side, order_type, quantity, limit_price);
         return c.json({ success: true, data: { order_id: orderId, status: 'PENDING' } });
      } else if (side === 'SELL' && limit_price > currentPrice) {
         await recordPendingOrder(c.env.DB, orderId, userId, account.id as string, client_order_id, symbol, side, order_type, quantity, limit_price);
         return c.json({ success: true, data: { order_id: orderId, status: 'PENDING' } });
      }
      matchPrice = limit_price;
    } else {
       // Market order slippage simulation
       matchPrice = side === 'BUY' ? currentPrice * 1.001 : currentPrice * 0.999;
    }

    const notional = matchPrice * quantity;
    const commission = notional * 0.0003;
    const tax = side === 'SELL' ? notional * 0.001 : 0.0;
    const totalCost = notional + commission + tax;

    if (side === 'BUY') {
      if ((account.cash_balance as number) < totalCost) {
        await recordRejectedOrder(c.env.DB, orderId, userId, account.id as string, client_order_id, symbol, side, order_type, quantity, limit_price, 'INSUFFICIENT_FUNDS');
        return c.json({ success: false, error: 'INSUFFICIENT_FUNDS' }, 400);
      }
    } else if (side === 'SELL') {
      const position = await c.env.DB.prepare(`SELECT * FROM paper_positions WHERE account_id = ? AND symbol = ?`).bind(account.id, symbol).first();
      if (!position || (position.available_quantity as number) < quantity) {
        await recordRejectedOrder(c.env.DB, orderId, userId, account.id as string, client_order_id, symbol, side, order_type, quantity, limit_price, 'INSUFFICIENT_POSITIONS (T+1 Rule)');
        return c.json({ success: false, error: 'INSUFFICIENT_POSITIONS' }, 400);
      }
    }

    // Process trade transactionally
    const tradeId = `pt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const batchStmts = [];

    batchStmts.push(
      c.env.DB.prepare(`
        INSERT INTO paper_orders (id, user_id, account_id, client_order_id, symbol, side, order_type, quantity, limit_price, status, submitted_at, filled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'FILLED', ?, ?)
      `).bind(orderId, userId, account.id, client_order_id, symbol, side, order_type, quantity, limit_price || null, now, now)
    );

    batchStmts.push(
      c.env.DB.prepare(`
        INSERT INTO paper_trades (id, order_id, account_id, symbol, side, quantity, price, notional, commission, tax, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(tradeId, orderId, account.id, symbol, side, quantity, matchPrice, notional, commission, tax, now)
    );

    let newCashBalance = account.cash_balance as number;
    
    if (side === 'BUY') {
      newCashBalance -= totalCost;
      batchStmts.push(
        c.env.DB.prepare(`UPDATE paper_accounts SET cash_balance = ?, updated_at = ? WHERE id = ?`).bind(newCashBalance, now, account.id)
      );
      
      const pos = await c.env.DB.prepare(`SELECT * FROM paper_positions WHERE account_id = ? AND symbol = ?`).bind(account.id, symbol).first();
      if (pos) {
        const oldQty = pos.quantity as number;
        const oldCost = pos.avg_cost as number;
        const newQty = oldQty + quantity;
        const newAvgCost = ((oldQty * oldCost) + notional) / newQty;
        // T+1: available_quantity does NOT increase on BUY. Will increase next day (or we just mock it for paper)
        // Actually, requirement says T+1 sell constraint. So available_quantity stays same.
        batchStmts.push(
          c.env.DB.prepare(`UPDATE paper_positions SET quantity = ?, avg_cost = ?, updated_at = ? WHERE account_id = ? AND symbol = ?`).bind(newQty, newAvgCost, now, account.id, symbol)
        );
      } else {
        batchStmts.push(
          c.env.DB.prepare(`
            INSERT INTO paper_positions (account_id, symbol, quantity, available_quantity, avg_cost, realized_pnl, updated_at)
            VALUES (?, ?, ?, 0, ?, 0.0, ?)
          `).bind(account.id, symbol, quantity, matchPrice, now)
        );
      }
    } else {
      newCashBalance += (notional - commission - tax);
      batchStmts.push(
        c.env.DB.prepare(`UPDATE paper_accounts SET cash_balance = ?, updated_at = ? WHERE id = ?`).bind(newCashBalance, now, account.id)
      );

      const pos = await c.env.DB.prepare(`SELECT * FROM paper_positions WHERE account_id = ? AND symbol = ?`).bind(account.id, symbol).first();
      if (pos) {
        const oldQty = pos.quantity as number;
        const oldAvgCost = pos.avg_cost as number;
        const newQty = oldQty - quantity;
        const newAvailableQty = (pos.available_quantity as number) - quantity;
        const realizedPnl = (matchPrice - oldAvgCost) * quantity - commission - tax;
        const newTotalRealized = (pos.realized_pnl as number) + realizedPnl;

        batchStmts.push(
          c.env.DB.prepare(`
            UPDATE paper_positions SET quantity = ?, available_quantity = ?, realized_pnl = ?, updated_at = ?
            WHERE account_id = ? AND symbol = ?
          `).bind(newQty, newAvailableQty, newTotalRealized, now, account.id, symbol)
        );
      }
    }

    try {
      await c.env.DB.batch(batchStmts);
      return c.json({ success: true, data: { order_id: orderId, status: 'FILLED', matchPrice, trade_id: tradeId } });
    } catch (e: any) {
      return c.json({ success: false, error: 'Transaction failed', details: e.message }, 500);
    }
  });

  // 3. List Orders
  router.get('/orders', async (c) => {
    const userId = c.get('authenticatedUserId') || 'guest';
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    const { results } = await c.env.DB.prepare(`
      SELECT * FROM paper_orders WHERE user_id = ? ORDER BY submitted_at DESC LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();

    return c.json({ success: true, data: results });
  });

  // 4. List Trades
  router.get('/trades', async (c) => {
    const userId = c.get('authenticatedUserId') || 'guest';
    const account = await c.env.DB.prepare(`SELECT id FROM paper_accounts WHERE user_id = ?`).bind(userId).first();
    if (!account) return c.json({ success: true, data: [] });

    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    const { results } = await c.env.DB.prepare(`
      SELECT * FROM paper_trades WHERE account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).bind(account.id, limit, offset).all();

    return c.json({ success: true, data: results });
  });

  return router;
}

async function recordRejectedOrder(db: any, id: string, userId: string, accountId: string, clientId: string, symbol: string, side: string, type: string, qty: number, limitPrice: number, reason: string) {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO paper_orders (id, user_id, account_id, client_order_id, symbol, side, order_type, quantity, limit_price, status, submitted_at, reject_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'REJECTED', ?, ?)
  `).bind(id, userId, accountId, clientId, symbol, side, type, qty, limitPrice || null, now, reason).run();
}

async function recordPendingOrder(db: any, id: string, userId: string, accountId: string, clientId: string, symbol: string, side: string, type: string, qty: number, limitPrice: number) {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO paper_orders (id, user_id, account_id, client_order_id, symbol, side, order_type, quantity, limit_price, status, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
  `).bind(id, userId, accountId, clientId, symbol, side, type, qty, limitPrice || null, now).run();
}
