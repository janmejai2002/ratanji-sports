/**
 * Typed API Client & Real-Time Event Bus
 */

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

const getHeaders = (role: 'spectator' | 'referee' | 'admin' = 'spectator', userId?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-role': role,
  };
  if (userId) {
    headers['x-user-id'] = userId;
  }
  return headers;
};

export const api = {
  async get<T = any>(endpoint: string, role: 'spectator' | 'referee' | 'admin' = 'spectator', userId?: string): Promise<T> {
    const res = await fetch(endpoint, {
      headers: getHeaders(role, userId),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async post<T = any>(endpoint: string, body: any, role: 'spectator' | 'referee' | 'admin' = 'spectator', userId?: string): Promise<T> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: getHeaders(role, userId),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async put<T = any>(endpoint: string, body: any, role: 'spectator' | 'referee' | 'admin' = 'admin', userId?: string): Promise<T> {
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: getHeaders(role, userId),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async delete<T = any>(endpoint: string, role: 'spectator' | 'referee' | 'admin' = 'admin', userId?: string): Promise<T> {
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: getHeaders(role, userId),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
};

/**
 * Real-time event subscription with automatic SSE fallback and WebSocket connection
 */
export function subscribeToLiveEvents(onEvent: (data: any) => void) {
  let ws: WebSocket | null = null;
  let sse: EventSource | null = null;

  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        onEvent(payload);
      } catch {}
    };

    ws.onerror = () => {
      // Fallback to SSE
      if (!sse) {
        sse = new EventSource('/api/events');
        sse.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data);
            onEvent(payload);
          } catch {}
        };
      }
    };
  } catch {
    // SSE fallback
    try {
      sse = new EventSource('/api/events');
      sse.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          onEvent(payload);
        } catch {}
      };
    } catch {}
  }

  return () => {
    if (ws) ws.close();
    if (sse) sse.close();
  };
}
