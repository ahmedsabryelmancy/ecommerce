# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Layout

Two independent apps under `My-fullstack-app/`:

```
My-fullstack-app/
├── backend/    # Node.js / Express 5 / MongoDB (CommonJS, no build step)
└── frontend/   # React 19 + TypeScript + Vite
```

Each has its own `package.json`. There is no root-level workspace or shared tooling.

## Development Commands

### Backend
```bash
cd backend
npm install
npm start        # or npm run dev — runs node server.js directly on port 5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # Vite dev server (port 5173), proxies /api → http://localhost:5000
npm run build    # outputs to frontend/dist/
npm run preview  # preview production build locally
```

No linting or test commands exist in either package.

## Architecture

### Backend (`backend/server.js`)
The entire backend lives in a **single file**: Mongoose schemas, route handlers, auth middleware, Cloudinary config, and Express setup are all defined inline. There is no `src/` or routes/ directory.

**Key design points:**
- In production (`NODE_ENV=production`), Express serves `../frontend/dist` as static files and falls back to `index.html` for all non-API routes (SPA routing).
- The `if (!process.env.VERCEL)` guard wraps `app.listen()`; the file also exports `app` for serverless environments.
- Images are never written to disk — Multer uses `memoryStorage`, sharp processes the buffer, then streams to Cloudinary. `imagePublicId` is stored in MongoDB to support deletion.

**Auth:** JWT (7-day expiry) signed with `JWT_SECRET`. Token payload: `{ id, name, email }`. Protected routes use a `verifyToken` middleware that reads `Authorization: Bearer <token>`.

**API routes:**
| Method | Path | Auth |
|--------|------|------|
| GET | `/api/products` | public |
| POST | `/api/products` | required |
| PUT | `/api/products/:id` | required |
| DELETE | `/api/products/:id` | required |
| POST | `/api/products/:id/rate` | public |
| POST | `/api/login` | — |
| POST | `/api/register` | — |
| POST | `/api/seed` | required |

### Frontend (`frontend/src/`)
State is managed exclusively with **React Context** (no Redux/Zustand):
- `AuthContext` — JWT token + user object, persisted to `localStorage` under keys `ahmed-store-token` / `ahmed-store-user`.
- `CartContext` — cart items and totals, also persisted to localStorage.
- `WishlistContext` — saved items, localStorage.

All three contexts are wrapped by `AppShell.tsx` which is the provider tree at the app root.

The `features/products/` directory is the only feature module; everything else is in `pages/`, `sections/`, and `components/`.

Styling is plain CSS (`ahmed.css` + per-feature files in `styles/`). No Tailwind or CSS-in-JS.

### Known Type Mismatch
The frontend `Product` type ([frontend/src/types/product.ts](frontend/src/types/product.ts)) uses `img`, `id` (number), and `catetory` (typo), while the backend returns `image`, `_id` (ObjectId), `rating`, and `numReviews`. The mapping between these is done ad-hoc in components.

## Environment Variables

Backend only. Copy `backend/.env.example` to `backend/.env`:

```
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Frontend has no environment variables — the Vite proxy handles API routing in development.
