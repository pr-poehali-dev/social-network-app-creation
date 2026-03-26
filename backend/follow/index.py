"""
Подписка / отписка / проверка статуса.
POST {"action": "follow",   "target_id": 123}  — подписаться
POST {"action": "unfollow", "target_id": 123}  — отписаться
GET  ?action=status&target_id=123              — проверить, подписан ли я
GET  ?action=followers&user_id=123             — подписчики пользователя
GET  ?action=following&user_id=123             — подписки пользователя
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


def get_user(token: str, cur):
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

    me = get_user(token, cur)
    if not me:
        cur.close(); conn.close()
        return err("Сессия истекла", 401)

    # ── POST follow ───────────────────────────────────────────────────────
    if method == "POST" and action == "follow":
        target_id = body.get("target_id")
        if not target_id:
            cur.close(); conn.close()
            return err("Укажите target_id")
        if int(target_id) == me:
            cur.close(); conn.close()
            return err("Нельзя подписаться на себя")

        cur.execute(
            """INSERT INTO followers (follower_id, following_id, is_active)
               VALUES (%s, %s, TRUE)
               ON CONFLICT (follower_id, following_id) DO UPDATE SET is_active=TRUE""",
            (me, int(target_id))
        )
        cur.execute(
            "UPDATE users SET following_count=(SELECT COUNT(*) FROM followers WHERE follower_id=%s AND is_active=TRUE) WHERE id=%s",
            (me, me)
        )
        cur.execute(
            "UPDATE users SET followers_count=(SELECT COUNT(*) FROM followers WHERE following_id=%s AND is_active=TRUE) WHERE id=%s",
            (int(target_id), int(target_id))
        )
        conn.commit()
        cur.close(); conn.close()
        return ok({"success": True, "following": True})

    # ── POST unfollow ─────────────────────────────────────────────────────
    if method == "POST" and action == "unfollow":
        target_id = body.get("target_id")
        if not target_id:
            cur.close(); conn.close()
            return err("Укажите target_id")

        cur.execute(
            "UPDATE followers SET is_active=FALSE WHERE follower_id=%s AND following_id=%s AND is_active=TRUE",
            (me, int(target_id))
        )
        # Пересчитываем счётчики
        cur.execute(
            "UPDATE users SET following_count=(SELECT COUNT(*) FROM followers WHERE follower_id=%s AND is_active=TRUE) WHERE id=%s",
            (me, me)
        )
        cur.execute(
            "UPDATE users SET followers_count=(SELECT COUNT(*) FROM followers WHERE following_id=%s AND is_active=TRUE) WHERE id=%s",
            (int(target_id), int(target_id))
        )
        conn.commit()
        cur.close(); conn.close()
        return ok({"success": True, "following": False})

    # ── GET status ────────────────────────────────────────────────────────
    if method == "GET" and action == "status":
        target_id = qs.get("target_id")
        if not target_id:
            cur.close(); conn.close()
            return err("Укажите target_id")
        cur.execute(
            "SELECT id FROM followers WHERE follower_id=%s AND following_id=%s AND is_active=TRUE",
            (me, int(target_id))
        )
        following = cur.fetchone() is not None
        cur.close(); conn.close()
        return ok({"following": following})

    # ── GET following ─────────────────────────────────────────────────────
    if method == "GET" and action in ("following", "followers"):
        user_id = qs.get("user_id") or me
        if action == "following":
            cur.execute(
                """SELECT u.id, u.name, u.username, u.bio, u.avatar_url, u.followers_count, u.posts_count
                   FROM followers f JOIN users u ON u.id = f.following_id
                   WHERE f.follower_id=%s AND f.is_active=TRUE ORDER BY f.created_at DESC LIMIT 100""",
                (user_id,)
            )
        else:
            cur.execute(
                """SELECT u.id, u.name, u.username, u.bio, u.avatar_url, u.followers_count, u.posts_count
                   FROM followers f JOIN users u ON u.id = f.follower_id
                   WHERE f.following_id=%s AND f.is_active=TRUE ORDER BY f.created_at DESC LIMIT 100""",
                (user_id,)
            )
        users = [dict(r) for r in cur.fetchall()]
        cur.close(); conn.close()
        return ok({"users": users, "total": len(users)})

    cur.close(); conn.close()
    return err("Маршрут не найден", 404)