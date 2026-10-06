# DiscTracker

A personal disc golf collection app built with Next.js, React, TypeScript, Drizzle, and SQLite. Each physical disc has its own photo, plastic, color, weight, purchase details, location, and flight-number snapshot. Multiple copies of the same mold are separate records.

## Run locally

Use Node.js 24 or newer.

On Windows, double-click **start-local.bat**. It installs the locked dependencies, builds the site, and runs it at http://127.0.0.1:3000. Keep the command window open while using the site; press Ctrl+C to stop it. Stop any existing development server first so port 3000 is available.

On the first launch, the launcher creates `.env.local`, generates a session secret, and opens the file in Notepad. Set `ADMIN_PASSWORD` to your chosen password, save, and close Notepad, then press a key in the launcher window to continue. The first launch requires internet access to install dependencies. To build without configuring a login or starting the server, run `start-local.bat --build-only` from a terminal.

For development with automatic reloads:

```powershell
npm install
npm run dev
```

Open http://localhost:3000. The development server binds to your computer's loopback interface. Local development enables editing without a password unless `ADMIN_PASSWORD` is configured. No example discs are added to your real collection.

The SQLite database and uploaded photos are stored in `data/`, outside Git. DiscIt search is proxied through the server and cached for 24 hours; previously cached results are available during an API outage. Manual entry works at any time. Photos are converted to JPEG, resized, and stripped of metadata; PNG, JPEG, and WebP are reliable choices. Optional HEIC/AVIF support depends on the installed image decoder.

## Features

- Add, edit, view, and remove discs, including photos.
- DiscIt mold lookup and saved speed, glide, turn, and fade values.
- Grid and table views; location, manufacturer, plastic, category, and speed filters.
- Search by name, manufacturer, plastic, color, or location detail.
- Automatic added date and optional actual purchase date and seller.
- Lost/recovered workflow, date lost, and persistent location history.
- JSON collection export, including location history. Photos are backed up separately.
- Mobile layout, owner login, and public read-only access in production.

## Owner login

There is one owner login, with **no username and no registration screen**. If you used the Windows launcher, your password is the `ADMIN_PASSWORD` you set during first launch. Open the site, click the owner sign-in icon at the bottom of the left sidebar (top right on mobile), and enter that password. Visitors can browse the collection without signing in. The earlier `npm run dev` preview allows local editing without signing in when no password is configured; the launcher runs production mode and requires owner login to edit.

For manual setup:

Copy `.env.example` to `.env.local` for local use, or to `.env` for Docker Compose. Set a strong `ADMIN_PASSWORD` and a `SESSION_SECRET` of at least 32 characters. Generate the secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set `APP_URL` to the URL you will use, e.g. `https://discs.example.com`. HTTPS URLs enable Secure session cookies. Sessions last 12 hours. Changing either the password or the session secret should invalidate existing sessions (the app signs sessions using both). With missing credentials, production is read-only: the server rejects edits, uploads, deletes, and exports. This app has one owner; public sign-up is not available.

For local use, keep `APP_URL=http://127.0.0.1:3000`. To reset your password, change `ADMIN_PASSWORD` in `.env.local` and restart the site. Keep the file private; it is ignored by Git. If your password contains `$`, write it as `\$` in the environment file, because Next.js expands unescaped dollar signs. Use quotes around values containing `#` or leading/trailing spaces.

## Home server / Docker

```sh
docker compose up -d --build
```

The container stores its database and photos in the persistent `disc-data` volume. Pull code updates from GitHub and run the same command to rebuild. Keep `.env`, databases, and uploads out of Git. Do not run `docker compose down -v` unless you intend to remove your collection.

The host port is bound to `127.0.0.1:3000`. A Cloudflare Tunnel running on the host can point to `http://localhost:3000`. If the tunnel runs in another container, attach it to the same Docker network and use `http://disctracker:3000`. Set `APP_URL` to your Cloudflare HTTPS hostname before signing in. API responses are not cacheable; configure Cloudflare to honor origin cache headers and avoid caching `/api/*` except photos. Use a reverse proxy upload limit of 11 MB to bound request bodies before the app parses them.

Docker is not required for local use. For a local production run: `npm run build` then `npm start` (also loopback only). Configure owner credentials for editing.

`npm start` uses the generated standalone server. The startup script loads the project's environment files, supplies its static assets, and keeps the database and photos in the original `DATA_DIR`, even though the generated server runs from `.next/standalone`. The Windows launcher uses this same startup command.

## Backups and restore

Stop the app before backing up, so photo files and records are consistent. For a local install, run `npm run backup`. It writes a SQLite online backup plus photos to a timestamped directory under `backups/`. Keep a copy on another disk or machine. JSON export is useful for inspection, but is not a complete image backup.

For Docker, stop the app and archive the complete `disc-data` volume using your server's volume backup tooling. Restore with the app stopped. Preserve a copy of existing data, then restore `disctracker.sqlite` and `photos/` into the local `data/` directory or Docker volume, with write permissions for the container's `node` user. Restart the app. Schema migrations run automatically on first database access.

## Development checks

```sh
npm run check
npm test
npm run build
npm run smoke
```

Tests use an isolated temporary database and exercise validation, CRUD, loss/recovery history, uploads, origin protection, and catalog outage handling.

Catalog source: [DiscIt API](https://github.com/DiscIt-API/discit-api), which uses Marshall Street Disc Golf's flight guide. Flight numbers vary by run and plastic; edit the snapshot when appropriate.
