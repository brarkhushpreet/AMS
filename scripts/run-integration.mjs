import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import net from "node:net";

// Never loads .env: tests must not migrate or reset the application database.
const root = resolve(import.meta.dirname, "..");
const runtime = join(root, ".test-runtime");
mkdirSync(runtime, { recursive: true });
const directory = mkdtempSync(join(runtime, "postgres-"));
const windows = process.platform === "win32";
let bin = process.env.PG_BIN;
if (!bin) {
  try { bin = execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim(); }
  catch {
    try { bin = dirname(execFileSync(windows ? "where.exe" : "which", ["psql"], { encoding: "utf8" }).trim().split(/\r?\n/)[0]); }
    catch { throw new Error("Install PostgreSQL locally or set PG_BIN to its bin directory. Tests use an isolated temporary cluster."); }
  }
}
const pgTool = name => join(bin, name + (windows ? ".exe" : ""));
if (!existsSync(pgTool("initdb"))) throw new Error("PG_BIN must contain initdb and pg_ctl.");
const listener = net.createServer();
await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const url = `postgresql://postgres@127.0.0.1:${port}/postgres`;
let started = false;
try {
  execFileSync(pgTool("initdb"), ["-D", join(directory, "data"), "-U", "postgres", "-A", "trust", "--encoding=UTF8", "--locale=C"], { windowsHide: true, stdio: "pipe" });
  execFileSync(pgTool("pg_ctl"), ["-D", join(directory, "data"), "-l", join(directory, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"], { windowsHide: true, stdio: "ignore", timeout: 30000 });
  started = true;
  const env = { ...process.env, DATABASE_URL: url, TEST_DATABASE_URL: url, TEST_REDIS_URL: process.env.TEST_REDIS_URL ?? "redis://127.0.0.1:6379", AUTH_SECRET: "integration-auth-secret-with-32-bytes", ATTENDANCE_SIGNING_SECRET: "integration-report-secret-with-32-bytes", PRESENCE_PROOF_SECRET: "integration-presence-secret-with-32-bytes" };
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { cwd: root, env, stdio: "pipe" });
  console.log("Testing against an isolated PostgreSQL cluster and uniquely namespaced Redis keys.");
  const arguments_ = process.argv.includes("--benchmark")
    ? ["--import", "tsx", "scripts/benchmark-attendance.ts"]
    : ["--import", "tsx", "--test", "tests/integration.test.ts"];
  const result = spawnSync(process.execPath, arguments_, { cwd: root, env, stdio: "inherit", windowsHide: true });
  process.exitCode = result.status ?? 1;
} finally {
  if (started) execFileSync(pgTool("pg_ctl"), ["-D", join(directory, "data"), "-m", "fast", "-w", "stop"], { windowsHide: true, stdio: "pipe" });
  console.log("Temporary PostgreSQL stopped. Diagnostic files retained under .test-runtime (git-ignored).");
}
