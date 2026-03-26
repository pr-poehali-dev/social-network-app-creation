"""
Аутентификация по номеру телефона и паролю. v3
Методы (action в теле POST):
  register — регистрация (phone, password, name, username?)
  login    — вход (phone, password)
  me       — GET, проверка сессии
  logout   — завершение сессии
"""
import hashlib
import hmac
import json
import os
import random
import secrets
import string
from datetime import datetime, timedelta, timezone

import psycopg2
import psycopg2.extras

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, X-Session-Id",
}


def get_conn():
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = psycopg2.connect(os.environ["DATABASE_URL"], options=f"-c search_path={schema}")
    conn.autocommit = False
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


def hash_password(password: str) -> str:
    salt = os.environ.get("PASSWORD_SALT", "aura_salt_v1")
    return hashlib.sha256((salt + password).encode()).hexdigest()


def verify_password(password: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_password(password), stored_hash)


def gen_token() -> str:
    return secrets.token_hex(48)


def normalize_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("8") and len(digits) == 11:
        digits = "7" + digits[1:]
    if not digits.startswith("7"):
        digits = "7" + digits
    return "+" + digits


def user_dict(user) -> dict:
    return {
        "id": user["id"],
        "phone": user["phone"],
        "name": user["name"],
        "username": user["username"],
        "bio": user["bio"],
        "avatar_url": user["avatar_url"],
        "followers_count": user["followers_count"],
        "following_count": user["following_count"],
        "posts_count": user["posts_count"],
    }


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            return err("Невалидный JSON", 400)

    qs = event.get("queryStringParameters") or {}
    action = body.get("action") or qs.get("action") or path.strip("/").split("/")[-1] or ""

    # ── POST register ──────────────────────────────────────────────────────
    if method == "POST" and action == "register":
        phone_raw = body.get("phone", "").strip()
        password = body.get("password", "").strip()
        name = body.get("name", "").strip()
        username = body.get("username", "").strip()

        if not phone_raw:
            return err("Укажите номер телефона")
        if not password or len(password) < 6:
            return err("Пароль должен быть не менее 6 символов")
        if not name:
            return err("Укажите ваше имя")
        if username and not __import__("re").match(r"^[a-zA-Z0-9_]{3,30}$", username):
            return err("Username: 3–30 символов, только латиница, цифры и _")

        phone = normalize_phone(phone_raw)
        pw_hash = hash_password(password)

        conn = get_conn()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT id FROM users WHERE phone=%s", (phone,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return err("Номер телефона уже зарегистрирован", 409)

        if username:
            cur.execute("SELECT id FROM users WHERE username=%s", (username,))
            if cur.fetchone():
                cur.close()
                conn.close()
                return err("Имя пользователя уже занято", 409)

        if not username:
            username = "user_" + "".join(random.choices(string.digits, k=6))

        cur.execute(
            """INSERT INTO users (phone, name, username, password_hash)
               VALUES (%s, %s, %s, %s) RETURNING *""",
            (phone, name, username, pw_hash),
        )
        user = cur.fetchone()

        token = gen_token()
        expires_session = datetime.now(timezone.utc) + timedelta(days=30)
        device = (event.get("headers") or {}).get("User-Agent", "unknown")[:200]
        cur.execute(
            """INSERT INTO sessions (user_id, token, device_info, expires_at)
               VALUES (%s, %s, %s, %s)""",
            (user["id"], token, device, expires_session),
        )
        conn.commit()
        cur.close()
        conn.close()

        return ok({"success": True, "token": token, "user": user_dict(user)}, 201)

    # ── POST login ─────────────────────────────────────────────────────────
    if method == "POST" and action == "login":
        phone_raw = body.get("phone", "").strip()
        password = body.get("password", "").strip()

        if not phone_raw or not password:
            return err("Укажите телефон и пароль")

        phone = normalize_phone(phone_raw)

        conn = get_conn()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM users WHERE phone=%s", (phone,))
        user = cur.fetchone()

        if not user or not user.get("password_hash") or not verify_password(password, user["password_hash"]):
            cur.close()
            conn.close()
            return err("Неверный номер телефона или пароль", 401)

        token = gen_token()
        expires_session = datetime.now(timezone.utc) + timedelta(days=30)
        device = (event.get("headers") or {}).get("User-Agent", "unknown")[:200]
        cur.execute(
            """INSERT INTO sessions (user_id, token, device_info, expires_at)
               VALUES (%s, %s, %s, %s)""",
            (user["id"], token, device, expires_session),
        )
        conn.commit()
        cur.close()
        conn.close()

        return ok({"success": True, "token": token, "user": user_dict(user)})

    # ── GET me ─────────────────────────────────────────────────────────────
    if method == "GET" and action == "me":
        token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "").strip()
        if not token:
            return err("Не авторизован", 401)

        now = datetime.now(timezone.utc)
        conn = get_conn()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """SELECT u.* FROM sessions s
               JOIN users u ON u.id = s.user_id
               WHERE s.token=%s AND s.expires_at > %s""",
            (token, now),
        )
        user = cur.fetchone()
        if user:
            cur.execute("UPDATE sessions SET last_seen_at=%s WHERE token=%s", (now, token))
            conn.commit()
        cur.close()
        conn.close()

        if not user:
            return err("Сессия истекла", 401)

        return ok({"user": user_dict(user)})

    # ── POST logout ────────────────────────────────────────────────────────
    if method == "POST" and action == "logout":
        token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "").strip()
        if token:
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("DELETE FROM sessions WHERE token=%s", (token,))
            conn.commit()
            cur.close()
            conn.close()
        return ok({"success": True})

    return err("Метод не найден", 404)