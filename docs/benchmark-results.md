# Reproducible local benchmark

Measured on 2026-09-07 with Node v24.18.0 on Windows, local PostgreSQL 18 and
Redis, using the production Next.js/custom-server build. This is a local burst
test, not a production capacity or acoustic-accuracy claim.

## Workload

- 500 synthetic students across five classrooms; 25 concurrent HTTP requests.
- Real `/api/attendance/mark` authorization, PostgreSQL transactions, Redis
  rate limits, and audit writes. Test-only JWTs are issued before timing; login
  and passkey ceremonies are not included.
- Two WebSocket nodes, with 20 student receivers on one node and the teacher
  emitter on the other. Teacher reconnects to the survivor and the original
  process is terminated. The test checks recovery and that no student message
  contains the expected frequency.
- Custom-server audit events are read through Prisma and their hash chain is
  recomputed to verify cross-driver UTC timestamp consistency.

## Observed run

| Measurement | Result |
| --- | ---: |
| HTTP requests / persisted records | 500 / 500 |
| Failed requests | 0 |
| Check-in phase duration | 6.501 s |
| Throughput | 76.9 requests/s |
| p50 / p95 / p99 latency | 293 / 592 / 909 ms |
| Teacher-node recovery | 3,702 ms |
| Student frequency isolation | Passed |
| Cross-driver audit hash consistency | Passed |

An earlier run on the same workstation measured 840 ms p95 and 44.8 requests/s.
The variation is a reason to report the workload and environment rather than
present a workstation result as a service-level objective. Other local processes
were not isolated and the database was temporary, not a tuned production server.

## Reproduce

Install PostgreSQL locally (or set `PG_BIN`) and start a local Redis instance.
Then run sequentially:

```bash
npm run build
npm run benchmark
```

The runner applies the committed migrations to a temporary loopback-only
PostgreSQL cluster. It never seeds or migrates the application database. Each
run uses unique session IDs for Redis keys, which expire after the test.
Diagnostic files and machine-readable results remain under the ignored
`.test-runtime` directory; the cluster and child servers are stopped afterward.

Optional environment settings: `TEST_REDIS_URL`, `BENCHMARK_STUDENTS` (10–2000),
`BENCHMARK_CONCURRENCY` (1–100), and `BENCHMARK_P95_MS` (default 2000).
The benchmark fails on HTTP errors, missing records, frequency disclosure,
invalid audit hashes, failed realtime recovery, or an exceeded p95 threshold.

It does not measure browser rendering, authentication throughput, microphone
accuracy, malicious relays, Redis node loss, or long-running memory behavior.
