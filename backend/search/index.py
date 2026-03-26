"""
Поиск пользователей по номеру телефона или никнейму.
GET /?q=запрос — возвращает список пользователей
"""
import json
import os

import psycopg2
import psycopg2.extras

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
}


def get_conn():
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = psycopg2.connect(os.environ["DATABASE_URL"], options=f"-c search_path={schema}")
    conn.autocommit = True
    return conn


def ok(data: dict, status: int = 200):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False, default=str),
    }


def err(msg: str, status: int = 400):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({"error": msg}, ensure_ascii=False),
    }


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if event.get("httpMethod") != "GET":
        return err("Метод не поддерживается", 405)

    qs = event.get("queryStringParameters") or {}
    q = (qs.get("q") or "").strip()

    if len(q) < 2:
        return err("Запрос слишком короткий (минимум 2 символа)", 400)

    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Нормализуем телефон: если похоже на номер — ищем по phone
    digits = "".join(c for c in q if c.isdigit())
    phone_search = None
    if len(digits) >= 4:
        phone_search = "%" + digits + "%"

    if phone_search:
        cur.execute(
            """SELECT id, name, username, bio, avatar_url, followers_count, following_count, posts_count
               FROM users
               WHERE is_active = TRUE
                 AND (phone LIKE %s OR LOWER(username) LIKE LOWER(%s) OR LOWER(name) LIKE LOWER(%s))
               LIMIT 20""",
            (phone_search, "%" + q + "%", "%" + q + "%"),
        )
    else:
        cur.execute(
            """SELECT id, name, username, bio, avatar_url, followers_count, following_count, posts_count
               FROM users
               WHERE is_active = TRUE
                 AND (LOWER(username) LIKE LOWER(%s) OR LOWER(name) LIKE LOWER(%s))
               LIMIT 20""",
            ("%" + q + "%", "%" + q + "%"),
        )

    users = cur.fetchall()
    cur.close()
    conn.close()

    return ok({"users": [dict(u) for u in users], "total": len(users)})
