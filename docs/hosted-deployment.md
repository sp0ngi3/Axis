# Private hosted Axis

This deployment mirrors the private Repetitio layout. Cloudflare Access protects the complete hostname, Cloudflare Tunnel is the only public entry point, Nginx serves the PWA and forwards same-origin `/api/` traffic, and the API owns one SQLite database plus its backups.

```text
Browser → Cloudflare Access → Tunnel → Nginx → Axis API → SQLite
                                                        └→ backups
```

No application port is published on the VPS. Persistent files live outside the checkout:

- repository: `/opt/axis`
- database: `/srv/axis/data/axis.db`
- backups: `/srv/axis/backups`
- tunnel credentials: `/etc/axis/credentials.json`
- tunnel settings: `/etc/axis/hosted.env`
- hostname: `life.kamilstudzinski.dev`

## Cloudflare preparation

Create a private Cloudflare Access self-hosted application for `life.kamilstudzinski.dev` with an Allow policy limited to the intended identity. Create a locally managed Cloudflare Tunnel for Axis and route the hostname to that tunnel.

Cloudflare references: [create a locally managed tunnel](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/create-local-tunnel/) and [protect a self-hosted application with Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/).

Copy its credentials JSON to `/etc/axis/credentials.json`. Store the deployment values in `/etc/axis/hosted.env`:

```dotenv
AXIS_TUNNEL_UUID=your-axis-tunnel-uuid
CLOUDFLARE_TEAM_NAME=your-team-name
AXIS_ACCESS_AUD=your-axis-access-application-audience
```

Use the same team name as Repetitio. The Axis Access application has its own audience value. Do not commit either file.

## First VPS deployment

Docker Engine and Compose are already present when the VPS hosts Repetitio. Prepare separate Axis directories and clone the repository:

```sh
install -d -m 0750 /srv/axis/data /srv/axis/backups /etc/axis
cd /opt
git clone https://github.com/sp0ngi3/Axis.git axis
cd /opt/axis
```

Copy the Axis tunnel credentials to `/etc/axis/credentials.json`, create `/etc/axis/hosted.env`, and set restrictive permissions that still allow the cloudflared container to read the credentials.

Validate and start the private stack:

```sh
cd /opt/axis
dc() { docker compose --env-file /etc/axis/hosted.env -f docker-compose.hosted.yml "$@"; }
dc config --quiet
dc up -d --build --wait axis-api axis-web
dc up -d axis-tunnel
dc ps
```

Open `https://life.kamilstudzinski.dev`, complete Cloudflare Access login, and verify `/api/health`. A signed-out private browser window must be stopped by Access.

For the initial data move, export a ZIP from the current Axis installation and import it through **Safety → Backup** after signing in to the hosted instance. Keep the original ZIP outside the server. The import validates the archive and creates a safety backup before replacing a populated database.

## Daily backups

The hosted API creates one validated `axis-daily-YYYYMMDD.zip` snapshot at 03:00 Europe/Berlin. Starting the API after 03:00 creates the missing snapshot for that day immediately. Only the three newest daily snapshots are rotated. Manual `axis-backup-*` exports and `axis-safety-before-*` upgrade backups are not removed.

```sh
ls -lht /srv/axis/backups/axis-daily-*.zip
```

## Safe updates

Before every update, export the currently running database to a temporary file outside the three-file daily rotation. Rename it only after the HTTP export succeeds, then pull and rebuild:

```sh
(
  set -e
  cd /opt/axis
  dc() { docker compose --env-file /etc/axis/hosted.env -f docker-compose.hosted.yml "$@"; }

  backup=$(mktemp --suffix=.partial /srv/axis/backups/axis-before-update-XXXXXXXX)
  dc exec -T axis-web \
    wget -qO- http://127.0.0.1/api/backup/export > "$backup"
  test -s "$backup"
  mv -- "$backup" "${backup%.partial}.zip"

  git pull --ff-only
  dc up -d --build --wait axis-api axis-web
  dc up -d axis-tunnel
)
```

After deployment:

```sh
docker compose --env-file /etc/axis/hosted.env -f /opt/axis/docker-compose.hosted.yml ps
docker compose --env-file /etc/axis/hosted.env -f /opt/axis/docker-compose.hosted.yml logs --tail=80 axis-api axis-web axis-tunnel
curl -I https://life.kamilstudzinski.dev
ls -lht /srv/axis/backups | head
```

The VPS-specific tunnel values remain in `/etc/axis`, so normal `git pull --ff-only` updates do not overwrite them.
