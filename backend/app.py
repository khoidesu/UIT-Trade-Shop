from __future__ import annotations

import os
import secrets
import re
import hashlib
from datetime import datetime, timezone
from typing import Any

import certifi
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError, PyMongoError
from bson import ObjectId
from werkzeug.security import check_password_hash, generate_password_hash

import string
import random
from email_service.send_mail import send_order_success_email, send_report_email, send_report_seller_email, send_verification_request_email, send_forgot_password_email, send_order_seller_email
# Allowed product categories (must match frontend src/data/categories.js).
PRODUCT_CATEGORIES = (
    "Học tập",
    "Phòng trọ",
    "Công nghệ",
    "Thời trang",
    "Giải trí",
    "Khác",
)

ORDER_STATUS_OPTIONS = (
    "đã xác nhận",
    "đã huỷ bỏ",
    "đang chuẩn bị hàng",
    "đã giao cho người shipper",
    "đã nhận được hàng",
    "đã xác nhận ngày trao đổi",
)

# Keep empty in production; configure via environment variables.
MONGODB_URI_DIRECT = ""
ADMIN_REGISTRATION_CODE_DIRECT = ""


def parse_json(data):
    """Biến các đối tượng ObjectId trong dữ liệu thành chuỗi (string)"""
    import json
    from bson import json_util
    return json.loads(json_util.dumps(data))

def gravatar_monster_url(seed_email: str, size: int = 160) -> str:
    """Gravatar with generated monster when user has no custom gravatar (d=monsterid)."""
    email = (seed_email or "").strip().lower() or "anonymous@local"
    h = hashlib.md5(email.encode("utf-8")).hexdigest()
    return f"https://www.gravatar.com/avatar/{h}?d=monsterid&s={size}"


def display_avatar_url(user_doc: dict[str, Any]) -> str:
    """Public avatar URL: custom photo if set, otherwise Gravatar monsterid."""
    raw = str(user_doc.get("avatarUrl", "")).strip()
    if raw:
        return raw
    email = str(user_doc.get("email", "")).strip()
    if email:
        return gravatar_monster_url(email, 256)
    uname = str(user_doc.get("username", "")).strip()
    return gravatar_monster_url(f"{uname}@uit.local" if uname else "anon@uit.local", 256)


def create_app() -> Flask:
    app = Flask(__name__)
    frontend_origins_raw = os.getenv("FRONTEND_ORIGINS", "*").strip()
    if frontend_origins_raw in {"", "*"}:
        cors_origins: str | list[str] = "*"
    else:
        cors_origins = [x.strip() for x in frontend_origins_raw.split(",") if x.strip()]
    CORS(
        app,
        resources={r"/api/*": {"origins": cors_origins}},
        supports_credentials=True,
    )

    mongo_uri = MONGODB_URI_DIRECT.strip() or os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    mongo_db = os.getenv("MONGODB_DB", "shopee_clone")
    products_collection_name = os.getenv("MONGODB_COLLECTION", "products")

    # Connect to MongoDB with a short server selection timeout to avoid long hangs
    def _try_connect(uri: str, use_tls: bool, timeout_ms: int):
        try:
            if use_tls:
                client = MongoClient(uri, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=timeout_ms)
            else:
                client = MongoClient(uri, serverSelectionTimeoutMS=timeout_ms)
            # force immediate server selection
            client.admin.command("ping")
            return client
        except PyMongoError:
            return None

    client = None
    # Prefer the configured URI first
    if mongo_uri:
        use_tls = mongo_uri.startswith("mongodb+srv") or mongo_uri.startswith("mongodb+tls")
        client = _try_connect(mongo_uri, use_tls=use_tls, timeout_ms=5000)

    # If remote URI failed and it's not already the local default, try localhost fallback
    if client is None and mongo_uri != "mongodb://localhost:27017":
        client = _try_connect("mongodb://localhost:27017", use_tls=False, timeout_ms=2000)

    if client is None:
        raise RuntimeError(f"Could not connect to MongoDB (tried '{mongo_uri}' and localhost)")

    db = client[mongo_db]
    products: Collection = db[products_collection_name]
    users: Collection = db["users"]
    orders: Collection = db["orders"]
    reports: Collection = db["reports"]
    messages: Collection = db["messages"]
    lost_found: Collection = db["lost_found"]
    refunds: Collection = db["refunds"]
    discount_codes: Collection = db["discount_codes"]

    # Create indexes but don't let index creation failures block startup indefinitely.
    try:
        products.create_index("id", unique=True)
        messages.create_index([("sender", 1), ("receiver", 1)])
        lost_found.create_index("id", unique=True)
        users.create_index("username", unique=True)
        users.create_index("token", unique=True, sparse=True)
        # Enforce one account per email/phone/studentId (when present)
        users.create_index("email", unique=True, sparse=True)
        users.create_index("phone", unique=True, sparse=True)
        users.create_index("studentId", unique=True, sparse=True)
        discount_codes.create_index("code", unique=True)
    except PyMongoError as exc:
        # Warn and continue; operations will error later if DB is not available.
        print(f"Warning: MongoDB index creation failed: {exc}")

    def get_current_user() -> dict[str, Any] | None:
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return None
        token = header.removeprefix("Bearer ").strip()
        if not token:
            return None
        user = users.find_one({"token": token}, {"_id": 0, "password_hash": 0})
        return user

    def safe_user_projection() -> dict[str, int]:
        return {"_id": 0, "password_hash": 0, "token": 0}

    def normalize_user_profile(user_doc: dict[str, Any]) -> dict[str, Any]:
        return {
            "username": str(user_doc.get("username", "")).strip(),
            "role": str(user_doc.get("role", "standard")).strip().lower() or "standard",
            "studentId": str(user_doc.get("studentId", "")).strip(),
            "studentVerified": bool(user_doc.get("studentVerified", False)),
            "fullName": str(user_doc.get("fullName", "")).strip(),
            "dob": str(user_doc.get("dob", "")).strip(),
            "email": str(user_doc.get("email", "")).strip(),
            "phone": str(user_doc.get("phone", "")).strip(),
            "address": str(user_doc.get("address", "")).strip(),
            "avatarUrl": str(user_doc.get("avatarUrl", "")).strip(),
            "paymentQrUrl": str(user_doc.get("paymentQrUrl", "")).strip(),
            "displayAvatarUrl": display_avatar_url(user_doc),
        }

    def normalize_image_url(raw_url: str) -> str:
        raw = str(raw_url or "").strip()
        if not raw:
            return ""
        lh3 = re.match(r"^https://lh3\.googleusercontent\.com/d/([a-zA-Z0-9_-]+)", raw)
        if lh3:
            return f"https://lh3.googleusercontent.com/d/{lh3.group(1)}"
        file_match = re.search(r"drive\.google\.com/file/d/([a-zA-Z0-9_-]+)", raw)
        if file_match:
            return f"https://lh3.googleusercontent.com/d/{file_match.group(1)}"
        query_match = re.search(r"[?&]id=([a-zA-Z0-9_-]+)", raw)
        if query_match:
            return f"https://lh3.googleusercontent.com/d/{query_match.group(1)}"
        return raw

    def normalize_cart_items(raw_items: Any) -> list[dict[str, int]]:
        if not isinstance(raw_items, list):
            return []
        items: list[dict[str, int]] = []
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            try:
                product_id = int(item.get("productId"))
                qty = int(item.get("qty"))
            except (TypeError, ValueError):
                continue
            if product_id <= 0 or qty <= 0:
                continue
            items.append({"productId": product_id, "qty": qty})
        return items

    def normalize_order_status(raw_status: Any, delivery_type: str) -> str:
        status = str(raw_status or "").strip().lower()
        if status in ORDER_STATUS_OPTIONS:
            return status
        return "đã xác nhận"

    def normalize_order_item(item: dict[str, Any], delivery_type: str) -> dict[str, Any]:
        return {
            "productId": int(item.get("productId", 0)),
            "qty": int(item.get("qty", 0)),
            "lineTotal": int(item.get("lineTotal", 0)),
            "productName": str(item.get("productName", "")).strip(),
            "sellerUsername": str(item.get("sellerUsername", "")).strip(),
            "status": normalize_order_status(item.get("status"), delivery_type),
        }

    def normalize_order_doc(order_doc: dict[str, Any]) -> dict[str, Any]:
        delivery_type = str(order_doc.get("deliveryType", "shipper")).strip().lower()
        raw_items = order_doc.get("items") if isinstance(order_doc.get("items"), list) else []
        items = [normalize_order_item(it, delivery_type) for it in raw_items if isinstance(it, dict)]
        return {
            "_id": str(order_doc.get("_id", "")),
            "username": str(order_doc.get("username", "")).strip(),
            "deliveryType": delivery_type if delivery_type in {"direct", "shipper"} else "shipper",
            "name": str(order_doc.get("name", "")).strip(),
            "studentId": str(order_doc.get("studentId", "")).strip(),
            "transactionDate": str(order_doc.get("transactionDate", "")).strip(),
            "transactionPlace": str(order_doc.get("transactionPlace", "")).strip(),
            "phone": str(order_doc.get("phone", "")).strip(),
            "address": str(order_doc.get("address", "")).strip(),
            "payment": str(order_doc.get("payment", "")).strip(),
            "note": str(order_doc.get("note", "")).strip(),
            "discountCode": str(order_doc.get("discountCode", "")).strip(),
            "discountAmount": int(order_doc.get("discountAmount", 0)),
            "sellerDiscounts": order_doc.get("sellerDiscounts", {}) if isinstance(order_doc.get("sellerDiscounts"), dict) else {},
            "subtotalBeforeDiscount": int(order_doc.get("subtotalBeforeDiscount", 0)),
            "total": int(order_doc.get("total", 0)),
            "createdAt": str(order_doc.get("createdAt", "")).strip(),
            "items": items,
        }

    def normalize_discount_code(code_doc: dict[str, Any]) -> dict[str, Any]:
        return {
            "code": str(code_doc.get("code", "")).strip().upper(),
            "type": str(code_doc.get("type", "fixed")).strip().lower(),
            "value": int(code_doc.get("value", 0)),
            "minOrderAmount": int(code_doc.get("minOrderAmount", 0)),
            "maxDiscountAmount": int(code_doc.get("maxDiscountAmount", 0)),
            "active": bool(code_doc.get("active", True)),
            "usesCount": int(code_doc.get("usesCount", 0)),
            "totalUses": int(code_doc.get("totalUses", 0)),
            "expiresAt": str(code_doc.get("expiresAt", "")).strip(),
            "createdAt": str(code_doc.get("createdAt", "")).strip(),
        }

    def compute_discount_for_order(code_raw: str, subtotal: int) -> tuple[int, dict[str, Any] | None, str | None]:
        code = str(code_raw or "").strip().upper()
        if not code:
            return 0, None, None
        code_doc = discount_codes.find_one({"code": code})
        if not code_doc:
            return 0, None, "Mã giảm giá không tồn tại"
        if not bool(code_doc.get("active", True)):
            return 0, None, "Mã giảm giá đã bị vô hiệu hóa"
        expires_at = str(code_doc.get("expiresAt", "")).strip()
        if expires_at:
            try:
                exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) > exp_dt.astimezone(timezone.utc):
                    return 0, None, "Mã giảm giá đã hết hạn"
            except Exception:
                pass
        min_order = int(code_doc.get("minOrderAmount", 0))
        if subtotal < min_order:
            return 0, None, f"Đơn hàng tối thiểu {min_order}đ để áp dụng mã"
        uses_count = int(code_doc.get("usesCount", 0))
        total_uses = int(code_doc.get("totalUses", 0))
        if total_uses > 0 and uses_count >= total_uses:
            return 0, None, "Mã giảm giá đã hết lượt sử dụng"
        discount_type = str(code_doc.get("type", "fixed")).strip().lower()
        value = int(code_doc.get("value", 0))
        discount_amount = 0
        if discount_type == "percent":
            discount_amount = int(subtotal * max(0, min(value, 100)) / 100)
            max_discount = int(code_doc.get("maxDiscountAmount", 0))
            if max_discount > 0:
                discount_amount = min(discount_amount, max_discount)
        else:
            discount_amount = value
        discount_amount = max(0, min(discount_amount, subtotal))
        return discount_amount, code_doc, None

    def split_discount_across_sellers(
        seller_subtotals: dict[str, int],
        discount_amount: int,
    ) -> dict[str, int]:
        sellers = [(u, int(v)) for u, v in seller_subtotals.items() if str(u).strip()]
        if not sellers or discount_amount <= 0:
            return {u: 0 for u, _ in sellers}

        total_sub = sum(v for _, v in sellers)
        remaining = max(0, min(int(discount_amount), total_sub))
        n = len(sellers)
        base = remaining // n
        rem = remaining % n

        # Highest subtotal gets remainder first; tie-break by username for deterministic output.
        ranked = sorted(sellers, key=lambda x: (-x[1], x[0]))
        alloc = {u: 0 for u, _ in sellers}
        for idx, (u, _) in enumerate(ranked):
            alloc[u] = base + (1 if idx < rem else 0)

        # Cap each seller discount by that seller subtotal, then redistribute overflow.
        overflow = 0
        for u, sub in sellers:
            if alloc[u] > sub:
                overflow += alloc[u] - sub
                alloc[u] = sub

        while overflow > 0:
            moved = 0
            for u, sub in ranked:
                room = sub - alloc[u]
                if room <= 0:
                    continue
                take = min(room, overflow)
                alloc[u] += take
                overflow -= take
                moved += take
                if overflow <= 0:
                    break
            if moved <= 0:
                break
        return alloc

    def cleanup_out_of_stock_products() -> None:
        products.delete_many({"quantity": {"$lte": 0}})

    @app.get("/api/health")
    def health() -> Any:
        return jsonify({"ok": True})

    @app.get("/api/categories")
    def get_categories() -> Any:
        return jsonify(list(PRODUCT_CATEGORIES))

    @app.post("/api/auth/register")
    def register() -> Any:
        payload = request.get_json(silent=True) or {}
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", "")).strip()
        role = str(payload.get("role", "standard")).strip().lower()
        student_id = str(payload.get("studentId", "")).strip()
        admin_code = str(payload.get("adminCode", "")).strip()
        full_name = str(payload.get("fullName", "")).strip()
        dob = str(payload.get("dob", "")).strip()
        email = str(payload.get("email", "")).strip()
        phone = str(payload.get("phone", "")).strip()
        address = str(payload.get("address", "")).strip()
        avatar_url = normalize_image_url(str(payload.get("avatarUrl", "")).strip())
        payment_qr_url = normalize_image_url(str(payload.get("paymentQrUrl", "")).strip())

        if not username or not password:
            return jsonify({"error": "username and password are required"}), 400
        if role not in {"standard", "admin"}:
            return jsonify({"error": "role must be standard or admin"}), 400
        if role == "admin":
            expected = ADMIN_REGISTRATION_CODE_DIRECT.strip() or os.getenv("ADMIN_REGISTRATION_CODE", "")
            if not expected or admin_code != expected:
                return jsonify({"error": "invalid admin registration code"}), 403

        # Enforce unique email/phone/studentId (when provided)
        if email and users.find_one({"email": email}, {"_id": 1}):
            return jsonify({"error": "Email đã được sử dụng. Vui lòng dùng email khác."}), 409
        if phone and users.find_one({"phone": phone}, {"_id": 1}):
            return jsonify({"error": "Số điện thoại đã được sử dụng. Vui lòng dùng số khác."}), 409
        if student_id and users.find_one({"studentId": student_id}, {"_id": 1}):
            return jsonify({"error": "MSSV đã được sử dụng. Vui lòng dùng MSSV khác."}), 409

        user_doc = {
            "username": username,
            "password_hash": generate_password_hash(password),
            "role": role,
            "studentId": student_id if role == "standard" else "",
            "studentVerified": False if role == "standard" else True,
            "fullName": full_name,
            "dob": dob,
            "email": email,
            "phone": phone,
            "address": address,
            "avatarUrl": avatar_url,
            "paymentQrUrl": payment_qr_url,
            "cartItems": [],
        }
        try:
            users.insert_one(user_doc)
        except DuplicateKeyError:
            # Fallback (race condition / index catches duplicates): surface a friendly message.
            return jsonify({"error": "Email / SĐT / MSSV hoặc username đã tồn tại. Vui lòng dùng thông tin khác."}), 409
        except PyMongoError as exc:
            return jsonify({"error": f"database error: {str(exc)}"}), 500
        return jsonify({"ok": True, "message": "registered"})

    @app.post("/api/auth/login")
    def login() -> Any:
        payload = request.get_json(silent=True) or {}
        identifier = str(payload.get("username", "")).strip() # kept name 'username' for frontend compatibility
        password = str(payload.get("password", "")).strip()
        if not identifier or not password:
            return jsonify({"error": "email/phone/studentId and password are required"}), 400

        # Only search by email, phone, or studentId
        user = users.find_one({"$or": [
            {"email": identifier}, 
            {"phone": identifier}, 
            {"studentId": identifier}
        ]})
        if not user or not check_password_hash(user.get("password_hash", ""), password):
            return jsonify({"error": "invalid credentials"}), 401

        token = secrets.token_urlsafe(32)
        users.update_one({"_id": user["_id"]}, {"$set": {"token": token}})
        safe = users.find_one({"_id": user["_id"]}, safe_user_projection())
        return jsonify({"ok": True, "token": token, "user": safe})

    @app.post("/api/auth/forgot-password")
    def forgot_password() -> Any:
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("email", "")).strip()
        if not email:
            return jsonify({"error": "email is required"}), 400
        
        user = users.find_one({"email": email})
        if not user:
            # For security, don't reveal if email exists, but we'll return ok
            return jsonify({"ok": True, "message": "If an account with that email exists, a reset code has been sent."})
        
        # Generate 6-char random code (upper, lower, digits)
        code = ''.join(random.choices(string.ascii_letters + string.digits, k=6))
        
        # Store code in DB with expiry (15 mins)
        expiry = datetime.now(timezone.utc).timestamp() + 900 # 15 mins
        users.update_one({"email": email}, {"$set": {"reset_code": code, "reset_code_expires": expiry}})
        
        send_forgot_password_email(email, code)
        return jsonify({"ok": True, "message": "reset code sent"})

    @app.post("/api/auth/reset-password")
    def reset_password() -> Any:
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("email", "")).strip()
        code = str(payload.get("code", "")).strip()
        new_password = str(payload.get("newPassword", "")).strip()
        
        if not email or not code or not new_password:
            return jsonify({"error": "email, code, and newPassword are required"}), 400
        
        user = users.find_one({"email": email, "reset_code": code})
        if not user:
            return jsonify({"error": "invalid code"}), 400
        
        expiry = user.get("reset_code_expires", 0)
        if datetime.now(timezone.utc).timestamp() > expiry:
            return jsonify({"error": "code expired"}), 400
        
        # Update password and clear reset code
        users.update_one(
            {"email": email}, 
            {
                "$set": {"password_hash": generate_password_hash(new_password)},
                "$unset": {"reset_code": "", "reset_code_expires": ""}
            }
        )
        return jsonify({"ok": True, "message": "password updated successfully"})

    @app.post("/api/auth/logout")
    def logout() -> Any:
        user = get_current_user()
        if not user:
            return jsonify({"error": "unauthorized"}), 401
        users.update_one({"username": user["username"]}, {"$unset": {"token": ""}})
        return jsonify({"ok": True})

    @app.get("/api/auth/me")
    def me() -> Any:
        user = get_current_user()
        if not user:
            return jsonify({"error": "unauthorized"}), 401
        
        # Ensure we have the latest user data including verification status
        return jsonify(normalize_user_profile(user))

    @app.put("/api/auth/me")
    def update_me() -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401

        payload = request.get_json(silent=True) or {}
        full_name = str(payload.get("fullName", "")).strip()
        dob = str(payload.get("dob", "")).strip()
        email = str(payload.get("email", "")).strip()
        phone = str(payload.get("phone", "")).strip()
        address = str(payload.get("address", "")).strip()
        avatar_url = normalize_image_url(str(payload.get("avatarUrl", "")).strip())
        payment_qr_url = normalize_image_url(str(payload.get("paymentQrUrl", "")).strip())
        student_id = str(payload.get("studentId", "")).strip()

        if not full_name or not email or not phone or not address:
            return jsonify({"error": "fullName, email, phone, address are required"}), 400

        updates: dict[str, Any] = {
            "fullName": full_name,
            "dob": dob,
            "email": email,
            "phone": phone,
            "address": address,
            "avatarUrl": avatar_url,
            "paymentQrUrl": payment_qr_url,
        }
        if actor.get("role") == "standard":
            updates["studentId"] = student_id
            # Force re-verification when user changes student ID.
            current_student_id = str(actor.get("studentId", "")).strip()
            if student_id != current_student_id:
                updates["studentVerified"] = False

        users.update_one({"username": actor.get("username")}, {"$set": updates})
        safe = users.find_one({"username": actor.get("username")}, safe_user_projection())
        return jsonify({"ok": True, "user": safe})

    @app.post("/api/auth/request-verification")
    def request_verification() -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
        
        if actor.get("studentVerified", False):
            return jsonify({"error": "account already verified"}), 400
        
        # Get all admin emails
        admin_docs = list(users.find({"role": "admin"}, {"email": 1, "_id": 0}))
        admin_emails = [doc.get("email") for doc in admin_docs if doc.get("email")]
        
        if not admin_emails:
            # Fallback to the system email if no admins have emails set
            admin_emails = ["uitexchange.customerservice@gmail.com"]
            
        user_data = normalize_user_profile(actor)
        user_data["username"] = actor.get("username") # ensure username is there
        
        send_verification_request_email(admin_emails, user_data)
        
        return jsonify({"ok": True, "message": "verification request sent to admins"})

    @app.post("/api/admin/verify-student")
    def verify_student() -> Any:
        admin = get_current_user()
        if not admin:
            return jsonify({"error": "unauthorized"}), 401
        if admin.get("role") != "admin":
            return jsonify({"error": "forbidden"}), 403

        payload = request.get_json(silent=True) or {}
        username = str(payload.get("username", "")).strip()
        valid = bool(payload.get("valid", False))
        if not username:
            return jsonify({"error": "username is required"}), 400

        result = users.update_one(
            {"username": username, "role": "standard"},
            {"$set": {"studentVerified": valid}},
        )
        if result.matched_count == 0:
            return jsonify({"error": "standard user not found"}), 404
        return jsonify({"ok": True, "username": username, "studentVerified": valid})

    @app.get("/api/users/<username>")
    def get_public_user(username: str) -> Any:
        target = users.find_one({"username": username}, safe_user_projection())
        if not target:
            return jsonify({"error": "user not found"}), 404
        normalized = normalize_user_profile(target)
        return jsonify(normalized)

    @app.get("/api/cart")
    def get_cart() -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
        doc = users.find_one({"username": actor.get("username")}, {"_id": 0, "cartItems": 1})
        items = normalize_cart_items((doc or {}).get("cartItems", []))
        return jsonify({"items": items})

    @app.get("/api/orders/me")
    def get_my_orders() -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
        docs = list(orders.find({"username": actor.get("username")}).sort("_id", -1))
        return jsonify([normalize_order_doc(d) for d in docs])

    @app.get("/api/orders/seller")
    def get_seller_orders() -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
        uname = str(actor.get("username", "")).strip()
        docs = list(orders.find({"items.sellerUsername": uname}).sort("_id", -1))
        result: list[dict[str, Any]] = []
        for d in docs:
            normalized = normalize_order_doc(d)
            seller_items = [it for it in normalized["items"] if it.get("sellerUsername") == uname]
            if not seller_items:
                continue
            normalized["items"] = seller_items
            result.append(normalized)
        return jsonify(result)

    @app.get("/api/orders/admin")
    def get_admin_orders() -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
        if actor.get("role") != "admin":
            return jsonify({"error": "forbidden"}), 403
        docs = list(orders.find({}).sort("_id", -1))
        return jsonify([normalize_order_doc(d) for d in docs])

    @app.put("/api/orders/<order_id>/status")
    def update_order_status(order_id: str) -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401

        payload = request.get_json(silent=True) or {}
        next_status = normalize_order_status(payload.get("status"), "")
        if next_status not in ORDER_STATUS_OPTIONS:
            return jsonify({"error": "invalid status"}), 400

        try:
            oid = ObjectId(order_id)
        except Exception:
            return jsonify({"error": "invalid order id"}), 400

        existing = orders.find_one({"_id": oid})
        if not existing:
            return jsonify({"error": "order not found"}), 404

        order_doc = normalize_order_doc(existing)
        product_id_raw = payload.get("productId")
        product_id = None
        if product_id_raw is not None:
            try:
                product_id = int(product_id_raw)
            except (TypeError, ValueError):
                return jsonify({"error": "invalid productId"}), 400

        actor_is_admin = actor.get("role") == "admin"
        actor_uname = str(actor.get("username", "")).strip()
        buyer_uname = str(order_doc.get("username", "")).strip()

        updated = False
        for item in order_doc["items"]:
            if product_id is not None and int(item.get("productId", 0)) != product_id:
                continue
            # "đã nhận được hàng" is buyer-only confirmation.
            if next_status == "đã nhận được hàng":
                if actor_uname == buyer_uname:
                    item["status"] = next_status
                    updated = True
                continue

            # Other statuses are managed by seller/admin.
            if actor_is_admin or item.get("sellerUsername") == actor_uname:
                item["status"] = next_status
                updated = True

        if not updated:
            return jsonify({"error": "forbidden"}), 403

        orders.update_one({"_id": oid}, {"$set": {"items": order_doc["items"]}})
        refreshed = orders.find_one({"_id": oid})
        return jsonify({"ok": True, "order": normalize_order_doc(refreshed or existing)})

    @app.post("/api/refund")
    def submit_refund() -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
        
        payload = request.get_json(silent=True) or {}
        required = ["productId", "reason", "driveLink"]
        for f in required:
            if f not in payload:
                return jsonify({"error": f"Missing field: {f}"}), 400
        
        try:
            product_id = int(payload["productId"])
        except (TypeError, ValueError):
            return jsonify({"error": "invalid productId"}), 400
            
        reason = str(payload["reason"]).strip()
        drive_link = str(payload["driveLink"]).strip()
        
        # Verify purchase
        order = orders.find_one({
            "username": actor["username"],
            "items.productId": product_id
        })
        
        if not order:
            return jsonify({"error": "You must have purchased this product to request a refund"}), 403
            
        # Get product and seller info
        prod = products.find_one({"id": product_id}, {"_id": 0})
        if not prod:
            return jsonify({"error": "Product no longer exists"}), 404
            
        seller_username = prod.get("ownerUsername")
        seller = users.find_one({"username": seller_username}, {"email": 1})
        if not seller or not seller.get("email"):
            return jsonify({"error": "Seller contact info not found"}), 404
            
        # Record refund
        refund_doc = {
            "productId": product_id,
            "productName": prod.get("name", "Unknown"),
            "buyerUsername": actor["username"],
            "reason": reason,
            "driveLink": drive_link,
            "status": "pending",
            "createdAt": datetime.now().isoformat()
        }
        refunds.insert_one(refund_doc)
        
        # Send Email to Seller
        from email_service.send_mail import send_refund_email
        buyer_doc = users.find_one({"username": actor["username"]}, {"_id": 0, "fullName": 1})
        buyer_full = str((buyer_doc or {}).get("fullName", "")).strip()
        buyer_display = buyer_full or actor["username"]
        email_context = {
            "productId": str(product_id),
            "productName": str(prod.get("name", "Unknown")),
            "buyerUsername": actor["username"],
            "buyerFullName": buyer_display,
            "reason": reason,
            "driveLink": drive_link,
        }
        send_refund_email(seller["email"], email_context)
        
        return jsonify({"ok": True})

    @app.put("/api/cart")
    def put_cart() -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
        payload = request.get_json(silent=True) or {}
        items = normalize_cart_items(payload.get("items", []))
        users.update_one({"username": actor.get("username")}, {"$set": {"cartItems": items}})
        return jsonify({"ok": True, "items": items})

    @app.post("/api/discount-codes/validate")
    def validate_discount_code() -> Any:
        payload = request.get_json(silent=True) or {}
        code = str(payload.get("code", "")).strip()
        try:
            subtotal = int(payload.get("subtotal", 0))
        except (TypeError, ValueError):
            return jsonify({"error": "invalid subtotal"}), 400
        if subtotal <= 0:
            return jsonify({"error": "subtotal must be greater than 0"}), 400
        discount_amount, code_doc, err = compute_discount_for_order(code, subtotal)
        if err:
            return jsonify({"ok": False, "error": err, "discountAmount": 0, "totalAfterDiscount": subtotal}), 400
        return jsonify({
            "ok": True,
            "code": str(code_doc.get("code", "")).upper(),
            "discountAmount": discount_amount,
            "totalAfterDiscount": max(0, subtotal - discount_amount),
        })

    @app.get("/api/admin/discount-codes")
    def list_discount_codes() -> Any:
        admin = get_current_user()
        if not admin:
            return jsonify({"error": "unauthorized"}), 401
        if admin.get("role") != "admin":
            return jsonify({"error": "forbidden"}), 403
        docs = list(discount_codes.find({}, {"_id": 0}).sort("createdAt", -1))
        return jsonify([normalize_discount_code(d) for d in docs])

    @app.post("/api/admin/discount-codes")
    def create_discount_code() -> Any:
        admin = get_current_user()
        if not admin:
            return jsonify({"error": "unauthorized"}), 401
        if admin.get("role") != "admin":
            return jsonify({"error": "forbidden"}), 403
        payload = request.get_json(silent=True) or {}
        code = str(payload.get("code", "")).strip().upper()
        discount_type = str(payload.get("type", "fixed")).strip().lower()
        try:
            value = int(payload.get("value", 0))
            min_order_amount = int(payload.get("minOrderAmount", 0))
            max_discount_amount = int(payload.get("maxDiscountAmount", 0))
            total_uses = int(payload.get("totalUses", 0))
        except (TypeError, ValueError):
            return jsonify({"error": "invalid numeric fields"}), 400
        expires_at = str(payload.get("expiresAt", "")).strip()
        if not code:
            return jsonify({"error": "code is required"}), 400
        if discount_type not in {"fixed", "percent"}:
            return jsonify({"error": "type must be fixed or percent"}), 400
        if value <= 0:
            return jsonify({"error": "value must be > 0"}), 400
        if discount_type == "percent" and value > 100:
            return jsonify({"error": "percent value must be <= 100"}), 400
        doc = {
            "code": code,
            "type": discount_type,
            "value": value,
            "minOrderAmount": max(0, min_order_amount),
            "maxDiscountAmount": max(0, max_discount_amount),
            "active": True,
            "usesCount": 0,
            "totalUses": max(0, total_uses),
            "expiresAt": expires_at,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "createdBy": str(admin.get("username", "")).strip(),
        }
        try:
            discount_codes.insert_one(doc)
        except DuplicateKeyError:
            return jsonify({"error": "discount code already exists"}), 409
        return jsonify({"ok": True, "discountCode": normalize_discount_code(doc)})

    @app.delete("/api/admin/discount-codes/<code>")
    def delete_discount_code(code: str) -> Any:
        admin = get_current_user()
        if not admin:
            return jsonify({"error": "unauthorized"}), 401
        if admin.get("role") != "admin":
            return jsonify({"error": "forbidden"}), 403
        code_key = str(code or "").strip().upper()
        if not code_key:
            return jsonify({"error": "code is required"}), 400
        result = discount_codes.delete_one({"code": code_key})
        if result.deleted_count == 0:
            return jsonify({"error": "discount code not found"}), 404
        return jsonify({"ok": True, "deletedCode": code_key})

    @app.get("/api/admin/pending-users")
    def get_pending_users() -> Any:
        admin = get_current_user()
        if not admin:
            return jsonify({"error": "unauthorized"}), 401
        if admin.get("role") != "admin":
            return jsonify({"error": "forbidden"}), 403

        pending = list(
            users.find(
                {"role": "standard", "studentVerified": False},
                {"_id": 0, "password_hash": 0, "token": 0},
            ).sort("username", 1)
        )
        return jsonify(pending)

    @app.get("/api/admin/standard-users")
    def list_standard_users() -> Any:
        admin = get_current_user()
        if not admin:
            return jsonify({"error": "unauthorized"}), 401
        if admin.get("role") != "admin":
            return jsonify({"error": "forbidden"}), 403

        docs = list(
            users.find({"role": "standard"}, {"_id": 0, "password_hash": 0, "token": 0}).sort("username", 1)
        )
        return jsonify([normalize_user_profile(d) for d in docs])

    @app.delete("/api/admin/users/<username>")
    def admin_delete_user(username: str) -> Any:
        admin = get_current_user()
        if not admin:
            return jsonify({"error": "unauthorized"}), 401
        if admin.get("role") != "admin":
            return jsonify({"error": "forbidden"}), 403

        uname = str(username or "").strip()
        if not uname:
            return jsonify({"error": "username is required"}), 400

        target = users.find_one({"username": uname})
        if not target:
            return jsonify({"error": "user not found"}), 404
        if str(target.get("role", "")).strip().lower() != "standard":
            return jsonify({"error": "only standard accounts can be deleted here"}), 400

        products.delete_many({"ownerUsername": uname})
        users.delete_one({"username": uname})
        return jsonify({"ok": True, "deletedUsername": uname})

    @app.get("/api/products")
    def get_products() -> Any:
        # 1. Gọi hàm dọn dẹp sản phẩm hết hàng (nếu bạn đã viết hàm này)
        # cleanup_out_of_stock_products()
        
        # 2. Lấy toàn bộ sản phẩm từ MongoDB
        # Dùng {"_id": 0} để tránh lỗi ObjectId không gửi được qua JSON
        docs = list(products.find({}, {"_id": 0}).sort("id", 1))
        
        # 3. Chuẩn hóa dữ liệu cho Frontend dễ đọc
        for d in docs:
            d["price"] = int(d.get("price", 0))
            d["status"] = int(d.get("status", 0))
            d["quantity"] = int(d.get("quantity", 0))
            
            # Xử lý hình ảnh (lấy cái đầu tiên làm ảnh bìa)
            images = d.get("imageUrls") or []
            d["coverImageUrl"] = images[0] if images else ""
    
        # 4. Trả về cho Frontend
        return jsonify(docs)

    @app.post("/api/products")
    def upsert_product() -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
        if actor.get("role") == "standard" and not actor.get("studentVerified", False):
            return jsonify({"error": "student ID not verified. selling disabled"}), 403

        payload = request.get_json(silent=True) or {}

        required = ["name", "brand", "category", "price", "status", "quantity", "description"]
        missing = [f for f in required if f not in payload]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        # Tự sinh id mới
        last = products.find_one(sort=[("id", -1)])
        new_id = (last["id"] + 1) if last and "id" in last else 1

        try:
            image_urls = payload.get("imageUrls") or []
            if not isinstance(image_urls, list):
                raise ValueError("imageUrls must be a list")
            clean_urls = [normalize_image_url(str(x).strip()) for x in image_urls if str(x).strip()]
            if len(clean_urls) < 1 or len(clean_urls) > 5:
                return jsonify({"error": "imageUrls must contain from 1 to 5 images"}), 400
            doc = {
                "id": new_id,
                "name": str(payload["name"]).strip(),
                "brand": str(payload["brand"]).strip(),
                "category": str(payload["category"]).strip(),
                "price": int(payload["price"]),
                "status": int(payload["status"]),  # 1-99
                "quantity": int(payload["quantity"]),
                "description": str(payload["description"]).strip(),
                "tags": [str(x).strip() for x in (payload.get("tags") or []) if str(x).strip()],
                "imageUrls": clean_urls,
            }
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid field type(s)."}), 400

        if not doc["name"] or not doc["brand"] or not doc["category"] or not doc["description"]:
            return jsonify({"error": "Text fields cannot be empty."}), 400

        if doc["category"] not in PRODUCT_CATEGORIES:
            return jsonify({"error": "invalid category"}), 400
        if doc["quantity"] <= 0:
            return jsonify({"error": "quantity must be greater than 0"}), 400

        doc["ownerUsername"] = actor.get("username", "")
        products.insert_one(doc)
        doc.pop("_id", None)
        return jsonify({"ok": True, "mode": "created", "product": doc})

    @app.delete("/api/products/<int:product_id>")
    def delete_product(product_id: int) -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401

        existing = products.find_one({"id": product_id}, {"_id": 0})
        if not existing:
            return jsonify({"error": "product not found"}), 404

        is_admin = actor.get("role") == "admin"
        is_owner = existing.get("ownerUsername") == actor.get("username")
        is_verified_standard = actor.get("role") == "standard" and actor.get("studentVerified", False)

        if not is_admin and not (is_owner and is_verified_standard):
            return jsonify({"error": "forbidden"}), 403

        products.delete_one({"id": product_id})
        return jsonify({"ok": True, "deletedId": product_id})

    @app.put("/api/products/<int:product_id>")
    def update_product(product_id: int) -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401

        existing = products.find_one({"id": product_id}, {"_id": 0})
        if not existing:
            return jsonify({"error": "product not found"}), 404

        is_admin = actor.get("role") == "admin"
        is_owner = existing.get("ownerUsername") == actor.get("username")
        is_verified_standard = actor.get("role") == "standard" and actor.get("studentVerified", False)
        if not is_admin and not (is_owner and is_verified_standard):
            return jsonify({"error": "forbidden"}), 403

        payload = request.get_json(silent=True) or {}
        required = ["name", "brand", "category", "price", "status", "quantity", "description", "imageUrls"]
        missing = [f for f in required if f not in payload]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        try:
            image_urls = payload.get("imageUrls") or []
            if not isinstance(image_urls, list):
                raise ValueError("imageUrls must be a list")
            clean_urls = [normalize_image_url(str(x).strip()) for x in image_urls if str(x).strip()]
            if len(clean_urls) < 1 or len(clean_urls) > 5:
                return jsonify({"error": "imageUrls must contain from 1 to 5 images"}), 400
            update_doc = {
                "name": str(payload["name"]).strip(),
                "brand": str(payload["brand"]).strip(),
                "category": str(payload["category"]).strip(),
                "price": int(payload["price"]),
                "status": int(payload["status"]),
                "quantity": int(payload["quantity"]),
                "description": str(payload["description"]).strip(),
                "tags": [str(x).strip() for x in (payload.get("tags") or []) if str(x).strip()],
                "imageUrls": clean_urls,
            }
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid field type(s)."}), 400

        if not update_doc["name"] or not update_doc["brand"] or not update_doc["category"] or not update_doc["description"]:
            return jsonify({"error": "Text fields cannot be empty."}), 400
        if update_doc["category"] not in PRODUCT_CATEGORIES:
            return jsonify({"error": "invalid category"}), 400
        if update_doc["quantity"] <= 0:
            products.delete_one({"id": product_id})
            return jsonify({"ok": True, "mode": "deleted", "deletedId": product_id})

        products.update_one({"id": product_id}, {"$set": update_doc})
        updated = products.find_one({"id": product_id}, {"_id": 0})
        return jsonify({"ok": True, "mode": "updated", "product": updated})

    @app.post("/api/reports")
    def create_report() -> Any:
        actor = get_current_user()
        reporter = actor.get("username", "") if actor else "anonymous"
        payload = request.get_json(silent=True) or {}
        product_id = payload.get("productId")
        reason = str(payload.get("reason", "")).strip()
        drive_link = str(payload.get("driveLink", "")).strip()

        if not product_id or not reason:
            return jsonify({"error": "productId and reason are required"}), 400

        doc = {
            "productId": int(product_id),
            "reason": reason,
            "reporterUsername": reporter,
            "driveLink": drive_link,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        reports.insert_one(doc)
        
        # Notify admins
        admin_docs = list(users.find({"role": "admin"}, {"email": 1, "_id": 0}))
        admin_emails = [doc.get("email") for doc in admin_docs if doc.get("email")]
        if not admin_emails:
            admin_emails = ["uitexchange.customerservice@gmail.com"]
            
        send_report_email(admin_emails, {
            "productId": product_id,
            "reporterUsername": reporter,
            "reason": reason,
            "driveLink": drive_link
        })


        prod = products.find_one({"id": product_id}, {"_id": 0})
        if not prod:
            return jsonify({"error": "Product no longer exists"}), 404
        seller_username = prod.get("ownerUsername")
        seller = users.find_one({"username": seller_username}, {"email": 1})
        if not seller or not seller.get("email"):
            return jsonify({"error": "Seller contact info not found"}), 404
            
        from email_service.send_mail import send_refund_email
        buyer_doc = users.find_one({"username": actor["username"]}, {"_id": 0, "fullName": 1})
        buyer_full = str((buyer_doc or {}).get("fullName", "")).strip()
        buyer_display = buyer_full or actor["username"]
        email_context = {
            "productId": str(product_id),
            "productName": str(prod.get("name", "Unknown")),
            "buyerUsername": actor["username"],
            "buyerFullName": buyer_display,
            "reason": reason,
            "driveLink": drive_link,
        }
        
        send_report_seller_email(seller["email"], {
            "productId": product_id,
            "reporterUsername": reporter,
            "reason": reason,
            "driveLink": drive_link
        })

        return jsonify({"ok": True})

    @app.post("/api/orders")
    def create_order() -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
        if actor.get("role") == "standard" and not actor.get("studentVerified", False):
            return jsonify({"error": "student ID not verified. buying disabled"}), 403

        payload = request.get_json(silent=True) or {}
        items = payload.get("items", [])
        if not isinstance(items, list) or not items:
            return jsonify({"error": "invalid order payload"}), 400

        validated_items: list[dict[str, Any]] = []
        for item in items:
            try:
                product_id = int(item.get("productId"))
                qty = int(item.get("qty"))
            except (TypeError, ValueError):
                return jsonify({"error": "invalid order item"}), 400
            if qty <= 0:
                return jsonify({"error": "qty must be greater than 0"}), 400

            prod = products.find_one({"id": product_id}, {"_id": 0})
            if not prod:
                return jsonify({"error": f"product not found: {product_id}"}), 404
            stock = int(prod.get("quantity", 0))
            if qty > stock:
                return jsonify({"error": f"insufficient stock for product id {product_id}"}), 400

            validated_items.append(
                {
                    "productId": product_id,
                    "qty": qty,
                    "lineTotal": int(item.get("lineTotal") or (int(prod.get("price", 0)) * qty)),
                    "productName": str(prod.get("name", "")).strip(),
                    "sellerUsername": str(prod.get("ownerUsername", "")).strip(),
                    "status": "đã xác nhận",
                }
            )

        for item in validated_items:
            result = products.update_one(
                {"id": item["productId"], "quantity": {"$gte": item["qty"]}},
                {"$inc": {"quantity": -item["qty"]}},
            )
            if result.modified_count == 0:
                return jsonify({"error": f"insufficient stock for product id {item['productId']}"}), 400
        cleanup_out_of_stock_products()

        delivery_type = str(payload.get("deliveryType", "shipper")).strip().lower()
        if delivery_type not in {"direct", "shipper"}:
            delivery_type = "shipper"

        note = str(payload.get("note", "")).strip()
        subtotal_before_discount = sum(int(it.get("lineTotal", 0)) for it in validated_items)
        discount_code = str(payload.get("discountCode", "")).strip().upper()
        discount_amount, matched_code_doc, discount_err = compute_discount_for_order(discount_code, subtotal_before_discount)
        if discount_code and discount_err:
            return jsonify({"error": discount_err}), 400
        seller_subtotals: dict[str, int] = {}
        for it in validated_items:
            seller_u = str(it.get("sellerUsername", "")).strip()
            if not seller_u:
                continue
            seller_subtotals[seller_u] = int(seller_subtotals.get(seller_u, 0)) + int(it.get("lineTotal", 0))
        seller_discounts = split_discount_across_sellers(seller_subtotals, discount_amount)
        shipping_fee = 0
        total = max(0, subtotal_before_discount - discount_amount + shipping_fee)

        if delivery_type == "direct":
            full_name = str(payload.get("name", "")).strip()
            student_id = str(payload.get("studentId", "")).strip()
            tx_date = str(payload.get("transactionDate", "")).strip()
            tx_place = str(payload.get("transactionPlace", "")).strip()
            if not full_name or not student_id or not tx_date or not tx_place:
                return jsonify({"error": "direct deal requires name, studentId, transactionDate, transactionPlace"}), 400
            order = {
                "username": actor.get("username"),
                "items": validated_items,
                "deliveryType": "direct",
                "name": full_name,
                "studentId": student_id,
                "transactionDate": tx_date,
                "transactionPlace": tx_place,
                "phone": str(payload.get("phone", "")).strip(),
                "address": "",
                "payment": "Giao dịch trực tiếp",
                "note": note,
                "discountCode": discount_code,
                "discountAmount": discount_amount,
                "sellerDiscounts": seller_discounts,
                "subtotalBeforeDiscount": subtotal_before_discount,
                "total": total,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
        else:
            order = {
                "username": actor.get("username"),
                "items": validated_items,
                "deliveryType": "shipper",
                "name": str(payload.get("name", "")).strip(),
                "phone": str(payload.get("phone", "")).strip(),
                "address": str(payload.get("address", "")).strip(),
                "payment": str(payload.get("payment", "COD")).strip().upper(),
                "note": note,
                "discountCode": discount_code,
                "discountAmount": discount_amount,
                "sellerDiscounts": seller_discounts,
                "subtotalBeforeDiscount": subtotal_before_discount,
                "total": total,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
            if order["payment"] not in {"COD", "BANK_QR"}:
                return jsonify({"error": "payment must be COD or BANK_QR for shipper"}), 400
            if not order["name"] or not order["address"]:
                return jsonify({"error": "invalid order payload"}), 400

        orders.insert_one(order)
        order_id = str(order.get("_id"))

        # Send order success email
        user_email = actor.get("email", "").strip()
        if user_email:
            def format_vnd(amt):
                return "{:,.0f}đ".format(amt).replace(",", ".")

            order_items_data = []
            subtotal = 0
            for item in validated_items:
                prod = products.find_one({"id": item["productId"]}, {"_id": 0})
                if prod:
                    image_url = prod.get("imageUrls", [""])[0] if prod.get("imageUrls") else ""
                    order_items_data.append({
                        "name": prod.get("name", "Unknown"),
                        "qty": item["qty"],
                        "lineTotal": format_vnd(item["lineTotal"]),
                        "imageUrl": image_url
                    })
                    subtotal += item["lineTotal"]
            
            discount_amt = int(order.get("discountAmount", 0))
            total_amt = order.get("total", max(0, subtotal - discount_amt))
            
            delivery_addr = ""
            payment_method_label = ""
            if order.get("deliveryType") == "direct":
                delivery_addr = f"Giao dịch trực tiếp<br/>Ngày: {order.get('transactionDate')}<br/>Tại: {order.get('transactionPlace')}"
                payment_method_label = "Giao dịch trực tiếp"
            else:
                delivery_addr = f"{order.get('name')}<br/>{order.get('phone')}<br/>{order.get('address')}"
                payment_method_label = "Shipper - COD" if str(order.get("payment", "")).upper() == "COD" else "Shipper - Chuyển khoản QR"

            order_data = {
                "orderId": order_id,
                "productId": ", ".join([f"#{item['productId']}" for item in validated_items]),
                "items": order_items_data,
                "subtotal": format_vnd(subtotal),
                "shipping": format_vnd(discount_amt),
                "total": format_vnd(total_amt),
                "deliveryAddress": delivery_addr,
                "paymentMethod": payment_method_label,
            }
            send_order_success_email(user_email, order_data)

            # Notify Sellers
            seller_items: dict[str, list[dict[str, Any]]] = {}
            for item in validated_items:
                prod = products.find_one({"id": item["productId"]}, {"ownerUsername": 1})
                if prod:
                    owner = prod.get("ownerUsername")
                    if owner not in seller_items:
                        seller_items[owner] = []
                    
                    # Get product details for seller email
                    p_info = products.find_one({"id": item["productId"]}, {"_id": 0})
                    image_url = p_info.get("imageUrls", [""])[0] if p_info.get("imageUrls") else ""
                    seller_items[owner].append({
                        "name": p_info.get("name", "Unknown"),
                        "qty": item["qty"],
                        "lineTotal": format_vnd(item["lineTotal"]),
                        "imageUrl": image_url,
                        "productId": item["productId"]
                    })
            
            for owner, items in seller_items.items():
                seller_user = users.find_one({"username": owner}, {"email": 1})
                if seller_user and seller_user.get("email"):
                    seller_email = seller_user["email"]
                    seller_subtotal = int(seller_subtotals.get(owner, 0))
                    seller_discount = int(seller_discounts.get(owner, 0))
                    seller_order_data = {
                        "orderId": order_id,
                        "productId": ", ".join([f"#{it['productId']}" for it in items]),
                        "items": items,
                        "subtotal": format_vnd(seller_subtotal),
                        "shipping": format_vnd(seller_discount),
                        "total": format_vnd(max(0, seller_subtotal - seller_discount)),
                        "deliveryAddress": delivery_addr,
                        "paymentMethod": payment_method_label,
                    }
                    send_order_seller_email(seller_email, seller_order_data)

        if matched_code_doc:
            discount_codes.update_one({"code": matched_code_doc.get("code")}, {"$inc": {"usesCount": 1}})

        return jsonify({"ok": True})

    def normalize_lost_found_doc(doc: dict[str, Any]) -> dict[str, Any]:
        image_urls = doc.get("imageUrls") or []
        if not isinstance(image_urls, list):
            image_urls = []
        clean_urls = [normalize_image_url(str(x).strip()) for x in image_urls if str(x).strip()]
        return {
            "id": int(doc.get("id", 0)),
            "type": str(doc.get("type", "find_item")).strip(),
            "authorUsername": str(doc.get("authorUsername", "")).strip(),
            "createdAt": str(doc.get("createdAt", "")).strip(),
            "productName": str(doc.get("productName", "")).strip(),
            "foundLocation": str(doc.get("foundLocation", "")).strip(),
            "description": str(doc.get("description", "")).strip(),
            "lostDate": str(doc.get("lostDate", "")).strip(),
            "lostPlace": str(doc.get("lostPlace", "")).strip(),
            "fullName": str(doc.get("fullName", "")).strip(),
            "dob": str(doc.get("dob", "")).strip(),
            "email": str(doc.get("email", "")).strip(),
            "phone": str(doc.get("phone", "")).strip(),
            "address": str(doc.get("address", "")).strip(),
            "studentId": str(doc.get("studentId", "")).strip(),
            "avatarUrl": str(doc.get("avatarUrl", "")).strip(),
            "imageUrls": clean_urls[:3],
        }

    @app.get("/api/lost-found")
    def list_lost_found() -> Any:
        limit_raw = request.args.get("limit", type=int)
        q = str(request.args.get("q", "")).strip()
        query: dict[str, Any] = {}
        if q:
            pattern = re.escape(q)
            query["$or"] = [
                {"productName": {"$regex": pattern, "$options": "i"}},
                {"foundLocation": {"$regex": pattern, "$options": "i"}},
                {"description": {"$regex": pattern, "$options": "i"}},
                {"authorUsername": {"$regex": pattern, "$options": "i"}},
                {"fullName": {"$regex": pattern, "$options": "i"}},
                {"lostPlace": {"$regex": pattern, "$options": "i"}},
                {"lostDate": {"$regex": pattern, "$options": "i"}},
                {"phone": {"$regex": pattern, "$options": "i"}},
                {"email": {"$regex": pattern, "$options": "i"}},
            ]
        cursor = lost_found.find(query, {"_id": 0}).sort("id", -1)
        if limit_raw and limit_raw > 0:
            cursor = cursor.limit(limit_raw)
        docs = list(cursor)
        return jsonify([normalize_lost_found_doc(d) for d in docs])

    @app.get("/api/lost-found/<int:post_id>")
    def get_lost_found(post_id: int) -> Any:
        doc = lost_found.find_one({"id": post_id}, {"_id": 0})
        if not doc:
            return jsonify({"error": "not found"}), 404
        return jsonify(normalize_lost_found_doc(doc))

    @app.post("/api/lost-found")
    def create_lost_found() -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
        if actor.get("role") == "standard" and not actor.get("studentVerified", False):
            return jsonify({"error": "student ID not verified. posting disabled"}), 403

        payload = request.get_json(silent=True) or {}
        post_type = str(payload.get("type", "")).strip().lower()
        if post_type not in {"find_owner", "find_item"}:
            return jsonify({"error": "type must be find_owner or find_item"}), 400

        product_name = str(payload.get("productName", "")).strip()
        found_location = str(payload.get("foundLocation", "")).strip()
        description = str(payload.get("description", "")).strip()
        lost_date = str(payload.get("lostDate", "")).strip()
        lost_place = str(payload.get("lostPlace", "")).strip()
        full_name = str(payload.get("fullName", "")).strip()
        dob = str(payload.get("dob", "")).strip()
        email = str(payload.get("email", "")).strip()
        phone = str(payload.get("phone", "")).strip()
        address = str(payload.get("address", "")).strip()
        student_id = str(payload.get("studentId", "")).strip()
        avatar_url = normalize_image_url(str(payload.get("avatarUrl", "")).strip())

        if not product_name:
            return jsonify({"error": "productName is required"}), 400
        if not full_name or not email or not phone or not address:
            return jsonify({"error": "fullName, email, phone, address are required"}), 400

        if post_type == "find_owner":
            if not found_location:
                return jsonify({"error": "foundLocation is required for find_owner"}), 400
            lost_date = ""
            lost_place = ""
            description = ""
        else:
            found_location = ""

        image_urls = payload.get("imageUrls") or []
        if not isinstance(image_urls, list):
            return jsonify({"error": "imageUrls must be a list"}), 400
        clean_urls = [normalize_image_url(str(x).strip()) for x in image_urls if str(x).strip()]
        if len(clean_urls) < 1 or len(clean_urls) > 3:
            return jsonify({"error": "imageUrls must contain from 1 to 3 images"}), 400

        last = lost_found.find_one(sort=[("id", -1)])
        new_id = (last["id"] + 1) if last and "id" in last else 1
        now = datetime.now(timezone.utc).isoformat()

        doc = {
            "id": new_id,
            "type": post_type,
            "authorUsername": str(actor.get("username", "")).strip(),
            "createdAt": now,
            "productName": product_name,
            "foundLocation": found_location,
            "description": description,
            "lostDate": lost_date,
            "lostPlace": lost_place,
            "fullName": full_name,
            "dob": dob,
            "email": email,
            "phone": phone,
            "address": address,
            "studentId": student_id if actor.get("role") == "standard" else "",
            "avatarUrl": avatar_url,
            "imageUrls": clean_urls,
        }
        try:
            lost_found.insert_one(doc)
        except DuplicateKeyError:
            return jsonify({"error": "duplicate post id"}), 409
        except PyMongoError as exc:
            return jsonify({"error": f"database error: {str(exc)}"}), 500
        return jsonify({"ok": True, "post": normalize_lost_found_doc(doc)})

    @app.delete("/api/lost-found/<int:post_id>")
    def delete_lost_found(post_id: int) -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
        doc = lost_found.find_one({"id": post_id}, {"_id": 0})
        if not doc:
            return jsonify({"error": "not found"}), 404
        is_admin = actor.get("role") == "admin"
        is_author = str(doc.get("authorUsername", "")).strip() == str(actor.get("username", "")).strip()
        if not is_admin and not is_author:
            return jsonify({"error": "forbidden"}), 403
        lost_found.delete_one({"id": post_id})
        return jsonify({"ok": True, "deletedId": post_id})

    def normalize_message(d: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": str(d.get("_id", "")),
            "sender": d.get("sender", ""),
            "receiver": d.get("receiver", ""),
            "content": d.get("content", ""),
            "createdAt": d.get("createdAt", "")
        }

    @app.get("/api/messages")
    def get_conversations() -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
        me = actor.get("username", "")
        docs = list(messages.find({"$or": [{"sender": me}, {"receiver": me}]}).sort("_id", -1))
        convos = {}
        for d in docs:
            other = d["receiver"] if d["sender"] == me else d["sender"]
            if other not in convos:
                convos[other] = d
        result = []
        for k, v in convos.items():
            peer_doc = users.find_one({"username": k}, {"_id": 0, "username": 1, "avatarUrl": 1, "email": 1})
            peer_avatar = display_avatar_url(peer_doc or {"username": k})
            result.append(
                {
                    "username": k,
                    "lastMessage": normalize_message(v),
                    "peerAvatarUrl": peer_avatar,
                }
            )
        return jsonify(result)

    @app.get("/api/messages/<username>")
    def get_messages_with(username: str) -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
        
        if actor.get("role") == "standard" and not actor.get("studentVerified", False):
           return jsonify({"error": "Chỉ tài khoản đã được xác minh mới có thể chat."}), 403

        me = actor.get("username", "")
        query = {
            "$or": [
                {"sender": me, "receiver": username},
                {"sender": username, "receiver": me}
            ]
        }
        docs = list(messages.find(query).sort("_id", 1))
        return jsonify([normalize_message(d) for d in docs])

    @app.post("/api/messages/<username>")
    def send_message_to(username: str) -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
            
        if actor.get("role") == "standard" and not actor.get("studentVerified", False):
           return jsonify({"error": "Chỉ tài khoản đã được xác minh mới có thể chat."}), 403

        me = actor.get("username", "")
        payload = request.get_json(silent=True) or {}
        content = str(payload.get("content", "")).strip()
        if not content:
            return jsonify({"error": "empty message"}), 400
        doc = {
            "sender": me,
            "receiver": username,
            "content": content,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        messages.insert_one(doc)
        return jsonify(normalize_message(doc))

    return app


if __name__ == "__main__":
    app = create_app()
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    app.run(host=host, port=port, debug=True)

