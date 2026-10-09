import { startServer, stopServer } from '../../server/index.js';
import { getDatabase } from '../../server/db/client.js';
import { initSchema } from '../../server/db/schema.js';
import { seedDatabase } from '../../server/db/seed.js';

let serverStartedByTest = false;

export async function setup() {
  // Check if port 3001 is already listening
  try {
    const res = await fetch('http://localhost:3001/api/health', {
      signal: AbortSignal.timeout(500),
    });
    if (res.ok) {
      console.log('[Test Setup] Reusing existing server listening on :3001 - Re-seeding database...');
      const dbClient = getDatabase();
      initSchema(dbClient);
      seedDatabase(dbClient, { clean: true });
      return;
    }
  } catch {}

  // Initialize DB schema & seed in server instance
  const dbClient = getDatabase();
  initSchema(dbClient);
  seedDatabase(dbClient, { clean: true });

  // Start Express server on 3001
  await startServer(3001);
  serverStartedByTest = true;
  console.log('[Test Setup] Express test server online at http://localhost:3001');
}

export async function teardown() {
  if (serverStartedByTest) {
    await stopServer();
    console.log('[Test Teardown] Express test server closed cleanly');
  }
}

export default async function () {
  await setup();
  return async () => {
    await teardown();
  };
}
