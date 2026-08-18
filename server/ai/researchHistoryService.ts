import { d1Client } from '../db/d1Client';
import { r2Client } from '../storage/r2Client';

export interface ResearchThread {
  id: string;
  user_id: string;
  title: string;
  market_context: string;
  active_symbol: string;
  message_count: number;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  deleted_at: string | null;
}

export interface ResearchMessage {
  id: string;
  thread_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  steps_json?: string;
  result_card_json?: string;
  status: 'pending' | 'streaming' | 'completed' | 'failed' | 'aborted';
  model: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
  updated_at: string;
}

export class ResearchHistoryService {
  /**
   * List all active threads for a given user, sorted by pinned DESC, last_message_at DESC.
   * Supports search keyword filtering and pagination cursor/limit.
   */
  public static getUserThreads(params: {
    userId: string;
    search?: string;
    limit?: number;
    cursor?: string;
  }): ResearchThread[] {
    const { userId, search, limit = 20 } = params;
    let threads = d1Client.getTable<ResearchThread>('research_threads')
      .filter((t) => t.user_id === userId && !t.deleted_at);

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      threads = threads.filter((t) => t.title.toLowerCase().includes(q));
    }

    // Sort pinned first, then last_message_at DESC
    threads.sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });

    return threads.slice(0, limit);
  }

  /**
   * Get thread detail along with lazy-loaded messages.
   */
  public static getThreadDetail(threadId: string, userId: string): { thread: ResearchThread | null; messages: ResearchMessage[] } {
    const thread = d1Client.getTable<ResearchThread>('research_threads')
      .find((t) => t.id === threadId && t.user_id === userId && !t.deleted_at) || null;

    if (!thread) {
      return { thread: null, messages: [] };
    }

    const messages = d1Client.getTable<ResearchMessage>('research_messages')
      .filter((m) => m.thread_id === threadId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return { thread, messages };
  }

  /**
   * Create or update a research thread.
   */
  public static createOrUpdateThread(params: {
    threadId: string;
    userId: string;
    title?: string;
    activeSymbol?: string;
    marketContext?: string;
  }): ResearchThread {
    const { threadId, userId, title, activeSymbol = '600519.SH', marketContext = 'A股' } = params;
    const existing = d1Client.getTable<ResearchThread>('research_threads')
      .find((t) => t.id === threadId);

    const now = new Date().toISOString();

    if (existing) {
      const updatedTitle = title || existing.title;
      d1Client.updateRecord<ResearchThread>('research_threads', threadId, {
        title: updatedTitle,
        active_symbol: activeSymbol || existing.active_symbol,
        updated_at: now,
        last_message_at: now,
      });
      return { ...existing, title: updatedTitle, updated_at: now, last_message_at: now };
    } else {
      const newThread: ResearchThread = {
        id: threadId,
        user_id: userId,
        title: title || '新量化研究会话',
        market_context: marketContext,
        active_symbol: activeSymbol,
        message_count: 0,
        pinned: false,
        archived: false,
        created_at: now,
        updated_at: now,
        last_message_at: now,
        deleted_at: null,
      };
      d1Client.insertRecord('research_threads', newThread);
      return newThread;
    }
  }

  /**
   * Append a new message to a thread in D1 in real-time.
   */
  public static appendMessage(params: {
    threadId: string;
    userId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    steps?: string[];
    resultCard?: any;
    status?: 'pending' | 'streaming' | 'completed' | 'failed' | 'aborted';
    model?: string;
  }): ResearchMessage {
    const { threadId, userId, role, content, steps, resultCard, status = 'completed', model = 'deepseek-v4-flash' } = params;
    const now = new Date().toISOString();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const messageRecord: ResearchMessage = {
      id: messageId,
      thread_id: threadId,
      user_id: userId,
      role,
      content,
      steps_json: steps ? JSON.stringify(steps) : undefined,
      result_card_json: resultCard ? JSON.stringify(resultCard) : undefined,
      status,
      model,
      input_tokens: role === 'user' ? Math.ceil(content.length * 0.8) : 0,
      output_tokens: role === 'assistant' ? Math.ceil(content.length * 0.8) : 0,
      created_at: now,
      updated_at: now,
    };

    d1Client.insertRecord('research_messages', messageRecord);

    // Update thread metadata & message count
    const thread = d1Client.getTable<ResearchThread>('research_threads').find((t) => t.id === threadId);
    if (thread) {
      const newCount = (thread.message_count || 0) + 1;
      let newTitle = thread.title;

      // Auto-generate title from first user message
      if (role === 'user' && (thread.title === '新量化研究会话' || thread.title === '量化策略问答' || !thread.title)) {
        newTitle = generateCleanTitle(content);
      }

      d1Client.updateRecord<ResearchThread>('research_threads', threadId, {
        title: newTitle,
        message_count: newCount,
        last_message_at: now,
        updated_at: now,
      });

      // R2 Long Session Archive if message count exceeds 30
      if (newCount > 30) {
        this.archiveThreadToR2(threadId, userId);
      }
    } else {
      // Auto-create thread if missing
      this.createOrUpdateThread({
        threadId,
        userId,
        title: role === 'user' ? generateCleanTitle(content) : '量化策略问答',
      });
    }

    return messageRecord;
  }

  /**
   * Update message status and content (for streaming or failure handling).
   */
  public static updateMessage(messageId: string, updates: Partial<ResearchMessage>): boolean {
    return d1Client.updateRecord<ResearchMessage>('research_messages', messageId, updates);
  }

  /**
   * Toggle thread pin / rename title / archive.
   */
  public static updateThread(threadId: string, updates: Partial<ResearchThread>): boolean {
    return d1Client.updateRecord<ResearchThread>('research_threads', threadId, updates);
  }

  /**
   * Soft delete a research thread.
   */
  public static softDeleteThread(threadId: string, userId: string): boolean {
    return d1Client.updateRecord<ResearchThread>('research_threads', threadId, {
      deleted_at: new Date().toISOString(),
    });
  }

  /**
   * Archive long thread messages to R2 Storage.
   */
  public static async archiveThreadToR2(threadId: string, userId: string): Promise<string> {
    const { thread, messages } = this.getThreadDetail(threadId, userId);
    if (!thread) return '';

    const archiveData = {
      version: '1.0',
      archived_at: new Date().toISOString(),
      thread,
      messages,
    };

    const objectKey = `research-history/${userId}/${threadId}/archive-v1.json`;
    await r2Client.saveObject(objectKey, Buffer.from(JSON.stringify(archiveData, null, 2), 'utf-8'), {
      ownerId: userId,
      category: 'documents',
      isPermanent: true,
    });

    return objectKey;
  }
}

/**
 * Generate a clean, concise, human-readable title from the user's prompt:
 * - Removes noise, brackets, command phrases, and prefixes
 * - Produces concise 4-14 character titles like ChatGPT/DeepSeek
 */
function generateCleanTitle(userPrompt: string): string {
  if (!userPrompt || !userPrompt.trim()) return '新量化研究';
  let text = userPrompt.trim();

  // Strip symbol/file annotations
  text = text.replace(/\[(?:标的|股票|代码|附件):?[^\]]+\]/gi, '');
  text = text.replace(/【(?:标的|股票|代码|附件):?[^】]+】/gi, '');

  // Strip query noise
  text = text.replace(/^(?:请|请你|请帮我|帮我|麻烦|麻烦帮我|我想了解|我想知道|如何|怎样|能不能|详细|深度|系统|结合当前|围绕|基于|使用|针对)\s*/g, '');
  text = text.replace(/^(?:诊断|分析|评估|拆解|设计|构建|预测|筛选|推荐|计算|总结|剖析|对比)\s*/g, '');
  text = text.replace(/^(?:标的|股票|个股|组合|策略|模型|财报|数据|因子)\s*/g, '');

  // Strip punctuation
  text = text.replace(/[，。！？、：；“”"'`~!@#$%^&*()_+=<>{}\[\]|\\]/g, ' ').replace(/\s+/g, ' ').trim();

  if (!text || text.length < 2) {
    text = userPrompt.replace(/[\r\n]+/g, ' ').replace(/[【】\[\]]/g, '').trim().slice(0, 14);
  }

  if (text.length > 14) {
    text = text.slice(0, 14);
  }

  return text || '量化策略问答';
}
