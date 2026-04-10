# Shopee Clone (School Project)

Simple Shopee-style storefront with:
- frontend: vanilla HTML/CSS/JS
- backend API: Flask + MongoDB
- product add/update: `POST /api/products`

## Features
- Home page with categories + search
- Product detail page
- Cart drawer (add/remove/quantity)
- Checkout page (mock order confirmation)
- Cart saved in `localStorage`
- Admin page (`#/admin`) to add/update product via POST
- Login/Register with roles (`standard`, `admin`)
- Student ID verification flow (`admin` approves standard users)
- Permission rules:
  - unverified standard user: view only
  - verified standard user: buy + add/update own products + delete own products
  - admin: can delete any invalid product + verify student IDs

## 1) Start MongoDB
Make sure MongoDB is running locally at:
- `mongodb://localhost:27017`

If you use MongoDB Atlas, set `MONGODB_URI` env var before running backend.

## 2) Run Backend API (Flask)
From project root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python seed.py
python app.py
```

Backend runs at:
- `http://127.0.0.1:8000`

Optional (for admin registration):
```bash
export ADMIN_REGISTRATION_CODE="your_secret_code"
```
Use this code when registering an admin account.

## 3) Run Frontend
From project root:

```bash
python3 -m http.server 5173
```

Open:
- `http://127.0.0.1:5173`

## API Endpoints
- `GET /api/products` -> list all products
- `GET /api/categories` -> list categories
- `POST /api/products` -> create/update product by `id`
- `DELETE /api/products/<id>` -> delete product (admin or owner rules)
- `POST /api/auth/register` -> create user account
- `POST /api/auth/login` -> login and receive token
- `GET /api/auth/me` -> current user profile
- `POST /api/auth/logout` -> logout
- `POST /api/admin/verify-student` -> admin verifies student ID status
- `POST /api/orders` -> create order (buy action)

### POST body example
```json
{
  "id": 700,
  "name": "Bluetooth Speaker",
  "brand": "SoundMax",
  "category": "Electronics",
  "price": 899,
  "rating": 4.7,
  "sold": 0,
  "description": "Portable speaker with deep bass.",
  "tags": ["New", "Discount"]
}
```

## Project structure
- `index.html` - app shell
- `styles.css` - styles
- `src/app.js` - router + app wiring
- `src/lib/api.js` - frontend API client
- `src/store/cart.js` - localStorage cart store
- `src/views/views.js` - UI render functions
- `backend/app.py` - Flask API (MongoDB)
- `backend/seed.py` - seed script
- `backend/seed_products.json` - initial products

