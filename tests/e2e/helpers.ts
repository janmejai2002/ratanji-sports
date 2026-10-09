/**
 * E2E Test Helpers & Opaque-Box Client
 * Ratanji Digital Sports Management & Scoring System
 */

import assert from 'node:assert/strict';

export const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
export const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:3001/ws';

export interface RoleHeaders {
  'x-user-role'?: 'spectator' | 'referee' | 'admin';
  'x-user-id'?: string;
  'Content-Type'?: string;
  [key: string]: string | undefined;
}

export const ADMIN_HEADERS: RoleHeaders = {
  'x-user-role': 'admin',
  'x-user-id': 'admin-1',
  'Content-Type': 'application/json',
};

export function REFEREE_HEADERS(refereeId: string = 'ref-1'): RoleHeaders {
  return {
    'x-user-role': 'referee',
    'x-user-id': refereeId,
    'Content-Type': 'application/json',
  };
}

export const SPECTATOR_HEADERS: RoleHeaders = {
  'x-user-role': 'spectator',
  'x-user-id': 'spec-1',
  'Content-Type': 'application/json',
};

export const ANONYMOUS_HEADERS: RoleHeaders = {
  'Content-Type': 'application/json',
};

export interface ApiResponse<T = any> {
  status: number;
  ok: boolean;
  data: T;
  headers: Headers;
  rawText: string;
}

export async function request<T = any>(
  path: string,
  options: {
    method?: string;
    headers?: RoleHeaders;
    body?: any;
    timeoutMs?: number;
  } = {}
): Promise<ApiResponse<T>> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const method = options.method || 'GET';
  const headers = { ...options.headers };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 10000);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: headers as Record<string, string>,
      signal: controller.signal,
    };

    if (options.body !== undefined) {
      if (typeof options.body === 'string') {
        fetchOptions.body = options.body;
      } else {
        if (!fetchOptions.headers) fetchOptions.headers = {};
        (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(options.body);
      }
    }

    const res = await fetch(url, fetchOptions);
    const rawText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    return {
      status: res.status,
      ok: res.ok,
      data,
      headers: res.headers,
      rawText,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T = any>(path: string, headers?: RoleHeaders) => request<T>(path, { method: 'GET', headers }),
  post: <T = any>(path: string, body?: any, headers?: RoleHeaders) => request<T>(path, { method: 'POST', body, headers }),
  put: <T = any>(path: string, body?: any, headers?: RoleHeaders) => request<T>(path, { method: 'PUT', body, headers }),
  delete: <T = any>(path: string, headers?: RoleHeaders) => request<T>(path, { method: 'DELETE', headers }),
};

/**
 * WebSocket test client helper
 */
export class WebSocketClient {
  private ws: any = null;
  public messages: any[] = [];
  private messageResolvers: ((msg: any) => void)[] = [];

  constructor(private url: string = WS_URL) {}

  async connect(timeoutMs: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`WebSocket connection timeout after ${timeoutMs}ms to ${this.url}`));
      }, timeoutMs);

      try {
        // Node 21+ has global WebSocket
        const WS = (globalThis as any).WebSocket;
        if (!WS) {
          clearTimeout(timer);
          // In environments without WebSocket client, simulate gracefully
          resolve();
          return;
        }

        this.ws = new WS(this.url);

        this.ws.onopen = () => {
          clearTimeout(timer);
          resolve();
        };

        this.ws.onerror = (err: any) => {
          clearTimeout(timer);
          reject(err);
        };

        this.ws.onmessage = (event: any) => {
          let payload: any = event.data;
          try {
            payload = JSON.parse(event.data);
          } catch {
            // keep raw
          }
          this.messages.push(payload);
          const resolver = this.messageResolvers.shift();
          if (resolver) {
            resolver(payload);
          }
        };
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  async waitForMessage(predicate?: (msg: any) => boolean, timeoutMs: number = 5000): Promise<any> {
    // Check existing messages first
    if (predicate) {
      const existing = this.messages.find(predicate);
      if (existing) return existing;
    } else if (this.messages.length > 0) {
      return this.messages[this.messages.length - 1];
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for WebSocket message after ${timeoutMs}ms`));
      }, timeoutMs);

      const checkOrQueue = (msg: any) => {
        if (!predicate || predicate(msg)) {
          clearTimeout(timer);
          resolve(msg);
        } else {
          this.messageResolvers.push(checkOrQueue);
        }
      };

      this.messageResolvers.push(checkOrQueue);
    });
  }

  close(): void {
    if (this.ws && typeof this.ws.close === 'function') {
      try {
        this.ws.close();
      } catch {}
    }
  }
}

export interface TestCase {
  suite: string;
  name: string;
  fn: () => void | Promise<void>;
}

export const testRegistry: TestCase[] = [];
const suiteStack: string[] = [];

export const describe = (globalThis as any).describe || ((name: string, fn: () => void) => {
  suiteStack.push(name);
  try {
    fn();
  } finally {
    suiteStack.pop();
  }
});

export const it = (globalThis as any).it || (globalThis as any).test || ((name: string, fn: () => void | Promise<void>) => {
  testRegistry.push({
    suite: suiteStack.join(' > '),
    name,
    fn,
  });
});

export async function runTestRegistry(): Promise<{ passed: number; failed: number; total: number }> {
  let passed = 0;
  let failed = 0;
  let lastSuite = '';

  for (const t of testRegistry) {
    if (t.suite !== lastSuite) {
      console.log(`\n--- [SUITE] ${t.suite} ---`);
      lastSuite = t.suite;
    }

    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${t.name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Summary: Total: ${testRegistry.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`========================================\n`);

  return { passed, failed, total: testRegistry.length };
}

export const beforeAll = (globalThis as any).beforeAll || (async (fn: () => void | Promise<void>) => {});
export const afterAll = (globalThis as any).afterAll || (async (fn: () => void | Promise<void>) => {});
export const beforeEach = (globalThis as any).beforeEach || (async (fn: () => void | Promise<void>) => {});
export const afterEach = (globalThis as any).afterEach || (async (fn: () => void | Promise<void>) => {});

export const expect = (globalThis as any).expect || ((actual: any) => ({
  toBe(expected: any) {
    assert.strictEqual(actual, expected);
  },
  toEqual(expected: any) {
    assert.deepStrictEqual(actual, expected);
  },
  toBeGreaterThan(expected: number) {
    assert.ok(actual > expected, `Expected ${actual} to be > ${expected}`);
  },
  toBeGreaterThanOrEqual(expected: number) {
    assert.ok(actual >= expected, `Expected ${actual} to be >= ${expected}`);
  },
  toBeLessThan(expected: number) {
    assert.ok(actual < expected, `Expected ${actual} to be < ${expected}`);
  },
  toBeLessThanOrEqual(expected: number) {
    assert.ok(actual <= expected, `Expected ${actual} to be <= ${expected}`);
  },
  toContain(expected: any) {
    if (typeof actual === 'string' || Array.isArray(actual)) {
      assert.ok(actual.includes(expected), `Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`);
    } else {
      assert.ok(expected in actual, `Expected key ${expected} in object`);
    }
  },
  toBeDefined() {
    assert.notStrictEqual(actual, undefined);
  },
  toBeUndefined() {
    assert.strictEqual(actual, undefined);
  },
  toBeTruthy() {
    assert.ok(Boolean(actual));
  },
  toBeFalsy() {
    assert.ok(!actual);
  },
  toHaveLength(expected: number) {
    assert.strictEqual(actual.length, expected);
  },
  toMatch(pattern: RegExp) {
    assert.match(String(actual), pattern);
  },
}));

/**
 * Deterministic Polling Helper
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (val: T) => boolean,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const val = await fn();
    if (predicate(val)) return val;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Polling timed out after ${timeoutMs}ms`);
}
