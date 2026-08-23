import { d1Client } from '../db/d1Client';
import { marketProvider } from '../market/marketDataProvider';

export interface PaperAccount {
  id: string;
  userId: string;
  name: string;
  currency: string;
  initialBalance: number;
  cashBalance: number;
  marketValue: number;
  totalEquity: number;
  dailyPnl: number;
  totalPnl: number;
  totalPnlPercent: number;
  updatedAt: string;
}

export interface PaperPosition {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  quantity: number;
  availableQuantity: number; // T+1 sellable constraint
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  updatedAt: string;
}

export interface PaperOrder {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET';
  quantity: number;
  price: number;
  status: 'FILLED' | 'REJECTED' | 'CANCELLED';
  reason?: string;
  createdAt: string;
}

export class PaperTradingService {
  public static async getAccount(userId: string): Promise<{
    account: PaperAccount;
    positions: PaperPosition[];
    orders: PaperOrder[];
  }> {
    let accounts = d1Client.getTable<PaperAccount>('paper_accounts').filter((a) => a.userId === userId);
    let account = accounts[0];

    if (!account) {
      account = {
        id: `acc_${userId}`,
        userId,
        name: 'Penguin Quant 仿真模拟账户',
        currency: 'CNY',
        initialBalance: 1000000.0,
        cashBalance: 654200.0,
        marketValue: 418500.0,
        totalEquity: 1072700.0,
        dailyPnl: 8420.0,
        totalPnl: 72700.0,
        totalPnlPercent: 7.27,
        updatedAt: new Date().toISOString(),
      };
      d1Client.insertRecord('paper_accounts', account);

      // Seed initial positions
      d1Client.insertRecord<PaperPosition>('paper_positions', {
        id: `pos_${account.id}_600519`,
        accountId: account.id,
        symbol: '600519.SH',
        name: '贵州茅台',
        quantity: 200,
        availableQuantity: 200,
        avgCost: 1405.0,
        currentPrice: 1438.0,
        marketValue: 287600.0,
        unrealizedPnl: 6600.0,
        unrealizedPnlPercent: 2.35,
        updatedAt: new Date().toISOString(),
      });

      d1Client.insertRecord<PaperPosition>('paper_positions', {
        id: `pos_${account.id}_300750`,
        accountId: account.id,
        symbol: '300750.SZ',
        name: '宁德时代',
        quantity: 500,
        availableQuantity: 500,
        avgCost: 252.0,
        currentPrice: 261.8,
        marketValue: 130900.0,
        unrealizedPnl: 4900.0,
        unrealizedPnlPercent: 3.89,
        updatedAt: new Date().toISOString(),
      });
    }

    const positions = d1Client.getTable<PaperPosition>('paper_positions').filter((p) => p.accountId === account.id);
    const orders = d1Client.getTable<PaperOrder>('paper_orders').filter((o) => o.accountId === account.id);

    return { account, positions, orders };
  }

  public static async placeOrder(params: {
    userId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
  }): Promise<{ success: boolean; order?: PaperOrder; error?: string }> {
    const { userId, symbol, side, quantity } = params;
    const { account, positions } = await this.getAccount(userId);

    const quote = await marketProvider.getQuote(symbol);
    const execPrice = params.price || quote.price;
    const isCN = symbol.includes('.SH') || symbol.includes('.SZ') || /^\d{6}/.test(symbol);

    // Lot Size validation (Rule 82: 100 shares minimum for CN)
    if (isCN && side === 'BUY' && quantity % 100 !== 0) {
      return { success: false, error: 'A股买入股数必须为 100 股（1手）的整数倍' };
    }

    const totalCost = execPrice * quantity;
    const commission = Math.max(5, totalCost * 0.0003);
    const tax = side === 'SELL' && isCN ? totalCost * 0.0005 : 0;

    if (side === 'BUY') {
      const requiredCash = totalCost + commission;
      if (account.cashBalance < requiredCash) {
        return { success: false, error: `可用资金不足 (所需 ￥${requiredCash.toFixed(2)}, 当前可用 ￥${account.cashBalance.toFixed(2)})` };
      }

      // Execute buy
      const newCash = account.cashBalance - requiredCash;
      const existingPos = positions.find((p) => p.symbol === symbol);

      if (existingPos) {
        const totalShares = existingPos.quantity + quantity;
        const totalInvested = existingPos.quantity * existingPos.avgCost + totalCost;
        const newAvg = totalInvested / totalShares;
        d1Client.updateRecord<PaperPosition>('paper_positions', existingPos.id, {
          quantity: totalShares,
          avgCost: Number(newAvg.toFixed(2)),
          currentPrice: execPrice,
          marketValue: totalShares * execPrice,
          // Note: newly bought shares are not immediately available on T+0
        });
      } else {
        d1Client.insertRecord<PaperPosition>('paper_positions', {
          id: `pos_${account.id}_${symbol.replace('.', '_')}`,
          accountId: account.id,
          symbol,
          name: quote.name,
          quantity,
          availableQuantity: isCN ? 0 : quantity, // T+1 rule in CN
          avgCost: execPrice,
          currentPrice: execPrice,
          marketValue: quantity * execPrice,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
          updatedAt: new Date().toISOString(),
        });
      }

      d1Client.updateRecord<PaperAccount>('paper_accounts', account.id, {
        cashBalance: Number(newCash.toFixed(2)),
      });
    } else {
      // Sell logic with T+1 check
      const pos = positions.find((p) => p.symbol === symbol);
      if (!pos || pos.availableQuantity < quantity) {
        return { success: false, error: `可卖出持仓不足 (持仓 ${pos?.quantity || 0}, 可用 ${pos?.availableQuantity || 0}, 遵循 T+1 规则)` };
      }

      const proceeds = totalCost - commission - tax;
      const newCash = account.cashBalance + proceeds;
      const remaining = pos.quantity - quantity;

      if (remaining <= 0) {
        d1Client.deleteRecord('paper_positions', pos.id);
      } else {
        d1Client.updateRecord<PaperPosition>('paper_positions', pos.id, {
          quantity: remaining,
          availableQuantity: pos.availableQuantity - quantity,
          marketValue: remaining * execPrice,
        });
      }

      d1Client.updateRecord<PaperAccount>('paper_accounts', account.id, {
        cashBalance: Number(newCash.toFixed(2)),
      });
    }

    const order: PaperOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      accountId: account.id,
      symbol,
      name: quote.name,
      side,
      type: params.price ? 'LIMIT' : 'MARKET',
      quantity,
      price: execPrice,
      status: 'FILLED',
      createdAt: new Date().toISOString(),
    };

    d1Client.insertRecord('paper_orders', order);
    return { success: true, order };
  }
}
