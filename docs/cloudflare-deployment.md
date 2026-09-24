# Deploy ClassPulse: Cloudflare + Render + Neon

The production layout is:

| Responsibility | Host | Public address |
| --- | --- | --- |
| Next.js UI, Auth.js, dashboards, HTTP APIs | Cloudflare Workers | `https://classpulse.khushpreet.dev` |
| Ultrasound WebSocket coordinator | Render (temporary) | `wss://classpulse-realtime.khushpreet.dev/ws/attendance` |
| PostgreSQL | Neon | Private pooled `DATABASE_URL` |

The realtime process already has its own Dockerfile. Later it can move from Render to Cloudflare Containers without changing its public hostname or the browser protocol.

## 1. Prerequisites

Before starting, confirm that:

1. `khushpreet.dev` is an active zone in the same Cloudflare account that will own the Worker.
2. The repository is pushed to GitHub and the production branch is `main`.
3. Node.js 22 and npm are available locally.
4. `classpulse.khushpreet.dev` does not already have a conflicting DNS record. Wrangler will create and manage this custom-domain record.
5. `.env` is ignored and no database URLs or secrets are committed.

Install the locked dependencies once and run the existing local checks:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run test:demo
```

## 2. Create the Neon database

1. Create a Neon project in a region close to the expected users.
2. Open **Connect** and copy the pooled PostgreSQL URL. It normally contains `-pooler` in the hostname.
3. Store that URL as `DATABASE_URL` in the ignored local `.env` file.
4. Apply the committed Prisma migrations:

   ```powershell
   npm run db:deploy
   ```

5. Do not run `prisma migrate dev`, `prisma db push`, or `npm run db:seed` against production. Demo accounts create their isolated fictional records on first login.

## 3. Generate production secrets

Run this command three times:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Keep four different values in a password manager:

- `AUTH_SECRET`
- `PRESENCE_PROOF_SECRET`
- `ATTENDANCE_SIGNING_SECRET`

Never put these values in Git, screenshots, tickets, or documentation. `AUTH_SECRET` and `PRESENCE_PROOF_SECRET` must have the same respective values in the Cloudflare and Render environments.

## 4. Deploy the realtime service to Render

Render is hosting only the WebSocket process, not the Next.js application.

1. In Render, choose **New → Blueprint**.
2. Connect the GitHub repository and allow Render to read `render.yaml`.
3. Keep the free instance type for now. The Blueprint uses `Dockerfile.realtime` and starts `npm run start:realtime`.
4. Enter these Render environment values:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon pooled connection URL |
   | `AUTH_SECRET` | Generated Auth secret |
   | `PRESENCE_PROOF_SECRET` | Generated proof secret |
   | `ALLOWED_ORIGINS` | `https://classpulse.khushpreet.dev` |

5. Deploy the service.
6. Open `https://<render-service>.onrender.com/health`. The expected response is:

   ```json
   {"status":"ok","service":"classpulse-realtime"}
   ```

7. In the Render service, open **Settings → Custom Domains** and add `classpulse-realtime.khushpreet.dev`.
8. In Cloudflare DNS, create the CNAME Render requests:

   - Name: `classpulse-realtime`
   - Target: the exact `*.onrender.com` hostname shown by Render
   - Proxy status: **DNS only** initially, so Render can validate the hostname and issue TLS

9. Wait until Render marks the domain verified, then test:

   ```text
   https://classpulse-realtime.khushpreet.dev/health
   ```

The WebSocket endpoint is now:

```text
wss://classpulse-realtime.khushpreet.dev/ws/attendance
```

The free Render service sleeps after inactivity, so the first realtime connection can be slow. That does not affect normal pages, login, location attendance, or dashboards.

## 5. Create the Cloudflare Worker deployment

The repository is already configured for OpenNext in `open-next.config.ts` and `wrangler.jsonc`. The latter declares `classpulse.khushpreet.dev` as the Worker custom domain.

OpenNext packaging should run on Cloudflare's Linux builder or WSL. Its Prisma packaging step can fail on native Windows because Windows does not create the required symlinks.

### Recommended: connect GitHub to Workers Builds

1. Open **Cloudflare Dashboard → Workers & Pages**.
2. Choose **Create → Import a repository** and select this GitHub repository.
3. Set the Worker name to `classpulse`.
4. Configure the build:

   | Setting | Value |
   | --- | --- |
   | Production branch | `main` |
   | Root directory | `/` |
   | Build command | `npm run ci:cloudflare` |
   | Deploy command | `npm run publish:cloudflare` |
   | Node.js version | `22` |

5. Disable non-production branch deployments initially. A preview environment needs a separate database, Auth.js origin, passkey RP ID, and secrets; it must not share production data.

### Build-time variables and secrets

Cloudflare build values and Worker runtime values are separate. Under **Build → Variables and secrets**, add:

| Name | Type | Value |
| --- | --- | --- |
| `DATABASE_URL` | Secret | Neon pooled URL |
| `AUTH_SECRET` | Secret | Generated Auth secret |
| `NEXT_PUBLIC_APP_URL` | Variable | `https://classpulse.khushpreet.dev` |

`DATABASE_URL` is available to the production build because `npm run ci:cloudflare` applies pending Prisma migrations before building. If a check or migration fails, Cloudflare stops and does not publish the new Worker.

Use backward-compatible, expand-and-contract migrations: first add new fields/tables, deploy compatible code, migrate data, and only remove old schema in a later release.

## 6. Configure Worker runtime variables

In **Workers & Pages → classpulse → Settings → Variables and Secrets**, add these encrypted secrets:

| Secret | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled URL |
| `AUTH_SECRET` | Generated Auth secret |
| `PRESENCE_PROOF_SECRET` | Same proof secret used on Render |
| `ATTENDANCE_SIGNING_SECRET` | Generated signing secret |
The ordinary production variables are already versioned in `wrangler.jsonc`. Verify these values before the first deployment:

| Variable | Exact value |
| --- | --- |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_URL` | `https://classpulse.khushpreet.dev` |
| `NEXT_PUBLIC_APP_URL` | `https://classpulse.khushpreet.dev` |
| `REALTIME_PUBLIC_URL` | `wss://classpulse-realtime.khushpreet.dev/ws/attendance` |
| `WEBAUTHN_RP_ID` | `classpulse.khushpreet.dev` |
| `WEBAUTHN_ORIGIN` | `https://classpulse.khushpreet.dev` |
| `DEMO_MODE` | `true` |

Do not duplicate these variables in the dashboard. `wrangler.jsonc` is their source of truth. Do not include paths or trailing slashes in `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, or `WEBAUTHN_ORIGIN`.

## 7. Run the first deployment

Push a commit to `main`. Cloudflare Workers Builds will run this sequence:

```text
prisma generate
eslint
TypeScript typecheck
protocol/unit tests
demo-policy tests
prisma migrate deploy
OpenNext production build
Cloudflare Worker publish
```

The deploy reads the custom-domain route from `wrangler.jsonc`. Cloudflare creates the DNS association and provisions the certificate for `classpulse.khushpreet.dev`.

Follow the build log until the deployment succeeds. Then open:

```text
https://classpulse.khushpreet.dev
```

If the free Workers plan rejects the compressed bundle because it exceeds the plan limit, upgrade Workers; do not remove authentication, WebAuthn, attendance verification, or Prisma code merely to make the bundle smaller.

## 8. CI/CD behavior after setup

Every push to `main` now triggers two independent pipelines:

1. **Cloudflare Workers Builds** checks, migrates, builds, and deploys the web application.
2. **Render Auto-Deploy** rebuilds and restarts the realtime Docker service.

Pull requests do not deploy production. Keep Cloudflare preview builds disabled until a separate Neon preview branch and preview secrets are configured.

Before merging a schema change, ensure it works with both the currently deployed code and the incoming code, because the Cloudflare and Render deployments can finish at different times.

For an emergency rollback, use Cloudflare's deployment/version rollback for the Worker and Render's previous deployment rollback for the realtime service. Database migrations must be forward-compatible; do not assume application rollback also reverses the database.

## 9. Production smoke test

After the first successful deployment:

1. Load the landing page and switch between light and dark themes.
2. Open `/auth/login` and use **Try as teacher**.
3. Verify that the fictional teacher dashboard loads and remains read-only.
4. Sign out and use **Try as student**.
5. Verify that the fictional student dashboard loads and remains read-only.
6. Create separate real test accounts for write testing.
7. Copy a classroom code and verify the toast appears.
8. Test location attendance over HTTPS.
9. Open a teacher and student session on two devices and test ultrasound attendance.
10. Confirm both clients establish a WebSocket connection to `classpulse-realtime.khushpreet.dev`.
11. Test passkey registration only after the final domain is active; passkeys are tied to the RP hostname.

## 10. Move realtime from Render to Cloudflare later

After upgrading to Workers Paid:

1. Create a Cloudflare Container deployment using `Dockerfile.realtime`.
2. Add the same `DATABASE_URL`, `AUTH_SECRET`, `PRESENCE_PROOF_SECRET`, and `ALLOWED_ORIGINS` values to that service.
3. Route `classpulse-realtime.khushpreet.dev` to the new Cloudflare realtime service.
4. Keep the frontend's `REALTIME_PUBLIC_URL` unchanged.
5. Test `/health` and a full two-device ultrasound session.
6. Stop the Render service only after the Cloudflare service passes verification.

No database migration or browser change is required for this host move because PostgreSQL stays in Neon and the realtime public hostname remains stable.

## Local manual deployment fallback

If Workers Builds is unavailable, deploy from WSL/Linux:

```bash
npm ci
npx wrangler login
npm run ci:cloudflare
npm run publish:cloudflare
```

Set runtime secrets with `npx wrangler secret put NAME`, or through the Cloudflare dashboard. Never place production secret values in `wrangler.jsonc`.
