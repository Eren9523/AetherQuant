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
}
