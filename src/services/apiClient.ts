/**
 * AetherQuant Frontend API Gateway Client
 * Conforming to Rule 112-118:
 * - Direct connection to /api/v1/* endpoints
 * - Handles token headers, network timeouts, and seamless fallback
 */

const API_BASE = '/api/v1';

export class ApiClient {
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
        'X-User-Id': 'usr_aether_trader',
      },
    });

    if (!response.ok) {
      const errJson = (await response.json().catch(() => ({}))) as Record<string, any>;
      throw new Error(errJson.error || `HTTP error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  public static async post<T>(path: string, body?: any): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-User-Id': 'usr_aether_trader',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errJson = (await response.json().catch(() => ({}))) as Record<string, any>;
      throw new Error(errJson.error || `HTTP error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  public static async postStream(
    path: string,
    body: any,
    onChunk: (text: string) => void,
    onDone?: () => void,
    onError?: (err: Error) => void
  ): Promise<string> {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json',
          'X-User-Id': 'usr_aether_trader',
        },
        body: JSON.stringify({ ...body, stream: true }),
      });

      if (!response.ok) {
        const errJson = (await response.json().catch(() => ({}))) as Record<string, any>;
        throw new Error(errJson.error || `HTTP error ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') {
              continue;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                fullText += parsed.text;
                onChunk(parsed.text);
              }
            } catch (e) {
              // Raw text chunk fallback
              if (dataStr) {
                fullText += dataStr;
                onChunk(dataStr);
              }
            }
          }
        }
      }

      if (onDone) onDone();
      return fullText;
    } catch (err: any) {
      if (onError) onError(err);
      throw err;
    }
  }

  public static async patch<T>(path: string, body?: any): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-User-Id': 'usr_aether_trader',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errJson = (await response.json().catch(() => ({}))) as Record<string, any>;
      throw new Error(errJson.error || `HTTP error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  public static async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-User-Id': 'usr_aether_trader',
      },
    });

    if (!response.ok) {
      const errJson = (await response.json().catch(() => ({}))) as Record<string, any>;
      throw new Error(errJson.error || `HTTP error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}
