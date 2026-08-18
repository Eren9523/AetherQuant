/**
 * AetherQuant Frontend API Gateway Client
 * Conforms to strict AetherQuant V1 Contract:
 * - Unwraps success { success: true, data: T, request_id } -> returns T
 * - Normalizes failures { success: false, error: { code, message }, request_id } -> throws ApiError
 * - Streamlined SSE Event Contract: delta / done / error
 */

const API_BASE = '/api/v1';

export class ApiError extends Error {
  public code: string;
  public status: number;
  public requestId?: string;
  public details?: any;

  constructor(code: string, message: string, status: number = 500, requestId?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }
}

export class ApiClient {
  private static parseErrorResponse(errJson: any, status: number, statusText: string): ApiError {
    if (errJson && typeof errJson === 'object') {
      if (errJson.error && typeof errJson.error === 'object') {
        const code = errJson.error.code || 'API_ERROR';
        const message = errJson.error.message || statusText || 'API 请求异常';
        return new ApiError(code, message, status, errJson.request_id, errJson.error.details);
      }
      if (typeof errJson.error === 'string') {
        return new ApiError('API_ERROR', errJson.error, status, errJson.request_id);
      }
      if (errJson.message) {
        return new ApiError(errJson.code || 'API_ERROR', errJson.message, status, errJson.request_id);
      }
    }
    return new ApiError('HTTP_ERROR', `HTTP ${status}: ${statusText}`, status);
  }

  public static async get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
    let url = `${API_BASE}${path}`;
    if (params) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) query.append(k, String(v));
      });
      const qStr = query.toString();
      if (qStr) url += `?${qStr}`;
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    const json: any = await response.json().catch(() => ({}));

    if (!response.ok || json.success === false) {
      throw this.parseErrorResponse(json, response.status, response.statusText);
    }

    return (json.data !== undefined ? json.data : json) as T;
  }

  public static async post<T>(path: string, body?: any): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });

    const json: any = await response.json().catch(() => ({}));

    if (!response.ok || json.success === false) {
      throw this.parseErrorResponse(json, response.status, response.statusText);
    }

    return (json.data !== undefined ? json.data : json) as T;
  }

  public static async patch<T>(path: string, body?: any): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });

    const json: any = await response.json().catch(() => ({}));

    if (!response.ok || json.success === false) {
      throw this.parseErrorResponse(json, response.status, response.statusText);
    }

    return (json.data !== undefined ? json.data : json) as T;
  }

  public static async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    const json: any = await response.json().catch(() => ({}));

    if (!response.ok || json.success === false) {
      throw this.parseErrorResponse(json, response.status, response.statusText);
    }

    return (json.data !== undefined ? json.data : json) as T;
  }

  /**
   * SSE Stream Consumer conforming to AetherQuant Event Contract:
   * - {"type":"delta","text":"..."}
   * - {"type":"done","meta":{...}}
   * - {"type":"error","error":{"code":"...","message":"..."}}
   */
  public static async postStream(
    path: string,
    body: any,
    onChunk: (text: string) => void,
    onStreamDone?: (meta?: any) => void,
    onError?: (err: ApiError) => void
  ): Promise<string> {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ ...body, stream: true }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const apiErr = this.parseErrorResponse(errJson, response.status, response.statusText);
        if (onError) onError(apiErr);
        throw apiErr;
      }

      if (!response.body) {
        const apiErr = new ApiError('NULL_BODY', '服务返回的响应流为空', response.status);
        if (onError) onError(apiErr);
        throw apiErr;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep unfinished line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const event = JSON.parse(dataStr);
            if (event.type === 'delta' && typeof event.text === 'string') {
              fullText += event.text;
              onChunk(event.text);
            } else if (event.type === 'done') {
              if (onStreamDone) onStreamDone(event.meta);
            } else if (event.type === 'error' && event.error) {
              const apiErr = new ApiError(
                event.error.code || 'AI_PROVIDER_ERROR',
                event.error.message || 'AI 推理过程发生异常',
                500
              );
              if (onError) onError(apiErr);
              throw apiErr;
            } else if (event.text) {
              // Backward compatibility for legacy delta events
              fullText += event.text;
              onChunk(event.text);
            }
          } catch (e: any) {
            if (e instanceof ApiError) throw e;
            // Non-JSON line fallback
            if (dataStr && !dataStr.startsWith('{')) {
              fullText += dataStr;
              onChunk(dataStr);
            }
          }
        }
      }

      return fullText;
    } catch (err: any) {
      const apiErr = err instanceof ApiError ? err : new ApiError('NETWORK_ERROR', err.message || '网络连接中断');
      if (onError) onError(apiErr);
      throw apiErr;
    }
  }
}
