import { pool } from "../db/pool.js";

export const notificationTypes = {
  newAnswer: "new_answer",
  newComment: "new_comment",
  answerAccepted: "answer_accepted",
  followUpdate: "follow_update",
};

const preferenceColumnByType = {
  [notificationTypes.newAnswer]: "notify_new_answer",
  [notificationTypes.newComment]: "notify_new_comment",
  [notificationTypes.answerAccepted]: "notify_answer_accepted",
  [notificationTypes.followUpdate]: "notify_follow_update",
};

const defaultPreferences = {
  emailEnabled: true,
  notifyNewAnswer: true,
  notifyNewComment: true,
  notifyAnswerAccepted: true,
  notifyFollowUpdate: true,
};

const toPreferenceDto = (row) => ({
  emailEnabled: Boolean(row?.email_enabled ?? 1),
  notifyNewAnswer: Boolean(row?.notify_new_answer ?? 1),
  notifyNewComment: Boolean(row?.notify_new_comment ?? 1),
  notifyAnswerAccepted: Boolean(row?.notify_answer_accepted ?? 1),
  notifyFollowUpdate: Boolean(row?.notify_follow_update ?? 1),
});

export const ensureUserPreferences = async (conn, userId) => {
  await conn.query("INSERT IGNORE INTO user_notification_preferences (user_id) VALUES (?)", [userId]);
};

export const getUserPreferences = async (conn, userId) => {
  await ensureUserPreferences(conn, userId);
  const [rows] = await conn.query("SELECT * FROM user_notification_preferences WHERE user_id = ? LIMIT 1", [userId]);
  return rows.length ? toPreferenceDto(rows[0]) : defaultPreferences;
};

export const createNotification = async (
  conn,
  { userId, actorId = null, type, targetType, targetId, title, body = "", link },
) => {
  if (!userId) return false;
  const [result] = await conn.query(
    `INSERT INTO notifications (user_id, actor_id, type, target_type, target_id, title, body, link)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, actorId, type, targetType, targetId, title, body, link],
  );
  return result.insertId;
};

export const shouldSendEmailForType = async (conn, userId, type) => {
  const prefs = await getUserPreferences(conn, userId);
  if (!prefs.emailEnabled) return false;
  const column = preferenceColumnByType[type];
  if (!column) return false;
  const [rows] = await conn.query(`SELECT ${column} AS enabled FROM user_notification_preferences WHERE user_id = ? LIMIT 1`, [userId]);
  return Boolean(rows[0]?.enabled ?? 1);
};

export const mapNotificationRow = (row) => ({
  id: row.id,
  type: row.type,
  targetType: row.target_type,
  targetId: row.target_id,
  title: row.title,
  body: row.body,
  link: row.link,
  isRead: Boolean(row.is_read),
  createdAt: row.created_at,
  readAt: row.read_at,
  actor: row.actor_id
    ? {
        id: row.actor_id,
        name: row.actor_name,
        avatar: row.actor_avatar,
      }
    : null,
});

export const getUnreadNotificationCount = async (userId) => {
  const [rows] = await pool.query("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0", [userId]);
  return Number(rows[0]?.count || 0);
};
