# Deploying Lead Command Center on Hostinger (Cloud / Node.js)

This folder (`web/`) is the app root. Use **Node.js 20+** in hPanel.

## 1. Repository layout

- If the Git repo is **only** this `web` folder, set the Hostinger app root to the repo root.
- If the repo is the monorepo with `web` inside, set **Application root** / **subfolder** to **`web`**, or only upload/clone the `web` directory.

## 2. Upload as a ZIP file

1. **Optional — smaller folder before zipping:** delete local **`web/.next`** and **`web/node_modules`** (they are large and not uploaded). Re-create anytime with `npm install` and `npm run build`. The zip script also skips them if they still exist.

2. **On your PC (Windows):** in the `web` folder, run:
   ```powershell
   .\scripts\zip-for-hostinger.ps1
   ```
   or `npm run zip:hostinger`  
   This creates **`lead-command-center-hostinger.zip`** next to `package.json`. The archive **excludes** `node_modules`, `.next`, `.git`, `data/`, `scripts/` (zip helper only), IDE folders, local `.env*.local`, any `*.log`, and previous `lead-command-center-hostinger.zip` files.

3. **In Hostinger hPanel:** use **Upload** / **Import from ZIP** (or deploy from archive), extract so that **`package.json`** sits in the **application root** Hostinger uses for Node.

4. **Then** set **Install** / **Build** / **Start** as in section 3, and add **environment variables** (section 4).

If you zip by hand, exclude the same folders so the archive stays small and the server runs `npm install` fresh.

## 3. Build and start (hPanel)

| Field | Value |
|--------|--------|
| **Install** | `npm ci` (or `npm install`) |
| **Build** | `npm run build` |
| **Start** | `npm start` |

- **`npm start`** runs `next start -H 0.0.0.0` so the process listens on all interfaces. **Do not** hardcode port `3000` in the start command: Hostinger usually sets the **`PORT`** environment variable, and Next.js will use it.
- To test production locally: `npm run start:local` (port 3000).

## 4. Environment variables (hPanel)

Set in **Environment variables** / **.env** (as allowed by the plan):

| Name | Required | Notes |
|------|----------|--------|
| `GOOGLE_API_KEY` | **Yes** | Google Cloud → Sheets API enabled; sheet shared “Anyone with the link (Viewer)”. |
| `NODE_ENV` | Recommended | Must be the exact value **`production`** for builds. If Next.js warns "non-standard NODE_ENV", remove duplicate or wrong values in hPanel. |
| `DATABASE_PATH` | If needed | Absolute path to your SQLite file on **persistent** storage, e.g. `.../data/leads.db`. If unset, the app uses `data/leads.db` under the current working directory. |
| `PORT` | Usually automatic | Set by the host; only override if the panel says so. |

Do **not** commit `.env` or API keys. Use the panel, not a committed file, for production secrets.

## 5. Native module (`better-sqlite3`)

The build must run on the **same OS** as production (Hostinger’s build is typically Linux). If the build fails on `better-sqlite3`, use Hostinger’s build logs; you may need their Node version to match `engines` in `package.json` (Node **20+**).

## 6. After deploy

- **“Is the app up?”** open `GET /api/metrics` — should return JSON (totals, `lastSyncAt`). (A separate `/api/health` was removed to avoid some Hostinger build permission issues on nested `api/health` paths.)
- **Browser:** Open your domain; complete **Admin** sheet settings and use **Manual Sync** (config is still stored in the browser; the server only needs the key and DB).
- **SSL:** enable in hPanel (usually automatic for the main domain).

## 7. Troubleshooting

- **App won’t start:** Check that the **start** command is `npm start` (not `next dev`) and that `PORT` is not hardcoded in a custom script.
- **500 on API:** Missing `GOOGLE_API_KEY` or DB path not writable; check `DATABASE_PATH` and permissions.
- **Empty leads:** No mock data is seeded; run a sheet sync from the UI.
