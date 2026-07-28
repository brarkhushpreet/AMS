# ClassPulse

ClassPulse is a teacher-owned classroom attendance platform with two focused roles: teacher and student. Teachers create classrooms, invite students by join code or CSV, choose a verification method for each attendance session, and review class- and student-level analytics.

## What changed

- Upgraded to Next.js 16.2, React 19.2, Tailwind CSS 4.3, Prisma 7, and current supporting packages.
- Removed the administrator role and all administrator routes.
- Replaced admin-assigned courses with teacher-owned classrooms and private join codes.
- Added CSV roster preview/import with existing-student enrollment and pending invitations.
- Added geolocation attendance with server-side distance verification.
- Replaced the reusable tone with signed WebSocket sessions and a rotating 17.2–18.8 kHz challenge sequence.
- Added Redis-backed dashboard caching and live challenge state.
- Added student, teacher, classroom, and individual-student analytics.
- Added a responsive public landing page and redesigned authentication/dashboard UI.

## Local setup

Requirements:

- Node.js 20.19 or newer
- PostgreSQL
- Redis (recommended; required for production realtime coordination)

Start PostgreSQL and Redis with Docker:

```bash
docker compose up -d
```

Then edit the local `.env` values as needed and run the app:

```bash
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The optional seed creates:

- Teacher: `teacher@classpulse.dev`
- Student: `student@classpulse.dev`
- Password for both: `ClassPulse2026`

Change all demo credentials before using the project beyond local development.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Long random secret for Auth.js and realtime tickets |
| `AUTH_TRUST_HOST` | Set to `true` behind a trusted reverse proxy |
| `REDIS_URL` | Redis connection for cache and live challenge state |
| `APP_HOST` | Server bind address, normally `0.0.0.0` |
| `NEXT_PUBLIC_APP_URL` | Canonical public URL used in metadata |
| `PORT` | Custom server port, default `3000` |

Generate a production secret with a cryptographically secure password/secret manager. Do not use the development fallback in production.

## Commands

```bash
npm run dev          # Next.js + WebSocket development server
npm run build        # Generate Prisma Client and create production build
npm start            # Production Next.js + WebSocket server
npm run lint
npm run typecheck
npm run db:migrate   # Create/apply a development migration
npm run db:deploy    # Apply committed migrations
npm run db:seed
```

## CSV format

Use the downloadable template on a classroom page. Supported headers are:

```csv
name,email,registrationNumber,department,class,batch
```

Header aliases such as `registration no`, `reg no`, `branch`, and `className` are accepted. Existing student accounts are enrolled immediately. Unknown emails receive a pending classroom invitation that is attached automatically when the matching student account is created.

## Verification model

### Geolocation

The teacher’s fresh browser location becomes the session center. The server calculates Haversine distance for each student submission and rejects readings outside the configured radius. Location can still be spoofed on a compromised device, so use it for convenient, lower-friction sessions.

### Rotating ultrasound

The teacher’s page emits short high-frequency tones that change roughly every 1.1 seconds. Authenticated students receive the expected challenge in realtime, analyze microphone input locally, and submit several time-bound matches. Redis stores the recent challenge window so static recordings and a single copied frequency cannot pass.

No browser-only attendance method is mathematically cheat-proof: a modified client or a sophisticated live relay can fabricate evidence. For high-stakes exams or regulated attendance, combine ClassPulse with supervision or trusted hardware.

### Bluetooth

Bluetooth beacon attendance is intentionally not included. The Web Bluetooth API remains experimental and unavailable in several major browsers, and the web platform still cannot provide reliable passive BLE beacon scanning across Chrome, Safari/iOS, and Firefox. A native mobile companion would be the appropriate place to add beacon support later. See [MDN Web Bluetooth](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API).

## Production notes

- Serve the app over HTTPS; microphone and precise-location APIs require a secure context outside localhost.
- Run `npm run db:deploy` as a release step, not during `npm run build`.
- Put the custom Node server behind a WebSocket-capable reverse proxy.
- Redis is optional for a single local process, but production deployments should configure it.
- Scale WebSocket instances with connection affinity or extend the included Redis Pub/Sub channel into a full cross-instance broadcaster.
- Back up the database before applying the modernization migration to an existing installation.
