import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.resolve(__dirname, 'temp_stress');
const DB_PATH = path.resolve(TEMP_DIR, 'worker_concurrency.db');

// WORKER THREAD LOGIC
if (!isMainThread) {
  const { role, id, totalOps } = workerData;
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  try {
    if (role === 'writer') {
      for (let i = 0; i < totalOps; i++) {
        try {
          db.exec('BEGIN IMMEDIATE;');
          db.prepare(`
            INSERT INTO events_log (worker_id, op_index, payload)
            VALUES (?, ?, ?)
          `).run(id, i, JSON.stringify({ worker: id, op: i, timestamp: Date.now() }));
          db.exec('COMMIT;');
          successCount++;
        } catch (err: any) {
          try { db.exec('ROLLBACK;'); } catch {}
          errorCount++;
          errors.push(err.message);
        }
      }
    } else if (role === 'reader') {
      for (let i = 0; i < totalOps; i++) {
        try {
          const row = db.prepare('SELECT count(*) as count FROM events_log').get() as { count: number };
          if (row && typeof row.count === 'number') {
            successCount++;
          }
        } catch (err: any) {
          errorCount++;
          errors.push(err.message);
        }
      }
    }
  } finally {
    db.close();
  }

  parentPort?.postMessage({ id, role, successCount, errorCount, errors });
  process.exit(0);
}

// MAIN THREAD LOGIC
async function runMultiThreadStress() {
  console.log('--- STARTING MULTI-THREAD CONCURRENCY STRESS TEST ---');
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  // Clean DB files
  for (const ext of ['', '-wal', '-shm']) {
    const f = DB_PATH + ext;
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch {}
    }
  }

  // Init DB and table
  const initDb = new DatabaseSync(DB_PATH);
  initDb.exec('PRAGMA journal_mode = WAL;');
  initDb.exec('PRAGMA busy_timeout = 5000;');
  initDb.exec(`
    CREATE TABLE events_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id TEXT,
      op_index INTEGER,
      payload TEXT
    );
  `);
  initDb.close();

  const numWriters = 2;
  const numReaders = 4;
  const opsPerWriter = 100;
  const opsPerReader = 300;

  console.log(`Spawning ${numWriters} Writer workers (${opsPerWriter} ops each) and ${numReaders} Reader workers (${opsPerReader} ops each)...`);

  const workerPromises: Promise<any>[] = [];

  // Start writers
  for (let w = 0; w < numWriters; w++) {
    const p = new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { role: 'writer', id: `writer-${w}`, totalOps: opsPerWriter },
        execArgv: ['--import', 'tsx'],
      });
      worker.on('message', resolve);
      worker.on('error', reject);
    });
    workerPromises.push(p);
  }

  // Start readers
  for (let r = 0; r < numReaders; r++) {
    const p = new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { role: 'reader', id: `reader-${r}`, totalOps: opsPerReader },
        execArgv: ['--import', 'tsx'],
      });
      worker.on('message', resolve);
      worker.on('error', reject);
    });
    workerPromises.push(p);
  }

  const results = await Promise.all(workerPromises);
  console.log('All worker threads finished execution. Results summary:');

  let totalWriterSuccess = 0;
  let totalWriterErrors = 0;
  let totalReaderSuccess = 0;
  let totalReaderErrors = 0;

  for (const res of results) {
    console.log(` Worker ${res.id} (${res.role}): success=${res.successCount}, errors=${res.errorCount}`);
    if (res.errors.length > 0) {
      console.log(`   Sample error: ${res.errors[0]}`);
    }
    if (res.role === 'writer') {
      totalWriterSuccess += res.successCount;
      totalWriterErrors += res.errorCount;
    } else {
      totalReaderSuccess += res.successCount;
      totalReaderErrors += res.errorCount;
    }
  }

  // Verify DB state
  const verifyDb = new DatabaseSync(DB_PATH);
  const totalRows = (verifyDb.prepare('SELECT count(*) as count FROM events_log').get() as { count: number }).count;
  verifyDb.close();

  console.log(`Verification: Total events in DB = ${totalRows} (Expected: ${numWriters * opsPerWriter})`);
  console.log(`Writers: ${totalWriterSuccess} successes, ${totalWriterErrors} errors`);
  console.log(`Readers: ${totalReaderSuccess} successes, ${totalReaderErrors} errors`);

  // Cleanup
  for (const ext of ['', '-wal', '-shm']) {
    const f = DB_PATH + ext;
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch {}
    }
  }

  return {
    totalRows,
    expectedRows: numWriters * opsPerWriter,
    totalWriterSuccess,
    totalWriterErrors,
    totalReaderSuccess,
    totalReaderErrors,
  };
}

if (isMainThread) {
  runMultiThreadStress().then((res) => {
    console.log('Multi-thread stress test completed successfully:', res);
    process.exit(0);
  }).catch((err) => {
    console.error('Multi-thread stress test failed:', err);
    process.exit(1);
  });
}
