import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env["SQL_HOST"],
      user: process.env["SQL_USER"],
      password: process.env["SQL_PASSWORD"],
      database: process.env["SQL_DB_NAME"],
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};

let db: ReturnType<typeof drizzle<typeof schema>>;
try {
  if (process.env["SQL_HOST"] && process.env["SQL_USER"] && process.env["SQL_PASSWORD"]) {
    const pool = createPool();
    db = drizzle(pool, { schema });
  } else {
    throw new Error("Missing SQL environment variables");
  }
} catch {
  console.warn("[AI Studio] Database not connected — using mock");
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: unknown) =>
      d && typeof d === "object" && "data" in d ? (d as { data: unknown }).data : {},
    update: async (d: unknown) =>
      d && typeof d === "object" && "data" in d ? (d as { data: unknown }).data : {},
    delete: async () => ({}),
  };
  db = new Proxy(
    {},
    {
      get: (_, prop) =>
        prop === "query"
          ? new Proxy({}, { get: () => noOp })
          : prop === "select"
            ? () => ({
                from: () => ({
                  orderBy: async () => [],
                  where: async () => [],
                  then: (fn: (arg: unknown[]) => unknown) => Promise.resolve([]).then(fn),
                }),
                then: (fn: (arg: unknown[]) => unknown) => Promise.resolve([]).then(fn),
              })
            : prop === "insert"
              ? () => ({
                  values: () => ({
                    onConflictDoUpdate: async () => ({}),
                    onConflictDoNothing: async () => ({}),
                    then: (fn: (arg: unknown) => unknown) => Promise.resolve({}).then(fn),
                  }),
                })
              : async () => [],
    },
  ) as unknown as ReturnType<typeof drizzle<typeof schema>>;
}

export { db, schema };
