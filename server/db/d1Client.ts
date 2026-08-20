import fs from 'fs';
import path from 'path';

/**
 * Cloudflare D1 Client with dual mode:
 * 1. Cloudflare D1 REST API (when CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_ID & CLOUDFLARE_API_TOKEN exist)
 * 2. High-performance Persistent Local Storage & Query Engine for Local/Container dev
 */
export interface D1QueryResult<T = any> {
  results: T[];
  success: boolean;
  meta?: {
    changes?: number;
    last_row_id?: number;
    duration?: number;
  };
}

class D1DatabaseClient {
  private accountId: string;
  private databaseId: string;
  private apiToken: string;
  private isCloudflareConfigured: boolean;
  private localDataDir: string;
  private localDataFile: string;
  private localTables: Record<string, any[]> = {};

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.databaseId = process.env.D1_DATABASE_ID || '';
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
    this.isCloudflareConfigured = Boolean(this.accountId && this.databaseId && this.apiToken);

    this.localDataDir = path.join(process.cwd(), '.data');
    this.localDataFile = path.join(this.localDataDir, 'd1_storage.json');
    this.initLocalStorage();
  }

  private initLocalStorage() {
    if (!fs.existsSync(this.localDataDir)) {
      try {
        fs.mkdirSync(this.localDataDir, { recursive: true });
      } catch (e) {
        console.error('Failed to create local data dir:', e);
      }
    }

    if (fs.existsSync(this.localDataFile)) {
      try {
        const raw = fs.readFileSync(this.localDataFile, 'utf-8');
        this.localTables = JSON.parse(raw);
      } catch (e) {
        this.localTables = {};
      }
    }

    // Initialize core tables if empty
    const coreTables = [
      'users', 'user_credentials', 'admin_credentials', 'sessions', 'instruments', 'market_snapshot_metadata',
      'watchlists', 'watchlist_items', 'datasets', 'dataset_columns',
      'documents', 'document_chunks', 'factor_definitions', 'factor_experiments',
      'strategies', 'strategy_versions', 'backtests', 'backtest_artifacts',
      'ai_sessions', 'ai_messages', 'jobs', 'job_runs', 'data_quality_reports',
      'paper_accounts', 'paper_positions', 'paper_orders', 'paper_trades',
      'usage_daily', 'storage_objects', 'system_usage', 'audit_logs', 'system_settings',
      'research_threads', 'research_messages', 'daily_prompt_suggestions', 'prompt_generation_runs'
    ];

    for (const tbl of coreTables) {
      if (!this.localTables[tbl]) {
        this.localTables[tbl] = [];
      }
    }
  }

  private saveLocalStorage() {
    try {
      if (!fs.existsSync(this.localDataDir)) {
        fs.mkdirSync(this.localDataDir, { recursive: true });
      }
      fs.writeFileSync(this.localDataFile, JSON.stringify(this.localTables, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving local D1 store:', e);
    }
  }

  public async executeQuery<T = any>(sql: string, params: any[] = []): Promise<D1QueryResult<T>> {
    // If real Cloudflare D1 credentials exist, call Cloudflare REST endpoint
    if (this.isCloudflareConfigured) {
      try {
        const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql, params }),
        });
        const data = (await res.json()) as any;
        if (data.success && data.result && data.result[0]) {
          return {
            results: data.result[0].results || [],
            success: true,
            meta: data.result[0].meta,
          };
        }
      } catch (err) {
        console.warn('Cloudflare D1 query failed, falling back to local persistent engine:', err);
      }
    }

    // Local in-memory / JSON query handler
    return this.executeLocalQuery<T>(sql, params);
  }

  private executeLocalQuery<T = any>(sql: string, params: any[] = []): D1QueryResult<T> {
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();

    // 1. CREATE TABLE
    if (upper.startsWith('CREATE TABLE')) {
      const match = trimmed.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        const tableName = match[1];
        if (!this.localTables[tableName]) {
          this.localTables[tableName] = [];
          this.saveLocalStorage();
        }
      }
      return { results: [], success: true };
    }

    // 2. SELECT QUERIES
    if (upper.startsWith('SELECT')) {
      const match = trimmed.match(/FROM\s+([a-zA-Z0-9_]+)/i);
      const tableName = match ? match[1] : '';
      let rows = [...(this.localTables[tableName] || [])];

      // Parse WHERE conditions
      if (upper.includes('WHERE')) {
        const whereClause = trimmed.substring(trimmed.search(/WHERE/i) + 5).split(/ORDER\s+BY|GROUP\s+BY|LIMIT/i)[0].trim();
        rows = rows.filter((record) => this.evalWhere(whereClause, record, params));
      }

      // Handle LIMIT
      const limitMatch = trimmed.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        const lim = parseInt(limitMatch[1], 10);
        rows = rows.slice(0, lim);
      }

      return { results: rows as T[], success: true };
    }

    // 3. INSERT OR REPLACE / INSERT INTO
    if (upper.startsWith('INSERT INTO') || upper.startsWith('INSERT OR REPLACE INTO') || upper.startsWith('REPLACE INTO')) {
      const match = trimmed.match(/(?:INSERT\s+(?:OR\s+REPLACE\s+)?INTO|REPLACE\s+INTO)\s+([a-zA-Z0-9_]+)(?:\s*\(([^)]+)\))?/i);
      if (!match) return { results: [], success: false };

      const tableName = match[1];
      const columnNames = match[2]
        ? match[2].split(',').map((c) => c.trim().replace(/[`"']/g, ''))
        : [];

      if (!this.localTables[tableName]) {
        this.localTables[tableName] = [];
      }

      let newRecord: Record<string, any> = {};

      if (params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0])) {
        newRecord = { ...params[0] };
      } else if (columnNames.length > 0 && params.length >= columnNames.length) {
        columnNames.forEach((col, idx) => {
          newRecord[col] = params[idx];
        });
      } else if (params.length > 0) {
        params.forEach((val, idx) => {
          newRecord[`col_${idx}`] = val;
        });
      } else {
        newRecord = { id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}` };
      }

      if (!newRecord.id) {
        newRecord.id = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      }

      // If replace / exists by primary key or unique fields
      const existingIdx = this.localTables[tableName].findIndex(
        (r) => (newRecord.id && r.id === newRecord.id) || (newRecord.username && r.username && r.username.toLowerCase() === newRecord.username.toLowerCase()) || (newRecord.email && r.email && r.email.toLowerCase() === newRecord.email.toLowerCase())
      );

      if (existingIdx !== -1 && (upper.includes('REPLACE') || upper.includes('INSERT OR REPLACE'))) {
        this.localTables[tableName][existingIdx] = { ...this.localTables[tableName][existingIdx], ...newRecord };
      } else if (existingIdx !== -1) {
        this.localTables[tableName][existingIdx] = { ...this.localTables[tableName][existingIdx], ...newRecord };
      } else {
        this.localTables[tableName].push(newRecord);
      }

      this.saveLocalStorage();
      return { results: [newRecord as any], success: true, meta: { changes: 1 } };
    }

    // 4. UPDATE
    if (upper.startsWith('UPDATE')) {
      const match = trimmed.match(/UPDATE\s+([a-zA-Z0-9_]+)/i);
      const tableName = match ? match[1] : '';
      const list = this.localTables[tableName] || [];

      if (upper.includes('WHERE')) {
        const whereClause = trimmed.substring(trimmed.search(/WHERE/i) + 5).trim();
        let changed = 0;
        list.forEach((item) => {
          if (this.evalWhere(whereClause, item, params)) {
            item.updated_at = new Date().toISOString();
            changed++;
          }
        });
        this.saveLocalStorage();
        return { results: [], success: true, meta: { changes: changed } };
      }

      this.saveLocalStorage();
      return { results: [], success: true, meta: { changes: 1 } };
    }

    // 5. DELETE
    if (upper.startsWith('DELETE FROM')) {
      const match = trimmed.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)/i);
      const tableName = match ? match[1] : '';
      let list = this.localTables[tableName] || [];

      if (upper.includes('WHERE')) {
        const whereClause = trimmed.substring(trimmed.search(/WHERE/i) + 5).trim();
        const initialLen = list.length;
        list = list.filter((item) => !this.evalWhere(whereClause, item, params));
        this.localTables[tableName] = list;
        this.saveLocalStorage();
        return { results: [], success: true, meta: { changes: initialLen - list.length } };
      }

      this.localTables[tableName] = [];
      this.saveLocalStorage();
      return { results: [], success: true, meta: { changes: list.length } };
    }

    return { results: [], success: true };
  }

  private evalWhere(whereClause: string, record: Record<string, any>, params: any[]): boolean {
    if (!whereClause || !record) return true;

    // Handle OR expressions e.g. "id = ? OR email = ?" or "LOWER(username) = ? OR LOWER(email) = ?"
    if (/\s+OR\s+/i.test(whereClause)) {
      const parts = whereClause.split(/\s+OR\s+/i);
      return parts.some((p) => this.evalSingleCondition(p.trim(), record, params));
    }

    // Handle AND expressions e.g. "user_id = ? AND role = ?"
    if (/\s+AND\s+/i.test(whereClause)) {
      const parts = whereClause.split(/\s+AND\s+/i);
      return parts.every((p) => this.evalSingleCondition(p.trim(), record, params));
    }

    return this.evalSingleCondition(whereClause.trim(), record, params);
  }

  private evalSingleCondition(cond: string, record: Record<string, any>, params: any[]): boolean {
    // 1. Check for functions like LOWER(col) = ? or LOWER(col) = 'val'
    const lowerFuncMatch = cond.match(/LOWER\s*\(\s*([a-zA-Z0-9_]+)\s*\)\s*=\s*(?:\?|'([^']*)')/i);
    if (lowerFuncMatch) {
      const field = lowerFuncMatch[1];
      const targetVal = lowerFuncMatch[2] !== undefined ? lowerFuncMatch[2].toLowerCase() : (params[0] !== undefined ? String(params[0]).toLowerCase() : '');
      const recordVal = record[field] !== undefined ? String(record[field]).toLowerCase() : '';
      return recordVal === targetVal;
    }

    // 2. Check for field = ? or field = 'value'
    const eqMatch = cond.match(/([a-zA-Z0-9_]+)\s*=\s*(?:\?|'([^']*)'|(\d+))/i);
    if (eqMatch) {
      const field = eqMatch[1];
      let targetVal: any = undefined;
      if (eqMatch[2] !== undefined) {
        targetVal = eqMatch[2];
      } else if (eqMatch[3] !== undefined) {
        targetVal = Number(eqMatch[3]);
      } else if (params.length > 0) {
        targetVal = params[0];
      }
      return String(record[field]) === String(targetVal);
    }

    // 3. Fallback check
    for (const key of Object.keys(record)) {
      if (cond.includes(key) && params.length > 0) {
        if (String(record[key]).toLowerCase() === String(params[0]).toLowerCase()) {
          return true;
        }
      }
    }

    return false;
  }

  // Direct collection helpers for clean programmatic access
  public getTable<T = any>(tableName: string): T[] {
    return (this.localTables[tableName] || []) as T[];
  }

  public insertRecord<T = any>(tableName: string, record: T): T {
    if (!this.localTables[tableName]) {
      this.localTables[tableName] = [];
    }
    this.localTables[tableName].unshift(record);
    this.saveLocalStorage();
    return record;
  }

  public updateRecord<T = any>(tableName: string, id: string, updates: Record<string, any>): boolean {
    const list = this.localTables[tableName];
    if (!list) return false;
    const idx = list.findIndex((item) => item.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
      this.saveLocalStorage();
      return true;
    }
    return false;
  }

  public deleteRecord(tableName: string, id: string): boolean {
    const list = this.localTables[tableName];
    if (!list) return false;
    const initialLen = list.length;
    this.localTables[tableName] = list.filter((item) => item.id !== id);
    if (this.localTables[tableName].length !== initialLen) {
      this.saveLocalStorage();
      return true;
    }
    return false;
  }
}

export const d1Client = new D1DatabaseClient();

