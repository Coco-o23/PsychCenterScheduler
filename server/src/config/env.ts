import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

export type NodeEnv = 'development' | 'test' | 'production';

export interface ServerEnv {
  database: DatabaseEnv;
  nodeEnv: NodeEnv;
  port: number;
}

export interface DatabaseEnv {
  database: string;
  host: string;
  password: string;
  port: number;
  user: string;
}

const envFilePath = path.resolve(process.cwd(), '.env');
const requiredNonEmptyEnvKeys = ['NODE_ENV', 'PORT', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'] as const;
const requiredEnvKeys = [...requiredNonEmptyEnvKeys, 'DB_PASSWORD'] as const;

function ensureEnvFileExists(): void {
  if (!fs.existsSync(envFilePath)) {
    throw new Error(
      'Missing required server/.env file. Create server/.env from server/.env.example before starting the backend.',
    );
  }
}

function requireEnvValue(key: (typeof requiredNonEmptyEnvKeys)[number]): string {
  const value = process.env[key];

  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}. Check server/.env.`);
  }

  return value;
}

function requireEnvKey(key: (typeof requiredEnvKeys)[number]): string {
  if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
    throw new Error(`Missing required environment variable: ${key}. Check server/.env.`);
  }

  return process.env[key] ?? '';
}

function parseNodeEnv(value: string): NodeEnv {
  if (value === 'development' || value === 'test' || value === 'production') {
    return value;
  }

  throw new Error('Invalid NODE_ENV. Expected development, test, or production.');
}

function parsePort(value: string): number {
  const parsedPort = Number(value);

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error('Invalid PORT. Expected an integer between 1 and 65535.');
  }

  return parsedPort;
}

export function loadEnv(): ServerEnv {
  ensureEnvFileExists();
  dotenv.config({ path: envFilePath });

  return {
    database: {
      database: requireEnvValue('DB_NAME'),
      host: requireEnvValue('DB_HOST'),
      password: requireEnvKey('DB_PASSWORD'),
      port: parsePort(requireEnvValue('DB_PORT')),
      user: requireEnvValue('DB_USER'),
    },
    nodeEnv: parseNodeEnv(requireEnvValue('NODE_ENV')),
    port: parsePort(requireEnvValue('PORT')),
  };
}
