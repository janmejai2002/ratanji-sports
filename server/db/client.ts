import { DatabaseSync, StatementSync } from 'node:sqlite';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface DatabaseOptions {
  path?: string;
  enableWal?: boolean;
  enableForeignKeys?: boolean;
  busyTimeout?: number;
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export type QueryParams = any[] | Record<string, any>;

/**
 * Coerce values into SQLite-compatible types:
 * - undefined -> null
 * - boolean -> 1 or 0
 * - Date -> ISO string
 */
function sanitizeParam(val: any): any {
  if (val === undefined) {
    return null;
  }
  if (typeof val === 'boolean') {
    return val ? 1 : 0;
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  return val;
}

/**
 * Sanitize parameter lists or parameter dictionaries for node:sqlite StatementSync bindings.
 */
function sanitizeParams(params?: QueryParams): any {
  if (params === undefined || params === null) {
    return undefined;
  }
  if (Array.isArray(params)) {
    return params.map(sanitizeParam);
  }
  if (typeof params === 'object' && !ArrayBuffer.isView(params) && !(params instanceof ArrayBuffer)) {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(params)) {
      sanitized[key] = sanitizeParam(val);
    }
    return sanitized;
  }
  return sanitizeParam(params);
}

/**
 * DatabaseClient wraps Node 24 native node:sqlite DatabaseSync with:
 * - WAL mode and Foreign Keys enabled by default
 * - Support for persistent file and in-memory (:memory:) modes
 * - Parameterized query runners (query, queryOne, execute) with parameter sanitization
 * - Safe nested transaction support using SQLite SAVEPOINTs with async guard
 */
export class DatabaseClient {
  public raw: DatabaseSync;
  public readonly location: string;
  private savepointDepth: number = 0;

  constructor(location: string = ':memory:', options: DatabaseOptions = {}) {
    this.location = location;

    if (location !== ':memory:') {
      const dir = path.dirname(path.resolve(location));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.raw = new DatabaseSync(location);

    if (options.enableForeignKeys !== false) {
      this.raw.exec('PRAGMA foreign_keys = ON;');
    }

    if (options.enableWal !== false && location !== ':memory:') {
      this.raw.exec('PRAGMA journal_mode = WAL;');
    }

    const busyTimeout = options.busyTimeout ?? 5000;
    if (busyTimeout >= 0) {
      this.raw.exec(`PRAGMA busy_timeout = ${busyTimeout};`);
    }
  }

  /**
   * Execute a query returning all rows.
   */
  public query<T = any>(sql: string, params?: QueryParams): T[] {
    const stmt = this.raw.prepare(sql);
    if (params === undefined || params === null) {
      return stmt.all() as T[];
    }
    const cleanParams = sanitizeParams(params);
    if (Array.isArray(cleanParams)) {
      return stmt.all(...cleanParams) as T[];
    }
    return stmt.all(cleanParams) as T[];
  }

  /**
   * Execute a query returning the first row, or null if no matching row is found.
   */
  public queryOne<T = any>(sql: string, params?: QueryParams): T | null {
    const stmt = this.raw.prepare(sql);
    let row: any;
    if (params === undefined || params === null) {
      row = stmt.get();
    } else {
      const cleanParams = sanitizeParams(params);
      if (Array.isArray(cleanParams)) {
        row = stmt.get(...cleanParams);
      } else {
        row = stmt.get(cleanParams);
      }
    }
    return (row === undefined ? null : row) as T | null;
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE statement.
   */
  public execute(sql: string, params?: QueryParams): RunResult {
    const stmt = this.raw.prepare(sql);
    if (params === undefined || params === null) {
      return stmt.run();
    }
    const cleanParams = sanitizeParams(params);
    if (Array.isArray(cleanParams)) {
      return stmt.run(...cleanParams);
    }
    return stmt.run(cleanParams);
  }

  /**
   * Execute raw SQL statements (supports multi-statement DDL scripts).
   */
  public exec(sql: string): void {
    this.raw.exec(sql);
  }

  /**
   * Prepare a raw StatementSync if direct statement manipulation is needed.
   */
  public prepare(sql: string): StatementSync {
    return this.raw.prepare(sql);
  }

  /**
   * Execute a callback inside an atomic transaction.
   * Utilizes SAVEPOINT to safely support nested transactions across services.
   * Throws if an async callback is passed to prevent premature release.
   */
  public transaction<T>(fn: (client: DatabaseClient) => T): T {
    const sp = 'sp_' + (++this.savepointDepth);
    this.raw.exec(`SAVEPOINT ${sp}`);
    try {
      const result = fn(this);
      if (result !== null && (typeof result === 'object' || typeof result === 'function') && typeof (result as any).then === 'function') {
        throw new Error(
          'DatabaseClient.transaction: Async callbacks are not supported. Use synchronous callbacks to prevent premature commit.'
        );
      }
      this.raw.exec(`RELEASE ${sp}`);
      return result;
    } catch (err) {
      try {
        this.raw.exec(`ROLLBACK TO ${sp}`);
        this.raw.exec(`RELEASE ${sp}`);
      } catch {
        // preserve original error if rollback/release fails
      }
      throw err;
    } finally {
      this.savepointDepth--;
    }
  }

  /**
   * Close the database connection.
   */
  public close(): void {
    this.raw.close();
  }
}

function resolveDefaultLocation(): string {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== 'file::memory:') {
    return process.env.DATABASE_URL;
  }
  if (process.env.NODE_ENV === 'test') {
    return ':memory:';
  }
  return path.resolve(process.cwd(), 'ratanji.db');
}

let defaultClient: DatabaseClient | null = null;

export function createDatabase(options?: DatabaseOptions): DatabaseClient {
  const location = options?.path ?? resolveDefaultLocation();
  return new DatabaseClient(location, options);
}

export function getDatabase(options?: DatabaseOptions): DatabaseClient {
  if (!defaultClient) {
    defaultClient = createDatabase(options);
  }
  return defaultClient;
}

export function resetDatabase(newClient?: DatabaseClient): void {
  if (defaultClient) {
    try {
      defaultClient.close();
    } catch {
      // ignore close errors on teardown
    }
    defaultClient = null;
  }
  if (newClient) {
    defaultClient = newClient;
  }
}

export const db = getDatabase();
export default db;
