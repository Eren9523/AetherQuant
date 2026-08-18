import {
  ResearchThread,
  CreateThreadInput,
  UpdateThreadInput,
} from '../domain/research/types';

export class ResearchThreadRepository {
  constructor(private readonly db: D1Database) {}

  /**
   * Create a new research thread for a user
   */
  async create(input: CreateThreadInput): Promise<ResearchThread> {
    const id = input.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const thread: ResearchThread = {
      id,
      user_id: input.userId,
      title: input.title.trim() || '新量化研究会话',
      market_context: input.marketContext || 'CN',
      active_symbol: input.activeSymbol || null,
      model: input.model || null,
      message_count: 0,
      pinned: 0,
      archived: 0,
      created_at: now,
      updated_at: now,
      last_message_at: now,
      deleted_at: null,
    };

    await this.db
      .prepare(
        `INSERT INTO research_threads (
          id, user_id, title, market_context, active_symbol, model,
          message_count, pinned, archived, created_at, updated_at,
          last_message_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        thread.id,
        thread.user_id,
        thread.title,
        thread.market_context,
        thread.active_symbol,
        thread.model,
        thread.message_count,
        thread.pinned,
        thread.archived,
        thread.created_at,
        thread.updated_at,
        thread.last_message_at,
        thread.deleted_at
      )
      .run();

    return thread;
  }

  /**
   * Find a single active thread by ID enforcing user ownership
   */
  async findByIdForUser(threadId: string, userId: string): Promise<ResearchThread | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM research_threads 
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
      )
      .bind(threadId, userId)
      .first<ResearchThread>();

    return row || null;
  }

  /**
   * List active threads for a specific user with ordering and filtering
   */
  async listForUser(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      search?: string;
      includeArchived?: boolean;
    } = {}
  ): Promise<ResearchThread[]> {
    const limit = Math.min(Math.max(options.limit || 30, 1), 100);
    const offset = Math.max(options.offset || 0, 0);

    let query = `
      SELECT * FROM research_threads 
      WHERE user_id = ? AND deleted_at IS NULL
    `;
    const params: (string | number)[] = [userId];

    if (!options.includeArchived) {
      query += ` AND archived = 0`;
    }

    if (options.search && options.search.trim()) {
      query += ` AND title LIKE ?`;
      params.push(`%${options.search.trim()}%`);
    }

    query += ` ORDER BY pinned DESC, last_message_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const result = await stmt.bind(...params).all<ResearchThread>();

    return result.results || [];
  }

  /**
   * Update thread properties enforcing user ownership
   */
  async updateForUser(
    threadId: string,
    userId: string,
    updates: UpdateThreadInput
  ): Promise<ResearchThread | null> {
    const now = new Date().toISOString();
    const setClauses: string[] = ['updated_at = ?'];
    const bindParams: (string | number | null)[] = [now];

    if (updates.title !== undefined) {
      setClauses.push('title = ?');
      bindParams.push(updates.title.trim());
    }
    if (updates.pinned !== undefined) {
      setClauses.push('pinned = ?');
      bindParams.push(updates.pinned ? 1 : 0);
    }
    if (updates.archived !== undefined) {
      setClauses.push('archived = ?');
      bindParams.push(updates.archived ? 1 : 0);
    }
    if (updates.activeSymbol !== undefined) {
      setClauses.push('active_symbol = ?');
      bindParams.push(updates.activeSymbol);
    }
    if (updates.model !== undefined) {
      setClauses.push('model = ?');
      bindParams.push(updates.model);
    }

    bindParams.push(threadId, userId);

    const query = `
      UPDATE research_threads 
      SET ${setClauses.join(', ')}
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `;

    const res = await this.db.prepare(query).bind(...bindParams).run();

    if (!res.meta.changes || res.meta.changes === 0) {
      return null;
    }

    return this.findByIdForUser(threadId, userId);
  }

  /**
   * Soft delete a thread enforcing user ownership
   */
  async softDeleteForUser(threadId: string, userId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const res = await this.db
      .prepare(
        `UPDATE research_threads 
         SET deleted_at = ?, updated_at = ? 
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
      )
      .bind(now, now, threadId, userId)
      .run();

    return !!(res.meta.changes && res.meta.changes > 0);
  }

  /**
   * Update message count and last_message_at timestamp
   */
  async touchAfterMessage(
    threadId: string,
    userId: string,
    messageCountIncrement: number = 1
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE research_threads 
         SET last_message_at = ?, 
             updated_at = ?, 
             message_count = message_count + ? 
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
      )
      .bind(now, now, messageCountIncrement, threadId, userId)
      .run();
  }
}
