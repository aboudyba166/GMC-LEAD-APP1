# Beginner guide: get Lead Command Center live on Hostinger

This app is a **Node.js** website (not a simple HTML page). Hostinger has to **install packages**, **build**, and **run** the app for you. Take it one step at a time.

---

## Part A — Before you touch Hostinger

### 1. Check your Hostinger plan

- You need **Node.js** support (Hostinger’s **Cloud** or **Business** plans that include “Node.js” in hPanel—not plain shared hosting with only PHP).
- If the panel has **“Node.js”** or **“Deploy from Git / ZIP”** for apps, you’re on the right track.

### 2. Get a Google API key (for your sheets)

1. Open [Google Cloud Console](https://console.cloud.google.com/) (use the same Google account you use for Sheets if you can).
2. Create a project (or pick an existing one).
3. **APIs & Services → Library** → enable **Google Sheets API**.
4. **APIs & Services → Credentials → Create credentials → API key**.
5. Copy the key and keep it **private** (like a password).

### 3. Make your Google Sheet readable by the app

- Open the sheet → **Share** → set **“Anyone with the link”** to **Viewer** (or stricter if Hostinger’s docs require it).  
- The server uses your API key; the sheet must be accessible that way for sync to work.

### 4. On your computer: make the upload zip (Windows)

1. Open the folder: **`GMC WEB APP 3\web`** (the folder that contains `package.json`).
2. **Optional but saves space:** delete folders **`node_modules`** and **`.next`** if they exist (you can run `npm install` and `npm run build` again later on your PC).
3. Open **PowerShell** in that `web` folder:  
   - Click the address bar, type `powershell`, press Enter.  
4. Run:
   ```powershell
   npm run zip:hostinger
   ```
   - If that fails, run:
   ```powershell
   .\scripts\zip-for-hostinger.ps1
   ```
5. **If PowerShell says “running scripts is disabled”** (for `npm` or `.ps1`):
   - **Easiest:** use **Command Prompt** instead: press **Win + R**, type `cmd`, Enter, then `cd /d` to your `web` folder and run `npm run zip:hostinger` (Command Prompt does not block `npm` this way).
   - **Or** in PowerShell (one-time for your user account):
     ```powershell
     Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
     ```
     Then try `npm run zip:hostinger` again.
   - **Or** from PowerShell without changing policy: `cmd /c "npm run zip:hostinger"` (from the `web` folder).

6. You should get a file: **`lead-command-center-hostinger.zip`** in the same `web` folder.  
7. This zip is what you will upload. It does **not** include secrets from `.env.local` (you will add the API key in Hostinger next).

---

## Part B — Hostinger hPanel (upload & configure)

*(Exact button names can vary; use search in hPanel for “Node” or “Websites”.)*

### 5. Log in to Hostinger

- Go to [hostinger.com](https://www.hostinger.com) → **Log in** → open **hPanel**.

### 6. Add or select your website / domain

- If you don’t have a domain yet, register one or use a free subdomain Hostinger gives you—this will be the **public address** of your app (e.g. `yoursite.com`).

### 7. Open the Node.js / application section

- Find **Websites** → your domain, or a section named **“Node.js”**, **“Advanced”**, or **“Deploy”**.
- You may need to **add a Node.js application** and point it to a folder (see next steps).

### 8. Upload the zip

- Use **File Manager** or **“Import from ZIP” / “Upload”** in the Node or website section.
- Upload **`lead-command-center-hostinger.zip`**.
- **Extract** the zip in the right place.
- **Important:** After extract, the folder that contains **`package.json`** should be the **Application root** (or “Node app root” / “document root for the app”—wording depends on hPanel).  
  - If the panel asks for a subfolder, choose the folder that has `package.json` inside it (often the folder you get right after unzipping once).

### 9. Set environment variables (secrets)

In the **same Node / Environment** area, add:

| Name | Value |
|------|--------|
| `GOOGLE_API_KEY` | *(paste the key from Part A, step 2)* |
| `NODE_ENV` | `production` |

- Do **not** put your key in a public chat or in a public GitHub repo. Only in **Hostinger’s environment** (or a server `.env` if the panel offers it).

- Optional, only if support tells you: **`DATABASE_PATH`** — path to `leads.db` on the server. If you skip it, the app uses `data/leads.db` under the app folder (Hostinger should keep that on disk; if in doubt, ask support).

- **Important — `NODE_ENV`:** set to exactly **`production`** (lowercase) for the live site. A wrong or duplicate value causes Next.js to show **“non-standard NODE_ENV”** and can break the build. If the panel has **separate** “build environment” and “runtime environment,” set **`production`** in both or follow Hostinger’s doc so only one value applies.

### 10. Set install, build, and start commands

Use exactly (unless Hostinger’s wizard fills them automatically):

| Step | Command |
|------|--------|
| **Install** | `npm install`  *(or `npm ci` if you also uploaded `package-lock.json` and the panel allows it)* |
| **Build** | `npm run build` |
| **Start** | `npm start` |

- **Start command** must not be `npm run dev` (that’s only for your computer). Production uses **`npm start`**.

- Hostinger will usually set **PORT** for you. Our app is configured to work with that.

### 11. Node.js version

- Select **Node.js 20** (or 22) if the panel offers a version picker—this matches the project’s `engines` in `package.json`.

### 12. Save / Deploy / Restart

- Click **Save**, **Deploy**, or **Restart** so the new commands and environment variables run.

### 13. Connect your domain to the app (if the panel shows this)

- Some setups need you to set the “web app” or “proxy” to the Node process. If Hostinger has a default **Nginx/Apache in front of Node**, use their default so **HTTPS (SSL)** works. Enable **Free SSL** in hPanel if you see the option.

### 13a. Optional — deploy from **GitHub** (often fixes EACCES vs ZIP)

Use this **instead of uploading a zip** (or if builds failed with `permission denied` on folders).

**On your computer (one-time)**

1. Create a [GitHub](https://github.com) account and a **new repository** (empty, no README required, or with README).
2. In the folder that contains your app (`GMC WEB APP 3` or only `web`), use **Git**:
   - If the **entire** repo is only the `web` app (recommended for simplicity), open a terminal in **`web`** and run:
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
     git push -u origin main
     ```
   - If your project is a **monorepo** (parent folder + `web` subfolder) and you push the **parent** folder, you will set **Root directory** to **`web`** in Hostinger (next step). Do **not** commit `node_modules`, `.next`, `.env.local`, or your `data/*.db` — they are in `.gitignore` for the `web` project.

3. On GitHub: **Settings → Secrets and variables** are for CI; for Hostinger you only need the **repo to be pushable** (use HTTPS with a personal access token, or install [GitHub Desktop](https://desktop.github.com) if the command line is new).

**In Hostinger hPanel** (wording can vary; search **“Git”** or **“GitHub”** or **“Deploy from Git”**)

1. Open your **Node.js** / **Website** that should run this app.
2. Find **Connect Git** / **Import from GitHub** / **Repository**.
3. **Authorize** Hostinger to access GitHub (OAuth or paste a **deploy key / token** if the panel asks).
4. Choose the **repository** and **branch** (usually `main`).
5. Set **Root directory** (important):
   - If the repo root is the **`web`** folder (and `package.json` is at the top of the repo) → use **`./`** or leave empty as your panel describes.
   - If the repo is **`GMC WEB APP 3`** and `package.json` is in **`web/`** → set **Root directory** to **`web`**.
6. Set the same as before: **Install** `npm install`, **Build** `npm run build`, **Start** `npm start`, **Node 20.x**, and environment variables `GOOGLE_API_KEY`, `NODE_ENV=production`.
7. **Save** and **Deploy**. Hostinger will **clone** the repo and build; file ownership is usually correct, which **reduces** `EACCES` build errors.

**When you change code later:** `git add`, `commit`, `push` to `main`, then in hPanel use **Redeploy** / **Pull latest** (or whatever your panel calls it) so the server rebuilds.

---

## Part C — Test in the browser

### 14. Open your live site

- Visit `https://yourdomain.com` (or the URL Hostinger shows).

### 15. Check that the API is up (optional)

- Open: `https://yourdomain.com/api/metrics`  
- You should see JSON with `totalLeads`, `newLeadsToday`, `lastSyncAt`, etc. (if this fails, the Node app is not running or the route is blocked.)

### 16. Use the app (Admin + sync)

1. Open **`/admin`** (e.g. `https://yourdomain.com/admin`).
2. Add your **Google Sheet** connection, column letters, and click **Save connections**.  
3. Return to the home page and click **Manual Sync**.

**Note:** sheet “connections” are stored in the **browser** (local storage), not on the server. **Each browser** (and each person) that uses the app should set Admin **once** on that device, or you’d need a future feature to store configs on the server.

---

## Part D — If something goes wrong

| Symptom | What to try |
|--------|--------------|
| “Cannot find module” / build fails on server | Set Node to **20+**, then run **Install** again, then **Build** again. |
| `better-sqlite3` / native module error | The build must run on **Hostinger’s Linux**; don’t copy `node_modules` from Windows. Let **`npm install` run on the server**. |
| 500 on API / sync | Check **`GOOGLE_API_KEY`** in hPanel, and that the **Sheets API** is enabled in Google Cloud. |
| App won’t “start” | Start command = **`npm start`**, not `dev`. |
| Port already in use | Use Hostinger’s default; don’t hardcode a port in a custom start script. |
| **`EACCES: permission denied, scandir`** during `next build` | The server user cannot read a folder in your app (common after a bad ZIP extract). In **hPanel → File Manager**, set **folders to 755** and **files to 644** for the whole app tree (or use **Advanced → Fix permissions** if available). If you have **SSH**: `cd` to your app folder, then `find . -type d -exec chmod 755 {} \;` and `find . -type f -exec chmod 644 {} \;`. Re-run **Build**. This repo no longer includes `/api/health` (which triggered some bad cases); always upload a **fresh** zip from `npm run zip:hostinger`. |
| **`EACCES` on `api/leads` or any `scandir` path** (Hostinger) | The **user that runs the build** (often under `public_html/.builds/...`) does not have **read + execute** on your `src` folders. Do this in order: (1) In **Environment variables**, set **`NODE_ENV`** to exactly **`production`** and remove any duplicate / weird values (see below). (2) **File Manager** → your project folder → **Change permissions** → **Recursive** → directories **755**, files **644**. (3) If you have **SSH** into the account, `cd` to the folder that contains `package.json` (the same path the error shows, often `.builds/source` or your app root) and run: `find . -type d -exec chmod 755 {} \;` and `find . -type f -exec chmod 644 {} \;`. (4) If it still fails, use **Git deploy** (connect GitHub) instead of ZIP so the server **owns** the files—this often fixes the mismatch. (5) **Hostinger support** with: “Next build returns EACCES scandir; which user runs the build vs file owner for Node?” |
| Next.js warns **“non-standard NODE_ENV”** | Set **`NODE_ENV`** to the exact word **`production`** in hPanel. Remove **`NODE_ENV`** from the build if the panel also injects it (avoid two definitions). **Do not** set `development` or a custom name for the live build. **Unset** in build env: `test`, `staging` unless the host requires them. |

- Use **Hostinger’s logs** (error log / Node app log) and copy the **error message** if you contact support.

---

## Part E — Updating the site later

1. **If you use a ZIP upload:** on your PC run **`npm run zip:hostinger`**, upload the new zip, extract, run **Install** (if `package.json` changed), **Build**, **Start**. Keep a copy of `data/leads.db` on the server if you need the same database.

2. **If you use GitHub:** on your PC `git add` → `git commit` → `git push` to the branch Hostinger uses (e.g. `main`). In hPanel, **redeploy** / **pull the latest** build. Same database note as above.

---

## Quick checklist

- [ ] Google Sheets API key created and set in Hostinger as `GOOGLE_API_KEY`  
- [ ] Sheet shared so the API can read it  
- [ ] `lead-command-center-hostinger.zip` uploaded and extracted so `package.json` is in the app root  
- [ ] `npm install` → `npm run build` → `npm start` (or the panel’s equivalent)  
- [ ] Site opens, `/api/metrics` works, Admin + Manual Sync works  

For Hostinger’s **exact** clicks, search their help for: **“deploy Node.js”** or **“Next.js on Hostinger”** and match your hPanel to their screenshots (they update the interface sometimes).

**More detail for this project:** see **`HOSTINGER.md`** in the `web` folder.
