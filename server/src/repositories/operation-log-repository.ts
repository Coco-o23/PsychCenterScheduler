import type { Pool, ResultSetHeader } from 'mysql2/promise';

export interface CreateOperationLogInput {
  actorUserId: number | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  result: 'success' | 'failed';
  detail: string | null;
}

export async function insertOperationLog(
  pool: Pool,
  input: CreateOperationLogInput,
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `
      INSERT INTO operation_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        result,
        detail
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      input.actorUserId,
      input.action,
      input.entityType,
      input.entityId,
      input.result,
      input.detail,
    ],
  );

  return result.insertId;
}
