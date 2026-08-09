const { sql } = require('./db');

/**
 * Best-effort activity log insert. Never throws — a logging failure must
 * never fail the mutation it's describing. Never pass secrets/passwords in
 * `description` (this table has no special access control beyond the admin
 * session gating every route that reads it).
 */
async function logActivity({ action, entityType, entityId, description, adminEmail }) {
  try {
    await sql`
      INSERT INTO activity_logs (action, entity_type, entity_id, description, admin_email)
      VALUES (${action}, ${entityType}, ${entityId != null ? String(entityId) : null}, ${description}, ${adminEmail || null})
    `;
  } catch (e) {
    // swallow — activity logging is observability, not a correctness requirement
  }
}

module.exports = { logActivity };
