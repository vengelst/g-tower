import { query } from '../config/database.js';

export async function createAuditLog(
  userId: string | null,
  userEmail: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  oldValues: unknown | null,
  newValues: unknown | null,
  ip: string | null
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (user_id, user_email, action, entity_type, entity_id, old_values, new_values, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId, userEmail, action, entityType, entityId,
       oldValues ? JSON.stringify(oldValues) : null,
       newValues ? JSON.stringify(newValues) : null,
       ip]
    );
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}
