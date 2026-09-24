# ClassPulse

Deployment instructions: [Cloudflare Workers + standalone realtime Node + Neon](docs/cloudflare-deployment.md).

ClassPulse is a teacher-owned classroom attendance platform built around
verifiable presence rather than a reusable QR code. Teachers create classrooms,
enroll students through join codes or CSV, run location or acoustic check-ins,
and inspect class- and student-level analytics.

## Technical highlights

- Next.js 16, React 19, TypeScript, Tailwind CSS 4 and Auth.js
- PostgreSQL with Prisma 7 and transaction-level authorization checks
- Redis caching, replay protection, leader election and WebSocket Pub/Sub
- Role-isolated realtime protocol with server-hidden acoustic challenges
- AudioWorklet signal processing using a Goertzel frequency bank
- Optional passkey-confirmed attendance using WebAuthn/passkeys
- Append-only SHA-256 audit chains and Ed25519-signed session reports
- Public report verifier and offline verification CLI
- URL-backed filters, pagination, analytics and accessible light/dark UI

The full protocol and threat model are documented in
[docs/presence-protocol.md](docs/presence-protocol.md).

## Local setup

Requirements:

- Node.js 20.19 or newer
- PostgreSQL
- Redis, recommended locally and required for horizontal realtime scaling

Start the local services:

```bash
docker compose up -d
```

Copy the environment template, replace the secrets, and start the application:

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The optional seed creates one teacher, two students, classrooms, and attendance
history. Fixture email addresses are listed in `prisma/seed.ts`; the local demo
password is `ClassPulse2026`. Seeding existing fixture accounts resets their
passwords and sample data, so do not run it against a production database.

Change demo credentials before using the project beyond local development.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Cache, challenge storage, leader election and Pub/Sub |
| `AUTH_SECRET` | Auth.js sessions and short-lived realtime tickets |
| `PRESENCE_PROOF_SECRET` | HMAC derivation for hidden acoustic challenges |
| `ATTENDANCE_SIGNING_SECRET` | Ed25519 report key and audit actor pseudonyms |
| `WEBAUTHN_RP_ID` | Passkey relying-party domain, such as `localhost` |
| `WEBAUTHN_ORIGIN` | Exact passkey origin, including scheme and port |
| `AUTH_TRUST_HOST` | Trust the configured reverse-proxy host |
| `APP_HOST` | Bind address, normally `0.0.0.0` |
| `NEXT_PUBLIC_APP_URL` | Canonical public URL used in metadata |
| `PORT` | Custom server port, default `3000` |

Use independent, high-entropy values for all three secrets in production.
Passkeys require HTTPS outside `localhost`, and `WEBAUTHN_ORIGIN` must exactly
match the browser origin.

## Commands

```bash
npm run dev          # Next.js and authenticated WebSocket server
npm run build        # Prisma generation and optimized Next.js build
npm start            # Production custom server
npm run lint
npm run typecheck
npm test             # Deterministic protocol and audit-chain tests
npm run test:integration # Isolated PostgreSQL + namespaced Redis concurrency tests
npm run benchmark    # Build first; two-node realtime + 500 synthetic HTTP check-ins
npm run db:migrate   # Create/apply a development migration
npm run db:deploy    # Apply committed migrations
npm run db:seed
npm run report:verify -- downloaded-report.json
npm run report:verify -- downloaded-report.json --trusted-key=BASE64URL_PUBLIC_KEY
```

## Verification model

### Geolocation

The teacher's fresh browser position becomes the session center. The server
checks Haversine distance, reading accuracy and the configured radius. Exact
student coordinates are not persisted; the evidence contains the calculated
distance and accuracy. Browser geolocation can be spoofed on a compromised
device, so this remains the convenient, lower-assurance method.

### Server-hidden acoustic challenges

An authenticated teacher socket receives an HMAC-derived frequency for each
short time slot. Students receive only the challenge identifier and capture
window. Their AudioWorklet scans the supported band locally and submits the
observed symbol, timing, amplitude and signal-to-noise ratio.

The server independently validates several fresh, continuous symbols against
Redis-backed hidden challenges. A modified student client therefore cannot read
the expected answer from WebSocket traffic or submit `expectedHz`.

### Passkey binding

Students can register passkeys under **Device security**. After presence is
accepted, the authenticator must sign a fresh server challenge with user
verification. Attendance records then show passkey-confirmed assurance. Students
without a passkey can still attend, but their records are marked as standard
assurance.

Once enabled, trusted-device changes require an assertion from an existing
passkey. The first registration produces eight one-time recovery codes for
authorizing a replacement device; the application never displays those codes
again.

### Signed attendance reports

Session start, challenge commitments, accepted proofs, device confirmations,
attendance writes and closure are chained through SHA-256 hashes. Closing the
session signs the sealed chain head with Ed25519. Teachers and students can:

- open the receipt from attendance history;
- share a read-only public verification URL;
- download the signed JSON artifact;
- pin the deployment's public key from
  `/api/attendance/signing-key`;
- verify it offline with
  `npm run report:verify -- report.json --trusted-key=BASE64URL_PUBLIC_KEY`.

Signature verification without a pinned key proves that the artifact is
self-consistent, but it does not prove which ClassPulse deployment signed it.
Pin the public key through a trusted channel before using an exported report as
independent evidence.

The artifact format is documented in
[docs/attendance-report.schema.json](docs/attendance-report.schema.json).

## CSV enrollment

The downloadable template accepts:

```csv
name,email,registrationNumber,department,class,batch
```

Aliases such as `registration no`, `reg no`, `branch`, and `className` are
accepted. Existing student accounts are enrolled immediately. Unknown emails
receive a pending invitation that attaches automatically after signup.

## Production notes

- Apply committed migrations with `npm run db:deploy` before starting the new
  application version.
- Keep `PRESENCE_PROOF_SECRET` and `ATTENDANCE_SIGNING_SECRET` stable; rotating
  the signing secret changes the report signing identity.
- Serve the application over HTTPS for microphone, geolocation and passkeys.
- Put the custom Node server behind a WebSocket-capable load balancer.
- Redis coordinates challenge generation across instances; a per-session lease
  and per-slot claim prevent split-brain emitters during normal failover.
- Configured Redis outages pause acoustic verification. Single-node mode is
  available only when REDIS_URL is absent.
- Back up PostgreSQL before applying migrations to an existing installation.
- Browser-based acoustic presence still cannot defeat a sophisticated live
  relay. High-stakes attendance requires supervision or trusted hardware.

Bluetooth beacon attendance remains excluded because passive, cross-browser BLE
scanning is not reliable on the web platform. A native mobile application is
the appropriate surface for that method.

## Equipment and verification testing

Open **Equipment check** in the workspace to play a known sweep on the teacher
speaker and measure reception on a student device. The listener exports local
measurements without raw microphone audio. This diagnostic never authorizes
attendance and is not a measured false-acceptance guarantee.

The integration runner discovers PostgreSQL through `pg_config` / `psql`, or
`PG_BIN`. It starts a separate temporary cluster on an unused loopback port,
applies the committed migrations there, runs the tests, and stops it. The runner
overrides DATABASE_URL before launching any child; the application database is
never migrated or seeded by these tests. Redis defaults to `redis://127.0.0.1:6379`; override with
`TEST_REDIS_URL`. Redis test keys have a unique prefix and are removed afterward.
PostgreSQL diagnostics remain in the ignored `.test-runtime` directory.

The tests cover duplicate proof consumption, replacement challenges, closure
races, receipt immutability, cross-classroom authorization, lease ownership,
atomic rate limits, and synthetic DSP input at 44.1/48 kHz. Physical-room
accuracy still needs measurements with real speakers, microphones, and seats.

See [measured benchmark results](docs/benchmark-results.md) for the reproducible
local workload and its limits, and [engineering decisions](docs/engineering-decisions.md)
for the concurrency, assurance, and design tradeoffs.
