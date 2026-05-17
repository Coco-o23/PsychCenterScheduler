import mysql, { Pool } from 'mysql2/promise';
import type { DatabaseEnv } from '../config/env';

let pool: Pool | null = null;

export interface DatabaseConnectionSummary {
  database: string;
  host: string;
  port: number;
  user: string;
}

function toConnectionSummary(config: DatabaseEnv): DatabaseConnectionSummary {
  return {
    database: config.database,
    host: config.host,
    port: config.port,
    user: config.user,
  };
}

export function getDatabasePool(config: DatabaseEnv): Pool {
  if (!pool) {
    pool = mysql.createPool({
      database: config.database,
      host: config.host,
      password: config.password,
      port: config.port,
      user: config.user,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  return pool;
}

export async function checkDatabaseConnection(
  config: DatabaseEnv,
): Promise<DatabaseConnectionSummary> {
  const connection = await getDatabasePool(config).getConnection();

  try {
    await connection.ping();
    return toConnectionSummary(config);
  } finally {
    connection.release();
  }
}

export async function closeDatabasePool(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
}
