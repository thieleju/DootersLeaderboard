import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  client: Client | undefined;
};

const databaseUrl =
  process.env.DATABASE_URL ?? "file:/tmp/dootersleaderboard-build.sqlite";

export const client = globalForDb.client ?? createClient({ url: databaseUrl });
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

if (databaseUrl.startsWith("file:")) {
  // Reduce lock contention between Next + Bot processes on local sqlite files.
  void client.execute("PRAGMA journal_mode = WAL").catch(() => undefined);
  void client.execute("PRAGMA busy_timeout = 5000").catch(() => undefined);
}

export const db = drizzle(client, { schema });
