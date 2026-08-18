import {
  ResearchMessage,
  CreateUserMessageInput,
  CreateUserMessageResult,
  CreateAssistantPlaceholderInput,
  CompleteAssistantMessageInput,
  FailAssistantMessageInput,
  AbortAssistantMessageInput,
} from '../domain/research/types';

export class ResearchMessageRepository {
  constructor(private readonly db: D1Database) {}

  /**
   * Find a user message by client_message_id within a thread verifying ownership
   */
  async findByClientMessageId(
    threadId: string,
    userId: string,
    clientMessageId: string
  ): Promise<ResearchMessage | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM research_messages 
         WHERE thread_id = ? AND user_id = ? AND client_message_id = ? AND role = 'user'`
      )
      .bind(threadId, userId, clientMessageId)
      .first<ResearchMessage>();

    return row || null;
  }

  /**
   * Find a message by ID verifying user ownership
   */
  async findByIdForUser(
    messageId: string,
    userId: string
  ): Promise<ResearchMessage | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM research_messages 
         WHERE id = ? AND user_id = ?`
      )
      .bind(messageId, userId)
      .first<ResearchMessage>();

    return row || null;
  }

  /**
   * Create a user message with write-side IDOR verification and true idempotency semantics
   */
  async createUserMessage(
    input: CreateUserMessageInput
  ): Promise<CreateUserMessageResult> {
    // 1. Mandatory Write-Side Ownership Verification
    const thread = await this.db
      .prepare(
        `SELECT id FROM research_threads 
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
      )
      .bind(input.threadId, input.userId)
      .first();

    if (!thread) {
      throw new Error('THREAD_NOT_FOUND_OR_ACCESS_DENIED');
    }

    // 2. Idempotency check for client_message_id
    if (input.clientMessageId) {
      const existing = await this.findByClientMessageId(
        input.threadId,
        input.userId,
        input.clientMessageId
      );
      if (existing) {
        return { message: existing, created: false };
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const message: ResearchMessage = {
      id,
      thread_id: input.threadId,
      user_id: input.userId,
      client_message_id: input.clientMessageId || null,
      role: 'user',
      content: input.content,
      status: 'completed',
      provider: null,
      model: null,
      input_tokens: 0,
      output_tokens: 0,
      latency_ms: null,
      error_code: null,
      error_message: null,
      created_at: now,
      updated_at: now,
      started_at: now,
      completed_at: now,
    };

    try {
      await this.db
        .prepare(
          `INSERT INTO research_messages (
            id, thread_id, user_id, client_message_id, role, content, status,
            provider, model, input_tokens, output_tokens, latency_ms,
            error_code, error_message, created_at, updated_at, started_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          message.id,
          message.thread_id,
          message.user_id,
          message.client_message_id,
          message.role,
          message.content,
          message.status,
          message.provider,
          message.model,
          message.input_tokens,
          message.output_tokens,
          message.latency_ms,
          message.error_code,
          message.error_message,
          message.created_at,
          message.updated_at,
          message.started_at,
          message.completed_at
        )
        .run();

      return { message, created: true };
    } catch (err: any) {
      if (input.clientMessageId && String(err).includes('UNIQUE')) {
        const existing = await this.findByClientMessageId(
          input.threadId,
          input.userId,
          input.clientMessageId
        );
        if (existing) return { message: existing, created: false };
      }
      throw err;
    }
  }

  /**
   * Create an initial streaming placeholder for assistant response with write-side IDOR check
   * (Assistant client_message_id is always NULL)
   */
  async createAssistantPlaceholder(
    input: CreateAssistantPlaceholderInput
  ): Promise<ResearchMessage> {
    // 1. Mandatory Write-Side Ownership Verification
    const thread = await this.db
      .prepare(
        `SELECT id FROM research_threads 
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
      )
      .bind(input.threadId, input.userId)
      .first();

    if (!thread) {
      throw new Error('THREAD_NOT_FOUND_OR_ACCESS_DENIED');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const message: ResearchMessage = {
      id,
      thread_id: input.threadId,
      user_id: input.userId,
      client_message_id: null, // Always NULL for assistant messages
      role: 'assistant',
      content: '',
      status: 'streaming',
      provider: input.provider || null,
      model: input.model || null,
      input_tokens: 0,
      output_tokens: 0,
      latency_ms: null,
      error_code: null,
      error_message: null,
      created_at: now,
      updated_at: now,
      started_at: now,
      completed_at: null,
    };

    await this.db
      .prepare(
        `INSERT INTO research_messages (
          id, thread_id, user_id, client_message_id, role, content, status,
          provider, model, input_tokens, output_tokens, latency_ms,
          error_code, error_message, created_at, updated_at, started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        message.id,
        message.thread_id,
        message.user_id,
        message.client_message_id,
        message.role,
        message.content,
        message.status,
        message.provider,
        message.model,
        message.input_tokens,
        message.output_tokens,
        message.latency_ms,
        message.error_code,
        message.error_message,
        message.created_at,
        message.updated_at,
        message.started_at,
        message.completed_at
      )
      .run();

    return message;
  }

  /**
   * Complete assistant message with final full content and token metrics
   */
  async completeAssistantMessage(
    input: CompleteAssistantMessageInput
  ): Promise<ResearchMessage | null> {
    const now = new Date().toISOString();

    const res = await this.db
      .prepare(
        `UPDATE research_messages
         SET content = ?,
             status = 'completed',
             provider = COALESCE(?, provider),
             model = COALESCE(?, model),
             input_tokens = ?,
             output_tokens = ?,
             latency_ms = ?,
             completed_at = ?,
             updated_at = ?
         WHERE id = ? AND user_id = ? AND thread_id = ?`
      )
      .bind(
        input.content,
        input.provider || null,
        input.model || null,
        input.inputTokens || 0,
        input.outputTokens || 0,
        input.latencyMs ?? null,
        now,
        now,
        input.messageId,
        input.userId,
        input.threadId
      )
      .run();

    if (!res.meta.changes || res.meta.changes === 0) {
      return null;
    }

    return this.findByIdForUser(input.messageId, input.userId);
  }

  /**
   * Mark assistant message as failed with error code & message
   */
  async failAssistantMessage(
    input: FailAssistantMessageInput
  ): Promise<ResearchMessage | null> {
    const now = new Date().toISOString();

    const res = await this.db
      .prepare(
        `UPDATE research_messages
         SET content = COALESCE(?, content),
             status = 'failed',
             error_code = ?,
             error_message = ?,
             latency_ms = ?,
             completed_at = ?,
             updated_at = ?
         WHERE id = ? AND user_id = ? AND thread_id = ?`
      )
      .bind(
        input.content || null,
        input.errorCode,
        input.errorMessage,
        input.latencyMs ?? null,
        now,
        now,
        input.messageId,
        input.userId,
        input.threadId
      )
      .run();

    if (!res.meta.changes || res.meta.changes === 0) {
      return null;
    }

    return this.findByIdForUser(input.messageId, input.userId);
  }

  /**
   * Mark assistant message as aborted (e.g. user canceled or client disconnected)
   */
  async abortAssistantMessage(
    input: AbortAssistantMessageInput
  ): Promise<ResearchMessage | null> {
    const now = new Date().toISOString();

    const res = await this.db
      .prepare(
        `UPDATE research_messages
         SET content = COALESCE(?, content),
             status = 'aborted',
             latency_ms = ?,
             completed_at = ?,
             updated_at = ?
         WHERE id = ? AND user_id = ? AND thread_id = ?`
      )
      .bind(
        input.content || null,
        input.latencyMs ?? null,
        now,
        now,
        input.messageId,
        input.userId,
        input.threadId
      )
      .run();

    if (!res.meta.changes || res.meta.changes === 0) {
      return null;
    }

    return this.findByIdForUser(input.messageId, input.userId);
  }

  /**
   * List all messages in a thread verifying user ownership of the thread
   */
  async listByThreadForUser(
    threadId: string,
    userId: string,
    limit: number = 100
  ): Promise<ResearchMessage[]> {
    // 1. Verify thread ownership first
    const thread = await this.db
      .prepare(
        `SELECT id FROM research_threads 
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
      )
      .bind(threadId, userId)
      .first();

    if (!thread) {
      return [];
    }

    // 2. Query messages ordered chronologically
    const rows = await this.db
      .prepare(
        `SELECT * FROM research_messages 
         WHERE thread_id = ? AND user_id = ?
         ORDER BY created_at ASC
         LIMIT ?`
      )
      .bind(threadId, userId, limit)
      .all<ResearchMessage>();

    return rows.results || [];
  }
}
