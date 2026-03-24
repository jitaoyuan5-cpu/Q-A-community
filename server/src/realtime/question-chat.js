import { WebSocketServer } from "ws";
import { pool } from "../db/pool.js";
import { verifyAccessToken } from "../utils/crypto.js";

let upgradeHandlerRegistered = false;
const roomSockets = new Map();
const roomPresence = new Map();

const sendJson = (socket, payload) => {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(payload));
  }
};

const mapMessageRow = (row) => ({
  id: row.id,
  questionId: row.question_id,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  author: {
    id: row.user_id,
    name: row.author_name,
    avatar: row.author_avatar,
  },
});

const getSockets = (questionId) => {
  const key = String(questionId);
  if (!roomSockets.has(key)) roomSockets.set(key, new Set());
  return roomSockets.get(key);
};

const getPresence = (questionId) => {
  const key = String(questionId);
  if (!roomPresence.has(key)) roomPresence.set(key, new Map());
  return roomPresence.get(key);
};

export const getOnlineCount = (questionId) => getPresence(questionId).size;

const broadcastPresence = (questionId) => {
  const sockets = getSockets(questionId);
  const onlineCount = getOnlineCount(questionId);
  for (const socket of sockets) {
    sendJson(socket, { type: "presence", onlineCount });
  }
};

const loadMessage = async (messageId) => {
  const [rows] = await pool.query(
    `SELECT m.id, m.question_id, m.content, m.created_at, m.updated_at, m.user_id,
            u.name AS author_name, u.avatar AS author_avatar
     FROM question_chat_messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.id = ? AND m.is_hidden = 0
     LIMIT 1`,
    [messageId],
  );
  return rows.length ? mapMessageRow(rows[0]) : null;
};

export const broadcastQuestionChatMessage = async (questionId, messageId) => {
  const message = await loadMessage(messageId);
  if (!message) return;
  for (const socket of getSockets(questionId)) {
    sendJson(socket, { type: "message", message });
  }
};

export const attachQuestionChatServer = (server) => {
  if (upgradeHandlerRegistered) return;
  upgradeHandlerRegistered = true;

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "", "http://localhost");
    const match = url.pathname.match(/^\/ws\/questions\/(\d+)\/chat$/);
    if (!match) return;

    const token = url.searchParams.get("token");
    if (!token) {
      socket.destroy();
      return;
    }

    let auth;
    try {
      auth = verifyAccessToken(token);
    } catch {
      socket.destroy();
      return;
    }

    const questionId = Number(match[1]);
    if (!questionId) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.questionId = questionId;
      ws.userId = auth.userId;
      wss.emit("connection", ws);
    });
  });

  wss.on("connection", async (socket) => {
    const [rows] = await pool.query("SELECT id, name, avatar FROM users WHERE id = ? LIMIT 1", [socket.userId]);
    if (!rows.length) {
      socket.close();
      return;
    }

    getSockets(socket.questionId).add(socket);
    getPresence(socket.questionId).set(socket.userId, {
      id: rows[0].id,
      name: rows[0].name,
      avatar: rows[0].avatar,
    });

    sendJson(socket, { type: "presence", onlineCount: getOnlineCount(socket.questionId) });
    broadcastPresence(socket.questionId);

    socket.on("message", (raw) => {
      try {
        const payload = JSON.parse(String(raw));
        if (payload?.type === "ping") {
          sendJson(socket, { type: "pong" });
        }
      } catch {
        // ignore malformed payloads
      }
    });

    socket.on("close", () => {
      getSockets(socket.questionId).delete(socket);
      const stillOnline = [...getSockets(socket.questionId)].some((item) => item.userId === socket.userId);
      if (!stillOnline) {
        getPresence(socket.questionId).delete(socket.userId);
      }
      broadcastPresence(socket.questionId);
    });
  });
};
