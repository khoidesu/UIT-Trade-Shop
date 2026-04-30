# Deploy Guide

## 1) Backend (Render/Railway)

1. Push code to GitHub.
2. Create a new Web Service from the repository.
3. Use `backend/requirements.txt` for dependencies.
4. Start command:
   - `gunicorn "app:create_app()" --chdir backend --bind 0.0.0.0:$PORT`
5. Set environment variables from `backend/.env.example`.

Required minimum:
- `MONGODB_URI`
- `MONGODB_DB`
- `ADMIN_REGISTRATION_CODE`
- `FRONTEND_ORIGINS`
- `SMTP_USER`
- `SMTP_PASS`

## 2) Frontend (Netlify/Vercel)

This project is static frontend (`index.html` + `src/*`).

### Option A (recommended): Set API base in `index.html`
Add this before `src/app.js` script:

```html
<script>
  window.__UIT_API_BASE__ = "https://your-backend-domain.com";
</script>
```

Then deploy frontend.

### Option B: Set manually in browser localStorage
Run once in DevTools:

```js
localStorage.setItem("uit_api_base", "https://your-backend-domain.com");
```

## 3) Production Checklist

- Remove/rotate any leaked old secrets.
- Confirm CORS only allows your frontend domains.
- Verify email sending works with SMTP app password.
- Verify login, cart, checkout COD/QR, discount, and admin discount management.
