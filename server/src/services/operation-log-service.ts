import type { Pool } from 'mysql2/promise';
import {
  CreateOperationLogInput,
  insertOperationLog,
} from '../repositories/operation-log-repository';

export interface WriteOperationLogInput extends CreateOperationLogInput {}

export async function writeOperationLog(
  pool: Pool,
  input: WriteOperationLogInput,
): Promise<number> {
  return insertOperationLog(pool, input);
}
