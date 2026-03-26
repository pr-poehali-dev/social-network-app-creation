"""
Чаты и сообщения.
GET  ?action=list                         — мои чаты
POST {"action":"start","target_id":123}   — начать/получить чат
GET  ?action=messages&chat_id=1           — сообщения чата
POST {"action":"send","chat_id":1,"text":"Привет"} — отправить сообщение
"""
import json
import os
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}


def get_conn():
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = psycopg2.connect(os.environ["DATABASE_URL"], options=f"-c search_path={schema}")
    conn.autocommit = False
    return conn


def ok(data: dict, status: int = 200):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(msg: str, status: int = 400):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps({"error": msg}, ensure_ascii=False)}


def get_me(token: str, cur):
    now = datetime.now(timezone.utc)
    cur.execute(
        "SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=%s AND s.expires_at>%s",
        (token, now)
    )
    row = cur.fetchone()
    return row["id"] if row else None


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            return err("Невалидный JSON", 400)

    qs = event.get("queryStringParameters") or {}
    action = body.get("action") or qs.get("action") or ""

    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "").strip()
    if not token:
        return err("Не авторизован", 401)

    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    me = get_me(token, cur)
    if not me:
        cur.close(); conn.close()
        return err("Сессия истекла", 401)

    # ── GET list ──────────────────────────────────────────────────────────
    if method == "GET" and action == "list":
        cur.execute(
            """SELECT c.id as chat_id,
                      CASE WHEN c.user1_id=%s THEN c.user2_id ELSE c.user1_id END as partner_id,
                      u.name as partner_name, u.username as partner_username,
                      u.avatar_url as partner_avatar,
                      (SELECT text FROM messages m WHERE m.chat_id=c.id ORDER BY m.created_at DESC LIMIT 1) as last_text,
                      (SELECT created_at FROM messages m WHERE m.chat_id=c.id ORDER BY m.created_at DESC LIMIT 1) as last_time,
                      (SELECT COUNT(*) FROM messages m WHERE m.chat_id=c.id AND m.sender_id!=%s AND m.read_at IS NULL) as unread
               FROM chats c
               JOIN users u ON u.id = CASE WHEN c.user1_id=%s THEN c.user2_id ELSE c.user1_id END
               WHERE c.user1_id=%s OR c.user2_id=%s
               ORDER BY last_time DESC NULLS LAST""",
            (me, me, me, me, me)
        )
        chats = [dict(r) for r in cur.fetchall()]
        cur.close(); conn.close()
        return ok({"chats": chats})

    # ── POST start ────────────────────────────────────────────────────────
    if method == "POST" and action == "start":
        target_id = body.get("target_id")
        if not target_id:
            cur.close(); conn.close()
            return err("Укажите target_id")
        if int(target_id) == me:
            cur.close(); conn.close()
            return err("Нельзя написать самому себе")

        u1, u2 = min(me, int(target_id)), max(me, int(target_id))
        cur.execute("SELECT id FROM chats WHERE user1_id=%s AND user2_id=%s", (u1, u2))
        row = cur.fetchone()
        if row:
            chat_id = row["id"]
        else:
            cur.execute("INSERT INTO chats (user1_id, user2_id) VALUES (%s,%s) RETURNING id", (u1, u2))
            chat_id = cur.fetchone()["id"]
            conn.commit()

        cur.execute("SELECT name, username FROM users WHERE id=%s", (target_id,))
        partner = cur.fetchone()
        cur.close(); conn.close()
        return ok({"chat_id": chat_id, "partner": dict(partner) if partner else {}})

    # ── GET messages ──────────────────────────────────────────────────────
    if method == "GET" and action == "messages":
        chat_id = qs.get("chat_id")
        if not chat_id:
            cur.close(); conn.close()
            return err("Укажите chat_id")

        cur.execute("SELECT id FROM chats WHERE id=%s AND (user1_id=%s OR user2_id=%s)", (chat_id, me, me))
        if not cur.fetchone():
            cur.close(); conn.close()
            return err("Чат не найден", 404)

        cur.execute(
            """SELECT m.id, m.sender_id, m.text, m.created_at, m.read_at,
                      u.name as sender_name, u.username as sender_username
               FROM messages m JOIN users u ON u.id=m.sender_id
               WHERE m.chat_id=%s ORDER BY m.created_at ASC LIMIT 200""",
            (chat_id,)
        )
        msgs = [dict(r) for r in cur.fetchall()]

        # Отмечаем прочитанными чужие сообщения
        cur.execute(
            "UPDATE messages SET read_at=%s WHERE chat_id=%s AND sender_id!=%s AND read_at IS NULL",
            (datetime.now(timezone.utc), chat_id, me)
        )
        conn.commit()
        cur.close(); conn.close()
        return ok({"messages": msgs})

    # ── POST send ─────────────────────────────────────────────────────────
    if method == "POST" and action == "send":
        chat_id = body.get("chat_id")
        text = (body.get("text") or "").strip()
        if not chat_id or not text:
            cur.close(); conn.close()
            return err("Укажите chat_id и text")

        cur.execute("SELECT id FROM chats WHERE id=%s AND (user1_id=%s OR user2_id=%s)", (chat_id, me, me))
        if not cur.fetchone():
            cur.close(); conn.close()
            return err("Чат не найден", 404)

        cur.execute(
            "INSERT INTO messages (chat_id, sender_id, text) VALUES (%s,%s,%s) RETURNING id, created_at",
            (chat_id, me, text)
        )
        msg = cur.fetchone()
        conn.commit()
        cur.close(); conn.close()
        return ok({"message_id": msg["id"], "created_at": msg["created_at"]}, 201)

    cur.close(); conn.close()
    return err("Маршрут не найден", 404)
