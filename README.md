# Interactive Web Development Learning Platform

Full-stack server-rendered LMS/CMS: **Node.js · Express · EJS · MongoDB** (no React).

Administrators create and edit pages and content blocks without changing source code. Public visitors view published lessons; registered users can comment.

## Features

- Dynamic pages & lessons from MongoDB
- Nested content blocks (section, row, column, grid + content)
- Components: heading, text, image, video, code, card, hero, quiz, assignment, advert, etc.
- Style, animation, and responsive width controls
- Auth (register / login) with bcryptjs + sessions
- Admin: pages, media, comments, users, header/footer settings
- Draft / publish / preview / duplicate

## Local setup

```bash
cd coding
cp .env.example .env
# Edit .env with your MongoDB Atlas URI and SESSION_SECRET

npm install
npm run seed          # sample lessons + home/about/contact
npm run make-admin you@email.com
npm start
```

Open http://localhost:3000

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `MONGODB_DB_NAME` | Yes | Database name (e.g. `web_dev_learning`) |
| `SESSION_SECRET` | Yes | Long random string for sessions |
| `PORT` | No | Default `3000` (Render sets this automatically) |
| `NODE_ENV` | No | Use `production` on Render |

## Deploy on Render

### 1. MongoDB Atlas

1. Use an existing free/shared cluster (or create one).
2. **Network Access** → add IP `0.0.0.0/0` (allow Render).
3. **Database Access** → user with read/write.
4. Copy the connection string (`mongodb+srv://...`).

### 2. Push code to GitHub

Commit the `coding` folder contents as the repo root (or set Root Directory to `coding` in Render).

**Do not commit** `.env` or `node_modules`.

### 3. Create a Web Service on Render

- **Runtime:** Node
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Instance:** Free or Starter

### 4. Environment variables on Render

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | your Atlas URI |
| `MONGODB_DB_NAME` | `web_dev_learning` |
| `SESSION_SECRET` | long random string |

`PORT` is provided by Render — do not hard-code it.

### 5. After first deploy

From your machine (with the same `MONGODB_URI` in `.env`):

```bash
npm run seed
npm run make-admin your@email.com
```

Or use Atlas to insert an admin user after registering once via the live site, then:

```bash
npm run make-admin your@email.com
```

### Notes for production

- **Uploads:** files in `public/uploads` are stored on the server disk. On Render’s free tier the disk is **ephemeral** (files can disappear on redeploy). For permanent media, use a cloud bucket later or re-upload after deploys.
- **Sessions:** in-memory store is fine for small traffic; for multiple instances, switch to a Mongo session store later.
- **HTTPS:** Render terminates SSL; the app uses `trust proxy` and secure cookies when `NODE_ENV=production`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Production server |
| `npm run dev` | Server with `--watch` |
| `npm run seed` | Seed lessons + site pages |
| `npm run make-admin <email>` | Promote user to admin |

## Project structure

```
app.js / server.js
src/db, models, controllers, routes, middleware, utils
views/public, auth, admin, partials
public/css, js, uploads
```

Architecture: **Routes → Controllers → Models (MongoDB) → EJS views**.
