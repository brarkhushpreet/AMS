# Engineering decisions

These are implementation choices, not claims of production certification.

## One transaction boundary for attendance

PostgreSQL is the authority for enrollment, session state, proofs, and records.
Proof creation, passkey confirmation, and closure lock the session row and
recheck authorization inside the transaction. Conditional consumption binds an
assertion to the exact challenge and proof hash originally verified. A unique
student/session constraint remains the final duplicate-write guard.

The cost is intentional serialization within a session. Keep transactions short;
audio processing and WebAuthn signature verification happen outside the lock.
The integration suite exercises competing writers, a replaced proof, and closure
while another request waits. The load test measures this actual HTTP write path.

## Redis coordinates; PostgreSQL records

An ownership-checked Lua lease selects one emitter. A second Lua operation checks
the lease again, claims the time slot, stores its challenge, and publishes it.
The second check prevents a delayed former leader from publishing after failover.
Challenge commitments are persisted before publication. An unpublished commitment
may remain after a failed publication; it is an intent, not evidence of reception.

Configured Redis failures pause acoustic emission and reject distributed
rate-limit checks temporarily. They do not silently create independent leaders.
The server reconnects in the background. Omitting REDIS_URL explicitly selects
single-node development mode. Redis Cluster hash-slot routing is not supported
by this multi-key script/key layout; deploy against a single Redis primary.

## Client sensors are not trusted hardware

Student WebSockets never receive expected frequencies. A Hann-windowed Goertzel
bank measures the microphone stream locally; only observed symbols and quality
metrics leave the browser. The sequence changes with server secrets and time.
Shuffled banks prevent adjacent repetitions but reduce uncertainty toward a
bank's end. Client timestamps and quality metrics are forgeable.

Neither acoustics nor browser location can prove physical identity against a
colluding, real-time relay. The equipment screen measures reception, not fraud
prevention. The synthetic DSP tests establish numerical behavior, not classroom
false-accept/reject rates. Collect real measurements before making those claims.

## Passkeys confirm credentials, not unique devices

WebAuthn verifies control of a registered credential with user verification.
Synced passkeys may be used on more than one device. The interface therefore
says “passkey-confirmed”; evidence records the authenticator's device type and
backup state separately. The legacy database field `deviceVerified` denotes
credential confirmation, not biometric identity verification.

## Receipts are tamper-evident, not immutable storage

SHA-256 chains bind canonical events. An Ed25519 signature seals the chain head
and session summary. Verification must pin a trusted deployment key; trusting
only a key embedded in a downloaded file proves self-consistency, not origin.
An attacker who controls both the database and signing secret can rewrite and
re-sign history. This is not a replacement for external backups or key custody.

Custom-server SQL explicitly handles Prisma's UTC timestamps. The two-node test
reads custom-server events through Prisma and recomputes their hashes, covering
the cross-driver timezone bug observed on a non-UTC Windows host.

## A workspace, not a marketing animation

The interface uses a compact attached sidebar, neutral surfaces, modest borders,
and a shared light/dark token palette. Color identifies actions and status;
motion explains a changing signal or interaction. Decorative glow, large hover
lifts, and oversized welcome panels were removed. The auth companion remains
isolated from the operational dashboard.

## Evidence and remaining validation

Run `npm test`, `npm run test:integration`, and, after a production build,
`npm run benchmark`. Integration tests deploy the real migration history into a
temporary PostgreSQL cluster. No application database reset is required.

Outstanding validation includes physical speaker/microphone combinations,
cross-browser passkey ceremonies, network latency and broker-outage drills,
sustained production-like load, and independent security review. A successful
local burst and reconnect test does not substitute for these.
