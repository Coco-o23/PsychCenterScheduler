import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export interface CreateNotificationInput {
  recipientUserId: number;
  type: string;
  title: string;
  content: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
}

interface NotificationRow extends RowDataPacket {
  notification_id: number;
  type: string;
  title: string;
  content: string;
  related_entity_type: string | null;
  related_entity_id: number | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationRecord {
  notificationId: number;
  type: string;
  title: string;
  content: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  readAt: string | null;
  createdAt: string;
}

function mapNotificationRow(row: NotificationRow): NotificationRecord {
  return {
    notificationId: row.notification_id,
    type: row.type,
    title: row.title,
    content: row.content,
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function insertNotification(
  pool: Pool,
  input: CreateNotificationInput,
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `
      INSERT INTO notifications (
        recipient_user_id,
        type,
        title,
        content,
        related_entity_type,
        related_entity_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      input.recipientUserId,
      input.type,
      input.title,
      input.content,
      input.relatedEntityType,
      input.relatedEntityId,
    ],
  );

  return result.insertId;
}

export async function listNotifications(
  pool: Pool,
  recipientUserId: number,
  limit = 50,
): Promise<NotificationRecord[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const [rows] = await pool.query<NotificationRow[]>(
    `
      SELECT
        notification_id,
        type,
        title,
        content,
        related_entity_type,
        related_entity_id,
        DATE_FORMAT(read_at, '%Y-%m-%dT%H:%i:%s') AS read_at,
        DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
      FROM notifications
      WHERE recipient_user_id = ?
      ORDER BY created_at DESC, notification_id DESC
      LIMIT ?
    `,
    [recipientUserId, safeLimit],
  );

  return rows.map(mapNotificationRow);
}

export async function countUnreadNotifications(
  pool: Pool,
  recipientUserId: number,
): Promise<number> {
  const [rows] = await pool.query<Array<RowDataPacket & { unread_count: number }>>(
    `
      SELECT COUNT(*) AS unread_count
      FROM notifications
      WHERE recipient_user_id = ?
        AND read_at IS NULL
    `,
    [recipientUserId],
  );

  return rows[0]?.unread_count ?? 0;
}

export async function markNotificationRead(
  pool: Pool,
  recipientUserId: number,
  notificationId: number,
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `
      UPDATE notifications
      SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
      WHERE notification_id = ?
        AND recipient_user_id = ?
    `,
    [notificationId, recipientUserId],
  );

  return result.affectedRows > 0;
}
