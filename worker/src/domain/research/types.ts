export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'streaming' | 'completed' | 'failed' | 'aborted';

export interface ResearchThread {
  id: string;
  user_id: string;
  title: string;
  market_context: string;
  active_symbol: string | null;
  model: string | null;
  message_count: number;
  pinned: number;
  archived: number;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  deleted_at: string | null;
}

export interface ResearchMessage {
  id: string;
  thread_id: string;
  user_id: string;
  client_message_id: string | null;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  provider: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateThreadInput {
  id?: string;
  userId: string;
  title: string;
  marketContext?: string;
  activeSymbol?: string | null;
  model?: string | null;
}

export interface UpdateThreadInput {
  title?: string;
  pinned?: boolean;
  archived?: boolean;
  activeSymbol?: string | null;
  model?: string | null;
}

export interface CreateUserMessageInput {
  id?: string;
  threadId: string;
  userId: string;
  clientMessageId?: string | null;
  content: string;
}

export interface CreateAssistantPlaceholderInput {
  id?: string;
  threadId: string;
  userId: string;
  clientMessageId?: string | null;
  provider?: string | null;
  model?: string | null;
}

export interface CompleteAssistantMessageInput {
  messageId: string;
  threadId: string;
  userId: string;
  content: string;
  provider?: string | null;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number | null;
}

export interface FailAssistantMessageInput {
  messageId: string;
  threadId: string;
  userId: string;
  content?: string;
  errorCode: string;
  errorMessage: string;
  latencyMs?: number | null;
}

export interface AbortAssistantMessageInput {
  messageId: string;
  threadId: string;
  userId: string;
  content?: string;
  latencyMs?: number | null;
}
