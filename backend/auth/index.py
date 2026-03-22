"""
Аутентификация через номер телефона (SMS OTP).
Методы: POST /send-otp, POST /verify-otp, POST /register, GET /me, POST /logout
"""
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
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(msg: str, status: int = 400):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def gen_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def gen_token() -> str:
    return secrets.token_hex(48)


def normalize_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("8") and len(digits) == 11:
        digits = "7" + digits[1:]
    if not digits.startswith("7"):
        digits = "7" + digits
    return "+" + digits


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

    # ── POST /send-otp ──────────────────────────────────────────────────────
    if method == "POST" and path.endswith("/send-otp"):
        phone_raw = body.get("phone", "").strip()
        if not phone_raw:
            return err("Укажите номер телефона")
        phone = normalize_phone(phone_raw)
        if len(phone) < 12:
            return err("Некорректный номер телефона")

        code = gen_otp()
        expires = datetime.now(timezone.utc) + timedelta(minutes=10)

        conn = get_conn()
        cur = conn.cursor()
        # Инвалидируем старые коды
        cur.execute(
            "UPDATE otp_codes SET is_used=TRUE WHERE phone=%s AND is_used=FALSE",
            (phone,)
        )
        cur.execute(
            "INSERT INTO otp_codes (phone, code, expires_at) VALUES (%s, %s, %s)",
            (phone, code, expires)
        )
        conn.commit()
        cur.close()
        conn.close()

        # В продакшне здесь был бы вызов SMS-провайдера
        # Пока возвращаем код в ответе (только для разработки!)
        is_new_user = False
        conn2 = get_conn()
        cur2 = conn2.cursor()
        cur2.execute("SELECT id FROM users WHERE phone=%s", (phone,))
        is_new_user = cur2.fetchone() is None
        cur2.close()
        conn2.close()

        return ok({
            "success": True,
            "phone": phone,
            "is_new_user": is_new_user,
            "dev_code": code,  # убрать в продакшне
            "message": f"Код отправлен на {phone}"
        })

    # ── POST /verify-otp ────────────────────────────────────────────────────
    if method == "POST" and path.endswith("/verify-otp"):
        phone_raw = body.get("phone", "").strip()
        code = body.get("code", "").strip()
        name = body.get("name", "").strip()
        username = body.get("username", "").strip()

        if not phone_raw or not code:
            return err("Укажите телефон и код")

        phone = normalize_phone(phone_raw)
        now = datetime.now(timezone.utc)

        conn = get_conn()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute(
            """SELECT id FROM otp_codes
               WHERE phone=%s AND code=%s AND is_used=FALSE AND expires_at > %s
               ORDER BY created_at DESC LIMIT 1""",
            (phone, code, now)
        )
        otp_row = cur.fetchone()
        if not otp_row:
            cur.close()
            conn.close()
            return err("Неверный или просроченный код", 401)

        # Инвалидируем код
        cur.execute("UPDATE otp_codes SET is_used=TRUE WHERE id=%s", (otp_row["id"],))

        # Ищем или создаём пользователя
        cur.execute("SELECT * FROM users WHERE phone=%s", (phone,))
        user = cur.fetchone()

        if not user:
            # Новый пользователь — нужны name и username
            if not name:
                conn.rollback()
                cur.close()
                conn.close()
                return err("Укажите имя для регистрации", 422)
            # Генерируем username если не передан
            if not username:
                base = "user_" + "".join(random.choices(string.digits, k=6))
                username = base
            # Проверяем уникальность username
            cur.execute("SELECT id FROM users WHERE username=%s", (username,))
            if cur.fetchone():
                conn.rollback()
                cur.close()
                conn.close()
                return err("Имя пользователя уже занято", 409)

            cur.execute(
                """INSERT INTO users (phone, name, username)
                   VALUES (%s, %s, %s) RETURNING *""",
                (phone, name, username)
            )
            user = cur.fetchone()

        # Создаём сессию
        token = gen_token()
        expires_session = datetime.now(timezone.utc) + timedelta(days=30)
        device = event.get("headers", {}).get("User-Agent", "unknown")[:200]
        cur.execute(
            """INSERT INTO sessions (user_id, token, device_info, expires_at)
               VALUES (%s, %s, %s, %s)""",
            (user["id"], token, device, expires_session)
        )
        conn.commit()
        cur.close()
        conn.close()

        return ok({
            "success": True,
            "token": token,
            "user": {
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
        })

    # ── GET /me ─────────────────────────────────────────────────────────────
    if method == "GET" and path.endswith("/me"):
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
            (token, now)
        )
        user = cur.fetchone()
        # Обновляем last_seen
        if user:
            cur.execute("UPDATE sessions SET last_seen_at=%s WHERE token=%s", (now, token))
            conn.commit()
        cur.close()
        conn.close()

        if not user:
            return err("Сессия истекла", 401)

        return ok({
            "user": {
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
        })

    # ── POST /logout ─────────────────────────────────────────────────────────
    if method == "POST" and path.endswith("/logout"):
        token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "").strip()
        if token:
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("UPDATE sessions SET expires_at=NOW() WHERE token=%s", (token,))
            conn.commit()
            cur.close()
            conn.close()
        return ok({"success": True})

    return err("Маршрут не найден", 404)
