"""
Посты и профиль.
POST {"action":"create","text":"..."}               — создать пост
GET  ?action=feed                                   — лента подписок
GET  ?action=user_posts&user_id=123                 — посты пользователя
POST {"action":"like","post_id":1}                  — лайк / анлайк
POST {"action":"update_profile","name":"...","username":"...","bio":"..."} — обновить профиль
GET  ?action=profile&user_id=123                    — профиль пользователя
"""
import json
import os
import re
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


def user_dict(u) -> dict:
    return {
        "id": u["id"], "name": u["name"], "username": u["username"],
        "bio": u["bio"], "avatar_url": u["avatar_url"], "phone": u["phone"],
        "followers_count": u["followers_count"],
        "following_count": u["following_count"],
        "posts_count": u["posts_count"],
    }


def format_post(p) -> dict:
    return {
        "id": p["id"], "text": p["text"],
        "likes_count": p["likes_count"], "comments_count": p["comments_count"],
        "created_at": p["created_at"], "liked": p["liked"],
        "author": {
            "id": p["author_id"], "name": p["author_name"],
            "username": p["author_username"], "avatar_url": p["author_avatar"],
        }
    }


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

    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── GET profile (публичный) ───────────────────────────────────────────
    if method == "GET" and action == "profile":
        user_id = qs.get("user_id")
        if not user_id:
            cur.close(); conn.close()
            return err("Укажите user_id")
        cur.execute("SELECT * FROM users WHERE id=%s AND is_active=TRUE", (user_id,))
        u = cur.fetchone()
        cur.close(); conn.close()
        return ok({"user": user_dict(u)}) if u else err("Не найден", 404)

    # Остальные действия требуют авторизации
    if not token:
        cur.close(); conn.close()
        return err("Не авторизован", 401)

    me = get_me(token, cur)
    if not me:
        cur.close(); conn.close()
        return err("Сессия истекла", 401)

    # ── POST update_profile ───────────────────────────────────────────────
    if method == "POST" and action == "update_profile":
        name = body.get("name", "").strip()
        username = body.get("username", "").strip()
        bio = body.get("bio", "").strip()

        if not name:
            cur.close(); conn.close()
            return err("Имя не может быть пустым")
        if len(name) > 100:
            cur.close(); conn.close()
            return err("Имя слишком длинное (макс. 100 символов)")
        if username and not re.match(r"^[a-zA-Z0-9_]{3,30}$", username):
            cur.close(); conn.close()
            return err("Username: 3-30 символов, только латиница, цифры и _")
        if len(bio) > 300:
            cur.close(); conn.close()
            return err("Био слишком длинное (макс. 300 символов)")
        if username:
            cur.execute("SELECT id FROM users WHERE username=%s AND id!=%s", (username, me))
            if cur.fetchone():
                cur.close(); conn.close()
                return err("Username уже занят", 409)

        cur.execute(
            "UPDATE users SET name=%s, username=%s, bio=%s, updated_at=now() WHERE id=%s RETURNING *",
            (name, username or None, bio or None, me)
        )
        u = cur.fetchone()
        conn.commit(); cur.close(); conn.close()
        return ok({"success": True, "user": user_dict(u)})

    # ── POST create ───────────────────────────────────────────────────────
    if method == "POST" and action == "create":
        text = body.get("text", "").strip()
        if not text:
            cur.close(); conn.close()
            return err("Текст поста не может быть пустым")
        if len(text) > 2000:
            cur.close(); conn.close()
            return err("Слишком длинный текст (макс. 2000 символов)")

        cur.execute("INSERT INTO posts (user_id, text) VALUES (%s, %s) RETURNING id, created_at", (me, text))
        post = cur.fetchone()
        cur.execute("UPDATE users SET posts_count=posts_count+1 WHERE id=%s", (me,))
        conn.commit(); cur.close(); conn.close()
        return ok({"success": True, "post_id": post["id"], "created_at": post["created_at"]}, 201)

    # ── GET feed ──────────────────────────────────────────────────────────
    if method == "GET" and action == "feed":
        offset = int(qs.get("offset", 0))
        cur.execute(
            """SELECT p.id, p.text, p.likes_count, p.comments_count, p.created_at,
                      u.id as author_id, u.name as author_name, u.username as author_username,
                      u.avatar_url as author_avatar,
                      EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id=p.id AND pl.user_id=%s AND pl.is_active=TRUE) as liked
               FROM posts p JOIN users u ON u.id=p.user_id
               WHERE p.user_id=%s
                  OR p.user_id IN (SELECT following_id FROM followers WHERE follower_id=%s AND is_active=TRUE)
               ORDER BY p.created_at DESC LIMIT 30 OFFSET %s""",
            (me, me, me, offset)
        )
        posts = [format_post(p) for p in cur.fetchall()]
        cur.close(); conn.close()
        return ok({"posts": posts, "offset": offset + len(posts)})

    # ── GET user_posts ────────────────────────────────────────────────────
    if method == "GET" and action == "user_posts":
        user_id = int(qs.get("user_id", me))
        offset = int(qs.get("offset", 0))
        cur.execute(
            """SELECT p.id, p.text, p.likes_count, p.comments_count, p.created_at,
                      u.id as author_id, u.name as author_name, u.username as author_username,
                      u.avatar_url as author_avatar,
                      EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id=p.id AND pl.user_id=%s AND pl.is_active=TRUE) as liked
               FROM posts p JOIN users u ON u.id=p.user_id
               WHERE p.user_id=%s ORDER BY p.created_at DESC LIMIT 20 OFFSET %s""",
            (me, user_id, offset)
        )
        posts = [format_post(p) for p in cur.fetchall()]
        cur.close(); conn.close()
        return ok({"posts": posts})

    # ── POST like ─────────────────────────────────────────────────────────
    if method == "POST" and action == "like":
        post_id = body.get("post_id")
        if not post_id:
            cur.close(); conn.close()
            return err("Укажите post_id")

        cur.execute("SELECT id, is_active FROM post_likes WHERE post_id=%s AND user_id=%s", (post_id, me))
        existing = cur.fetchone()

        if existing and existing["is_active"]:
            cur.execute("UPDATE post_likes SET is_active=FALSE WHERE id=%s", (existing["id"],))
            cur.execute(
                "UPDATE posts SET likes_count=GREATEST(0,likes_count-1) WHERE id=%s RETURNING likes_count",
                (post_id,)
            )
            row = cur.fetchone()
            conn.commit(); cur.close(); conn.close()
            return ok({"liked": False, "likes_count": row["likes_count"] if row else 0})
        else:
            cur.execute(
                "INSERT INTO post_likes (post_id, user_id, is_active) VALUES (%s,%s,TRUE) ON CONFLICT (post_id,user_id) DO UPDATE SET is_active=TRUE",
                (post_id, me)
            )
            cur.execute(
                "UPDATE posts SET likes_count=(SELECT COUNT(*) FROM post_likes WHERE post_id=%s AND is_active=TRUE) WHERE id=%s RETURNING likes_count",
                (post_id, post_id)
            )
            row = cur.fetchone()
            conn.commit(); cur.close(); conn.close()
            return ok({"liked": True, "likes_count": row["likes_count"] if row else 1})

    cur.close(); conn.close()
    return err("Маршрут не найден", 404)
