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

Copy `.env.example` to `.env.local` for local use, or to `.env` for Docker Compose. For the Windows launcher, set `APP_URL=http://127.0.0.1:3000`; the example defaults to the server's LAN URL. Set a strong `ADMIN_PASSWORD` and a `SESSION_SECRET` of at least 32 characters. Generate the secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set `APP_URL` to the exact browser URL: `http://10.0.0.16:3009` for the current LAN deployment. HTTP sessions retain HttpOnly and SameSite=Strict cookies and origin checks; HTTPS URLs additionally enable Secure cookies. HTTP traffic is unencrypted, so use this configuration only on a trusted LAN. Sessions last 12 hours. Changing either the password or the session secret should invalidate existing sessions (the app signs sessions using both). With missing credentials, production is read-only: the server rejects edits, uploads, deletes, and exports. This app has one owner; public sign-up is not available.

For local use, keep `APP_URL=http://127.0.0.1:3000`. To reset your password, change `ADMIN_PASSWORD` in `.env.local` and restart the site. Keep the file private; it is ignored by Git. If your password contains `$`, write it as `\$` in the environment file, because Next.js expands unescaped dollar signs. Use quotes around values containing `#` or leading/trailing spaces.

## Home server / Docker

The target is Ubuntu Server at `10.0.0.16`, with the checkout at `/opt/docker/disctracker` and browser URL `http://10.0.0.16:3009`. Cloudflare and a public domain are not required. For full setup, Windows collection/photo transfer, backups, and optional future HTTPS, see [SERVER_HANDOFF.md](SERVER_HANDOFF.md).

```sh
cd /opt/docker/disctracker
docker compose -p disctracker config --quiet
docker compose -p disctracker up -d --build
```

Compose declares `name: disctracker`; keep this project name when deploying or updating. The container stores its database and photos in the existing persistent `disc-data` volume (Docker name `disctracker_disc-data`). Pull code updates from GitHub and run the same command to rebuild. Keep `.env`, databases, and uploads out of Git. Do not run `docker compose down -v` or remove/prune the data volume.

The host binding is `0.0.0.0:3009:3000`; the app and health check continue to use container port `3000`. Host port `3000` is untouched. On the phone, open `http://10.0.0.16:3009` while connected to the LAN. Allow access only from trusted LAN clients in your firewall, account for Docker's published-port rules, and do not forward port `3009` on the router. The collection is readable without login by anyone who can reach the app; owner login is required to edit.

For later public access, put HTTPS through a reverse proxy or tunnel in front of the app, restrict direct HTTP access, set `APP_URL` to the final HTTPS URL, and recreate the container. Secure cookies then enable automatically. Keep origin checks and cache headers intact. Cloudflare is optional, not a prerequisite; see the handoff guide before changing routing.

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
