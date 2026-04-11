from __future__ import annotations

import os
import secrets
import re
from typing import Any

import certifi
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError, PyMongoError
from werkzeug.security import check_password_hash, generate_password_hash

# Allowed product categories (must match frontend src/data/categories.js).
PRODUCT_CATEGORIES = (
    "Học tập & chuyên ngành",
    "Ký túc xá & Phòng trọ",
    "Công nghệ & Phụ kiện",
    "Thời trang & Phụ kiện sinh viên",
    "Thể thao & Giải trí",
    "Khác",
)

# Optional: set your Atlas URI directly here if you do not want terminal env vars.
# Leave empty string to use environment variable/fallback local MongoDB.
MONGODB_URI_DIRECT = "mongodb+srv://anhkhoi010107_db_user:55vgvwzaWyrbfDw2@uittradeweb.ikl85nw.mongodb.net/?appName=UITtradeweb"
# Optional: set admin registration code directly here for quick demo setup.
# Leave empty string to use environment variable ADMIN_REGISTRATION_CODE.
ADMIN_REGISTRATION_CODE_DIRECT = "tangay"


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    mongo_uri = MONGODB_URI_DIRECT.strip() or os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    mongo_db = os.getenv("MONGODB_DB", "shopee_clone")
    products_collection_name = os.getenv("MONGODB_COLLECTION", "products")

    client = MongoClient(mongo_uri, tlsCAFile=certifi.where())
    db = client[mongo_db]
    products: Collection = db[products_collection_name]
    users: Collection = db["users"]
    orders: Collection = db["orders"]
    products.create_index("id", unique=True)
    users.create_index("username", unique=True)
    users.create_index("token", unique=True, sparse=True)

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

    def cleanup_out_of_stock_products() -> None:
        products.delete_many({"quantity": {"$lte": 0}})

    @app.get("/api/health")
    def health() -> Any:
        return jsonify({"ok": True})

    @app.get("/api/products")
    def get_products() -> Any:
        cleanup_out_of_stock_products()
        docs = list(products.find({}, {"_id": 0}).sort("id", 1))
        for d in docs:
            d["price"] = int(d.get("price", 0))
            d["status"] = int(d.get("status", 0))
            d["quantity"] = int(d.get("quantity", 0))
            image_urls = d.get("imageUrls") or []
            if not isinstance(image_urls, list):
                image_urls = []
            clean_urls = [normalize_image_url(str(x).strip()) for x in image_urls if str(x).strip()]
            d["imageUrls"] = clean_urls[:5]
            d["coverImageUrl"] = d["imageUrls"][0] if d["imageUrls"] else ""
        return jsonify(docs)

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

        if not username or not password:
            return jsonify({"error": "username and password are required"}), 400
        if role not in {"standard", "admin"}:
            return jsonify({"error": "role must be standard or admin"}), 400
        if role == "admin":
            expected = ADMIN_REGISTRATION_CODE_DIRECT.strip() or os.getenv("ADMIN_REGISTRATION_CODE", "")
            if not expected or admin_code != expected:
                return jsonify({"error": "invalid admin registration code"}), 403

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
            "cartItems": [],
        }
        try:
            users.insert_one(user_doc)
        except DuplicateKeyError:
            return jsonify({"error": "duplicate field (username or token)"}), 409
        except PyMongoError as exc:
            return jsonify({"error": f"database error: {str(exc)}"}), 500
        return jsonify({"ok": True, "message": "registered"})

    @app.post("/api/auth/login")
    def login() -> Any:
        payload = request.get_json(silent=True) or {}
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", "")).strip()
        if not username or not password:
            return jsonify({"error": "username and password are required"}), 400

        user = users.find_one({"username": username})
        if not user or not check_password_hash(user.get("password_hash", ""), password):
            return jsonify({"error": "invalid credentials"}), 401

        token = secrets.token_urlsafe(32)
        users.update_one({"username": username}, {"$set": {"token": token}})
        safe = users.find_one({"username": username}, safe_user_projection())
        return jsonify({"ok": True, "token": token, "user": safe})

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
        return jsonify(user)

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

    @app.put("/api/cart")
    def put_cart() -> Any:
        actor = get_current_user()
        if not actor:
            return jsonify({"error": "unauthorized"}), 401
        payload = request.get_json(silent=True) or {}
        items = normalize_cart_items(payload.get("items", []))
        users.update_one({"username": actor.get("username")}, {"$set": {"cartItems": items}})
        return jsonify({"ok": True, "items": items})

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

        order = {
            "username": actor.get("username"),
            "items": validated_items,
            "name": str(payload.get("name", "")).strip(),
            "phone": str(payload.get("phone", "")).strip(),
            "address": str(payload.get("address", "")).strip(),
            "payment": str(payload.get("payment", "")).strip(),
            "note": str(payload.get("note", "")).strip(),
            "total": int(payload.get("total", 0)),
        }
        if not order["name"] or not order["address"] or not order["payment"]:
            return jsonify({"error": "invalid order payload"}), 400
        orders.insert_one(order)
        return jsonify({"ok": True})

    return app


if __name__ == "__main__":
    app = create_app()
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    app.run(host=host, port=port, debug=True)

