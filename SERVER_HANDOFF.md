# DiscTracker v1 — server handoff

Deploy this repository on the existing Ubuntu Server with Docker Compose and persistent SQLite/photo storage. No host Node.js installation, separate database server, Cloudflare Tunnel, or public domain is needed for this LAN deployment.

- Server LAN IP: `10.0.0.16`
- Checkout: `/opt/docker/disctracker`
- Browser URL: `http://10.0.0.16:3009`
- Host binding: `0.0.0.0:3009:3000`; the app and health check use container port `3000`
- Compose project: `disctracker`; data volume: `disctracker_disc-data`

Repository: https://github.com/brendanbrown812/DiscTracker

Before starting, choose an owner password and decide whether to transfer the collection already entered on the Windows PC. Keep credentials out of Git and shared logs. Reserve `10.0.0.16` in your LAN configuration so the URL stays stable.

Compose declares `name: disctracker`; the commands also explicitly use `-p disctracker`. Do not override the project name with another `-p` value or `COMPOSE_PROJECT_NAME`, since that could select a different volume. Existing storage is unchanged. Run one app instance; do not scale this SQLite deployment across servers.

## 1. Get the code

Prerequisites: Git, Docker Engine with the Compose plugin, and permission to run Docker. The server needs outbound internet access for image/dependency downloads and DiscIt lookups. If the repository is private, configure a read-only GitHub deploy key or other appropriate clone credentials.

Use the latest `main` branch. Do not commit `.env.local`, `.env`, `data/`, or `backups/`.

For a fresh checkout, have the deployment user create or obtain write permission on `/opt/docker`, then:

```sh
git clone https://github.com/brendanbrown812/DiscTracker.git /opt/docker/disctracker
cd /opt/docker/disctracker
docker --version
docker compose version
```

Use the existing checkout instead if present: `cd /opt/docker/disctracker` followed by `git pull --ff-only`. Check that host port **3009** is free. Host port **3000** belongs to another application and is not changed or used by this Compose mapping.

## 2. Configure production login

For a fresh clone:

```sh
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
nano .env
```

Put the generated secret and chosen credentials in `.env`:

```dotenv
ADMIN_PASSWORD='your-strong-owner-password'
SESSION_SECRET='paste-the-generated-64-character-hex-secret'
APP_URL=http://10.0.0.16:3009
```

The password and secret above are placeholders, not defaults to use. There is no registration or username: this password is the owner login. For an existing deployment, edit its existing `.env` instead of overwriting it, retaining the credentials if you want existing sessions to remain valid. You can use the same password you chose locally, but enter its actual characters, not a blindly copied Next.js-escaped value. Compose reads `.env`, not the PC's `.env.local`. Single quotes protect literal dollar signs; escape an embedded single quote as `\'`. See [Docker's environment-file syntax](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/#env-file-syntax).

`DATA_DIR` in `.env.example` is for non-Docker use. The Docker image fixes it at `/app/data`, backed by the Compose volume. Do not move storage into the container's disposable filesystem.

Use the exact LAN browser URL for `APP_URL`, including HTTP and port `3009`. The existing app sets HttpOnly and SameSite=Strict cookies; Secure is off for HTTP so the browser can use the session. Password verification, signed sessions, login throttling, and origin/CSRF checks remain enabled. HTTP does not encrypt the password or session in transit: use only on a trusted network, never directly on the public internet.

Configure both credentials before using owner login. Keep shell-level variables with these names from overriding the intended `.env` values. Avoid sharing plain `docker compose config` output, which contains resolved secrets; validate without printing them:

```sh
docker compose -p disctracker config --quiet
docker compose -p disctracker build
```

## 3. Optional: transfer the PC's existing collection

Skip this section for a fresh, empty collection. GitHub does not transfer disc records or photos, and JSON export is not a full photo backup.

On the Windows PC, stop the site with Ctrl+C in its launcher window. From the project folder run:

```powershell
npm run backup
```

Securely transfer the **contents of the timestamped backup folder** to `/opt/docker/disctracker-import/` on the server, outside the Git checkout. It should contain `disctracker.sqlite` and, if there were photos, `photos/`. Do not send credentials along with this backup. Keep the PC's original data and backup intact.

Import before starting the server app for the first time. The following command refuses to overwrite a nonempty destination volume:

```sh
docker compose -p disctracker run --rm --no-deps --user root \
  -v /opt/docker/disctracker-import:/import:ro \
  disctracker sh -c '
    set -eu
    test -f /import/disctracker.sqlite
    if [ -n "$(ls -A /app/data)" ]; then
      echo "Destination is not empty. Stop and plan a backed-up restore instead."
      exit 1
    fi
    cp /import/disctracker.sqlite /app/data/disctracker.sqlite
    if [ -d /import/photos ]; then
      cp -a /import/photos /app/data/photos
    fi
    chown -R node:node /app/data
  '
```

If the server already has data, do not force this import or combine two SQLite files. Back up the server collection and decide which collection to retain first. The Windows and server copies do not synchronize; use the server as the source of truth after the move.

## 4. Start and check the app

```sh
docker compose -p disctracker up -d
docker compose -p disctracker ps
docker compose -p disctracker logs --tail=100 disctracker
curl --fail http://127.0.0.1:3009/api/discs
curl --fail http://10.0.0.16:3009/api/discs
```

The container should become healthy after its health check runs. Its restart policy is `unless-stopped`; configure Docker itself to start at boot. Database initialization and schema migrations happen automatically on database access.

Storage is the named volume `disctracker_disc-data`, mounted at `/app/data`. It contains the database, any SQLite journal files, photos, and catalog cache. Rebuilding the image does not replace this volume. Confirm it exists:

```sh
docker volume inspect disctracker_disc-data
```

Inside the container, the health check calls `http://127.0.0.1:3000/api/discs`. Other containers on `disctracker_default` can reach `http://disctracker:3000`. Neither should use host port `3009` for container-to-container communication.

## 5. LAN access and network safety

The app publishes host port `3009` on all IPv4 interfaces so the phone and other LAN devices can connect. On your phone, connect to the trusted LAN Wi-Fi and open `http://10.0.0.16:3009`. `127.0.0.1` on the phone points to the phone, not the server. Cellular-only access is not part of this deployment.

Allow TCP `3009` from intended LAN clients in the server/network firewall. Do not forward it on the router or automatically expose it through an existing public proxy/tunnel. Binding to `0.0.0.0` does not itself guarantee LAN-only isolation if the server has other reachable networks. On Ubuntu, Docker-published ports can bypass ordinary UFW rules; use filtering compatible with your Docker firewall backend and verify access from allowed and disallowed networks. Do not disable Docker's firewall management. See [Docker's firewall guidance](https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw).

Privacy: anyone who can reach the app can browse the collection, notes, loss locations, and photos without signing in. Owner login protects editing, not viewing. Keep network access limited accordingly.

## 6. Acceptance checks on the phone

- Open `http://10.0.0.16:3009` from the phone and another computer on the trusted LAN.
- Tap the owner sign-in icon at the top right and enter `ADMIN_PASSWORD`; no username is needed.
- Add a disc and use the phone's photo chooser to take/select a picture. JPEG, PNG, and WebP are reliable; if a phone-generated HEIC file fails, use JPEG instead.
- Cancel the photo chooser and confirm the add-disc form stays open with its entered values.
- Save, reload, and confirm the photo, flight numbers, weight, purchase details, and location remain.
- Sign out and verify the collection is viewable but editing is unavailable.
- Restart the app container and confirm records/photos still exist.
- Verify the unrelated application on host port `3000` is unaffected.

Photo uploads are resized, converted to JPEG, and stripped of metadata. This is not a backup of the original full-resolution photo.

## 7. Backups and updates

Back up both the database and photos, not just Git or JSON exports. Stop the app briefly so the files represent one consistent snapshot. This example archives the entire named volume using Docker's [volume-backup pattern](https://docs.docker.com/engine/storage/volumes/#back-up-restore-or-migrate-data-volumes):

```sh
mkdir -p backups
chmod 700 backups
backup_file="disctracker-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
docker compose -p disctracker stop disctracker
docker run --rm \
  -v disctracker_disc-data:/data:ro \
  -v "$PWD/backups:/backup" \
  debian:bookworm-slim tar -czf "/backup/$backup_file" -C /data .
docker compose -p disctracker start disctracker
```

Check that the archive command succeeded. If it fails, restart the app but do not treat the backup as valid or proceed with an update. Copy successful backups to another machine/disk, protect them as private collection data, and periodically test restoring to an isolated instance. Back up `.env` separately using secure credential storage.

For code updates, first make a backup, then from the same checkout:

```sh
cd /opt/docker/disctracker
git pull --ff-only
docker compose -p disctracker config --quiet
docker compose -p disctracker up -d --build
docker compose -p disctracker ps
docker compose -p disctracker logs --tail=100 disctracker
```

Changing `.env` also requires recreating the container with `docker compose -p disctracker up -d`; merely restarting it does not load new Compose environment values. Changing either credential invalidates existing owner sessions.

Never run `docker compose down -v` or remove/prune `disctracker_disc-data`: that deletes the collection. For a restore, stop the app, preserve the current volume, restore the complete backup to an empty replacement volume, make its contents writable by `node:node`, and reconnect the app to it. Do not restore a live SQLite database or mix stale journal files with a different database snapshot.

## 8. Change the URL or enable HTTPS later

For a different LAN IP/hostname/host port, update `APP_URL` in `.env` to the exact browser origin and, if changing the port, update the host side of the Compose mapping. Keep container port `3000`, project name, and volume unchanged. Recreate the container with `docker compose -p disctracker up -d --build` and verify login and edits at the new URL.

Before public exposure:

1. Add a TLS-terminating reverse proxy with a valid certificate, or optionally a Cloudflare Tunnel. Do not publicly forward the current plaintext HTTP port.
2. Route the proxy to `http://disctracker:3000` on the app's Docker network, or `http://127.0.0.1:3009` for a proxy on the same host. Restrict the published app port to loopback (`127.0.0.1:3009:3000`) or remove its host publication for a networked container proxy.
3. Set `APP_URL=https://your-chosen-hostname` in `.env`, recreate the container, and sign in through HTTPS. Secure cookies enable automatically; direct HTTP login should no longer be used.
4. Preserve browser Origin headers and the app's security checks. Honor origin cache headers, do not cache authenticated `/api/*` responses, and use an 11 MB proxy request-body limit (individual photos are limited to 10 MB).
5. Decide whether unauthenticated collection viewing is acceptable. Gate the entire site with an access-control layer if not. Verify login, uploads, persistence, and network isolation before sharing the URL.

Cloudflare is optional. If selected later, follow its [tunnel setup guide](https://developers.cloudflare.com/tunnel/get-started/); there is no tunnel service or token in this repository's LAN configuration.

## Quick troubleshooting

- **Phone cannot connect:** check container health/logs, host port `3009`, Docker-aware firewall rules, and Wi-Fi client isolation. Try the server-side curls above. Use HTTP, not HTTPS, for the current URL.
- **Sign-in missing:** both `ADMIN_PASSWORD` and a `SESSION_SECRET` of at least 32 characters are required; recreate the container after configuring them.
- **Login fails or edits are rejected:** check the actual password, Compose quoting, and `APP_URL=http://10.0.0.16:3009`. Recreate after changes; an accidental HTTPS `APP_URL` produces Secure cookies that cannot be used on this LAN HTTP URL. Do not disable origin checks.
- **Empty collection after redeploy:** verify project name and volume mount; do not add new records until the original volume has been located.
- **Photo rejected:** keep input under 10 MB and try JPEG. Check upstream request limits and container write permissions.
- **DiscIt unavailable:** manual entry still works; previously cached lookups can be used. Check server outbound internet access.

The Docker image, LAN reachability, and existing volume must still be verified on the actual Ubuntu server. Repository preparation does not itself deploy anything or change server configuration.
