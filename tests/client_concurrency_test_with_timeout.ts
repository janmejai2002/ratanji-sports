import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { DatabaseClient } from '../server/db/client.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.resolve(__dirname, 'temp_client_timeout_stress');
const DB_PATH = path.resolve(TEMP_DIR, 'client_timeout_concurrency.db');

if (!isMainThread) {
  const { role, id, totalOps } = workerData;
  const db = new DatabaseClient(DB_PATH);
  // Setting busy timeout
  db.raw.exec('PRAGMA busy_timeout = 5000;');

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  try {
    if (role === 'writer') {
      for (let i = 0; i < totalOps; i++) {
        try {
          db.transaction((tx) => {
            tx.execute(
              'INSERT INTO client_events (worker_id, op_index) VALUES (?, ?)',
              [id, i]
            );
          });
          successCount++;
        } catch (err: any) {
          errorCount++;
          errors.push(err.message);
        }
      }
    } else if (role === 'reader') {
      for (let i = 0; i < totalOps; i++) {
        try {
          const row = db.queryOne<{ count: number }>('SELECT count(*) as count FROM client_events');
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

async function testClientTimeoutConcurrency() {
  console.log('--- TESTING DatabaseClient CONCURRENCY WITH BUSY_TIMEOUT ---');
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  for (const ext of ['', '-wal', '-shm']) {
    const f = DB_PATH + ext;
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch {}
    }
  }

  // Initialize schema with 1 client
  const setupClient = new DatabaseClient(DB_PATH);
  setupClient.exec(`
    CREATE TABLE client_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id TEXT,
      op_index INTEGER
    );
  `);
  setupClient.close();

  const numWriters = 2;
  const numReaders = 3;
  const opsPerWriter = 50;
  const opsPerReader = 100;

  const workerPromises: Promise<any>[] = [];

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

  let totalWriterSuccess = 0;
  let totalWriterErrors = 0;
  let totalReaderSuccess = 0;
  let totalReaderErrors = 0;
  const allErrors: string[] = [];

  for (const res of results) {
    console.log(`Worker ${res.id} (${res.role}): success=${res.successCount}, errors=${res.errorCount}`);
    if (res.errors.length > 0) {
      console.log(`  Sample error: ${res.errors[0]}`);
      allErrors.push(...res.errors);
    }
    if (res.role === 'writer') {
      totalWriterSuccess += res.successCount;
      totalWriterErrors += res.errorCount;
    } else {
      totalReaderSuccess += res.successCount;
      totalReaderErrors += res.errorCount;
    }
  }

  const verifyClient = new DatabaseClient(DB_PATH);
  const totalRows = verifyClient.queryOne<{ count: number }>('SELECT count(*) as count FROM client_events')?.count;
  verifyClient.close();

  console.log(`Total rows committed: ${totalRows} / ${numWriters * opsPerWriter}`);
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
    totalWriterSuccess,
    totalWriterErrors,
    totalReaderSuccess,
    totalReaderErrors,
    allErrors,
  };
}

if (isMainThread) {
  testClientTimeoutConcurrency().then((res) => {
    console.log('Result:', res);
    process.exit(0);
  }).catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
}
