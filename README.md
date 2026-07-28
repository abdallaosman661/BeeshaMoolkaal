# Beesha Moolkaal — ASP.NET + MongoDB + UploadThing

Full-stack media upload app for the Beesha Moolkaal community site:
- **backend/** — ASP.NET Core Web API (C#), stores file *metadata* (title, description, url, type...) in MongoDB
- **sidecar/** — small Node.js service that uploads the actual image/video files to UploadThing (returns a URL) and deletes them again when asked
- **frontend/** — the real site: `index.html` (home, with the Upload section + live portfolio gallery) plus the other community pages (`taariikhda.html`, `odayaal.html`, `midnimo.html`, `sawiro.html`, `siyaasiin.html`, `waxbarasho.html`, `deegaan.html`, `nabadoono.html`), `style.css`, and `script.js`

`script.js` now talks to the backend API instead of the browser's IndexedDB — uploads, the live gallery, and delete all persist to MongoDB/UploadThing and are visible from any device, not just the browser that uploaded them.

Why the sidecar exists: UploadThing doesn't ship an official .NET SDK — it's built for JS/TS. The sidecar is the officially-supported way to talk to it (~60 lines of Express), while everything else — your data, your logic, your frontend — stays in ASP.NET/Mongo.

```
you (browser) --> ASP.NET API (C#, port 5001) --> Node sidecar (port 4000) --> UploadThing
                         |
                         v
                     MongoDB (metadata: filename, url, type, size...)
```

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/) (for the sidecar)
- MongoDB running locally, OR a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- A free [UploadThing](https://uploadthing.com/dashboard) account + app (for the file token)

## Where your credentials live (and why)

Two real secrets are needed: your **UploadThing token** and your **MongoDB connection string** (which contains your DB password). Neither is stored in `appsettings.json` — that file gets committed to git and is easy to leak. Instead:

| Secret | Stored in | Committed to git? |
|---|---|---|
| UploadThing token | `sidecar/.env` | No — listed in `.gitignore` |
| Mongo connection string | .NET **user-secrets** (a file outside the repo, in your OS user profile) | No — never touches the repo at all |

The `.gitignore` in this project already excludes `.env` and any `appsettings.Local.json`/`*.secrets.json` files, so as long as you don't paste real credentials directly into `appsettings.json`, you're safe to commit and push the rest of the project.

## 1. Set up the upload sidecar

```bash
cd sidecar
npm install
```

`sidecar/.env` has already been created for you with your UploadThing token filled in — just run it:
```bash
npm start
```
You should see: `Upload sidecar running at http://localhost:4000`

## 2. Set up MongoDB (using .NET user-secrets)

```bash
cd backend
dotnet user-secrets init
dotnet user-secrets set "MongoSettings:ConnectionString" "mongodb+srv://abdallaosman661:abdalla1234@cluster0.jcialyy.mongodb.net/?appName=Cluster0"
```

`dotnet user-secrets init` adds the `UserSecretsId` link (already present in the `.csproj`); the `set` command writes your real connection string to a file **outside the project folder**, and ASP.NET Core automatically merges it into configuration at runtime in Development mode — no code changes needed, and it overrides the placeholder in `appsettings.json`.

No manual database/collection creation needed — MongoDB Atlas creates the `MediaFiles` collection automatically on first upload.

## 3. Run the ASP.NET backend

```bash
cd backend
dotnet restore
dotnet run
```

This is now pinned to `http://localhost:5000` (plain HTTP, no dev-certificate needed) via `Properties/launchSettings.json`. Your terminal should show:
```
Now listening on: http://localhost:5000
```
If it shows a different port for any reason, update `API_BASE` in `frontend/index.html` to match.

## 4. Open the frontend

Right-click `frontend/index.html` → **Open with Live Server** (or just open it directly in a browser). CORS is already enabled on the API for this. The site's other pages (`taariikhda.html`, `odayaal.html`, etc.) work as static pages via the nav links; only `index.html`'s Upload section and portfolio gallery talk to the backend.

## Using it

1. Choose an image or video file, click **Upload**.
2. The file streams: browser → ASP.NET → sidecar → UploadThing (stored) → URL comes back → ASP.NET saves `{ fileName, fileType, fileUrl, fileKey, fileSize, uploadedAt }` to MongoDB.
3. The gallery below reloads automatically and plays/shows the uploaded media straight from UploadThing's CDN URL.
4. **Delete** removes it from both MongoDB and UploadThing.

## API endpoints (backend)

| Method | Route              | Description                     |
|--------|--------------------|----------------------------------|
| POST   | /api/media/upload  | Upload an image or video file (form fields: `file`, `title`, `description`) |
| POST   | /api/media/link    | Save a YouTube link as a video entry (JSON: `title`, `description`, `videoUrl`) |
| GET    | /api/media         | List all uploaded media, newest first |
| DELETE | /api/media/{id}    | Delete a file (Mongo + UploadThing) |

## Troubleshooting

- **`ERR_CONNECTION_REFUSED` / "Failed to fetch" in the browser console** → nothing is listening on port 5000. This means `dotnet run` either isn't running, crashed on startup, or is running in a different terminal window than you think. Go to the terminal where you ran `dotnet run` and check for:
  - `Now listening on: http://localhost:5000` — if you see this, the backend is fine and the issue is elsewhere (e.g. a typo in `API_BASE`).
  - A red exception/stack trace instead — the app crashed before it could start. Common causes: a malformed Mongo connection string, or the `user-secrets set` command was run from a different folder than `backend/` (it must be run from inside `backend/`, next to the `.csproj`).
  - Nothing at all / the command seems to hang or the window was closed — just run `dotnet run` again and keep that terminal window open while you use the app.
- **"Could not reach upload sidecar"** → make sure `npm start` is running in `sidecar/` on port 4000.
- **CORS errors in browser console** → confirm the backend is actually running and `API_BASE` in `index.html` matches its real port.
- **Mongo connection errors** → confirm `mongod` is running locally, or that your Atlas connection string/IP allowlist is correct.
- **UploadThing errors mentioning the token** → double check you copied the **V7** token (not an older API key format) from the dashboard.
