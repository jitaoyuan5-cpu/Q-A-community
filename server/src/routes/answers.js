import { Router } from "express";
import { pool, withTx } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { createNotification, notificationTypes, shouldSendEmailForType } from "../utils/notifications.js";
import { sendTemplatedEmail } from "../utils/mailer.js";

const router = Router();

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const questionId = Number(req.body.questionId);
    const content = String(req.body.content || "").trim();
    if (!questionId || !content) return res.status(400).json({ message: "Invalid payload" });

    const [questionRows] = await pool.query(
      `SELECT q.id, q.title, q.author_id, u.email AS author_email, u.name AS author_name
       FROM questions q
       JOIN users u ON u.id = q.author_id
       WHERE q.id = ? AND q.is_hidden = 0
       LIMIT 1`,
      [questionId],
    );
    if (!questionRows.length) return res.status(404).json({ message: "Question not found" });
    const question = questionRows[0];

    const [result] = await pool.query("INSERT INTO answers (question_id, author_id, content) VALUES (?, ?, ?)", [questionId, req.user.userId, content]);
    await pool.query("UPDATE questions SET answers_count = answers_count + 1 WHERE id = ?", [questionId]);
    await pool.query("UPDATE follows SET has_new_answers = 1 WHERE question_id = ? AND user_id <> ?", [questionId, req.user.userId]);

    if (question.author_id !== req.user.userId) {
      await createNotification(pool, {
        userId: question.author_id,
        actorId: req.user.userId,
        type: notificationTypes.newAnswer,
        targetType: "question",
        targetId: questionId,
        title: "你的问题收到了新回答",
        body: question.title,
        link: `/question/${questionId}`,
      });
      if (await shouldSendEmailForType(pool, question.author_id, notificationTypes.newAnswer)) {
        await sendTemplatedEmail({
          to: question.author_email,
          subject: "问答社区：你的问题收到了新回答",
          text: `问题《${question.title}》有新的回答，访问 /question/${questionId} 查看。`,
        });
      }
    }

    const [followers] = await pool.query(
      `SELECT f.user_id, u.email
       FROM follows f
       JOIN users u ON u.id = f.user_id
       WHERE f.question_id = ? AND f.user_id <> ? AND f.user_id <> ?`,
      [questionId, req.user.userId, question.author_id],
    );
    for (const follower of followers) {
      await createNotification(pool, {
        userId: follower.user_id,
        actorId: req.user.userId,
        type: notificationTypes.followUpdate,
        targetType: "question",
        targetId: questionId,
        title: "你关注的问题有新动态",
        body: question.title,
        link: `/question/${questionId}`,
      });
      if (await shouldSendEmailForType(pool, follower.user_id, notificationTypes.followUpdate)) {
        await sendTemplatedEmail({
          to: follower.email,
          subject: "问答社区：关注的问题有新动态",
          text: `你关注的问题《${question.title}》有新的回答，访问 /question/${questionId} 查看。`,
        });
      }
    }

    res.status(201).json({ id: result.insertId });
  }),
);

router.post(
  "/:id/vote",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const value = Number(req.body.value);
    if (![1, -1].includes(value)) return res.status(400).json({ message: "Invalid vote" });

    const [targetRows] = await pool.query("SELECT id FROM answers WHERE id = ?", [id]);
    if (!targetRows.length) return res.status(404).json({ message: "Answer not found" });

    const [voteRows] = await pool.query(
      "SELECT id, value FROM votes WHERE user_id = ? AND target_type = 'answer' AND target_id = ? LIMIT 1",
      [req.user.userId, id],
    );

    let delta = value;
    if (voteRows.length) {
      const old = voteRows[0].value;
      const next = old === value ? 0 : value;
      delta = next - old;
      if (next === 0) {
        await pool.query("DELETE FROM votes WHERE id = ?", [voteRows[0].id]);
      } else {
        await pool.query("UPDATE votes SET value = ? WHERE id = ?", [next, voteRows[0].id]);
      }
    } else {
      await pool.query("INSERT INTO votes (user_id, target_type, target_id, value) VALUES (?, 'answer', ?, ?)", [req.user.userId, id, value]);
    }

    if (delta !== 0) {
      await pool.query("UPDATE answers SET votes = votes + ? WHERE id = ?", [delta, id]);
    }
    res.json({ success: true });
  }),
);

router.post(
  "/:id/accept",
  requireAuth,
  asyncHandler(async (req, res) => {
    const answerId = Number(req.params.id);
    await withTx(async (conn) => {
      const [rows] = await conn.query(
        `SELECT a.id, a.question_id, a.author_id AS answer_author_id, q.author_id, q.title,
                author.email AS answer_author_email
         FROM answers a
         JOIN questions q ON q.id = a.question_id
         JOIN users author ON author.id = a.author_id
         WHERE a.id = ? AND a.is_hidden = 0
         LIMIT 1`,
        [answerId],
      );
      if (!rows.length) throw Object.assign(new Error("Answer not found"), { status: 404 });
      if (rows[0].author_id !== req.user.userId) throw Object.assign(new Error("Forbidden"), { status: 403 });

      await conn.query("UPDATE answers SET is_accepted = 0 WHERE question_id = ?", [rows[0].question_id]);
      await conn.query("UPDATE answers SET is_accepted = 1 WHERE id = ?", [answerId]);
      if (rows[0].answer_author_id !== req.user.userId) {
        await createNotification(conn, {
          userId: rows[0].answer_author_id,
          actorId: req.user.userId,
          type: notificationTypes.answerAccepted,
          targetType: "answer",
          targetId: answerId,
          title: "你的回答被采纳了",
          body: rows[0].title,
          link: `/question/${rows[0].question_id}`,
        });
      }
    });

    const [emailRows] = await pool.query(
      `SELECT a.author_id, u.email, q.title, a.question_id
       FROM answers a
       JOIN users u ON u.id = a.author_id
       JOIN questions q ON q.id = a.question_id
       WHERE a.id = ? LIMIT 1`,
      [answerId],
    );
    if (emailRows.length && emailRows[0].author_id !== req.user.userId && (await shouldSendEmailForType(pool, emailRows[0].author_id, notificationTypes.answerAccepted))) {
      await sendTemplatedEmail({
        to: emailRows[0].email,
        subject: "问答社区：你的回答被采纳了",
        text: `你在《${emailRows[0].title}》下的回答已被采纳，访问 /question/${emailRows[0].question_id} 查看。`,
      });
    }

    res.json({ success: true });
  }),
);

export default router;
