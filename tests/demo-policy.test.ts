import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMO_STUDENT_ID,
  DEMO_TEACHER_ID,
  demoBlocksRequest,
  demoEnabled,
  isDemoUser,
} from "../src/lib/demo-policy";

test("only the two reserved identities receive demo restrictions", () => {
  assert.equal(isDemoUser(DEMO_TEACHER_ID), true);
  assert.equal(isDemoUser(DEMO_STUDENT_ID), true);
  assert.equal(isDemoUser(undefined), false);
  assert.equal(isDemoUser("some-personal-account"), false);
});

test("demo API mutations and realtime tickets are blocked", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    for (const path of ["/api/classrooms", "/api/classrooms/join", "/api/attendance/mark", "/api/passkeys/registration/options", "/api/passkeys/credential.with.dots"]) {
      assert.equal(demoBlocksRequest(path, method), true, `${method} ${path}`);
    }
  }
  assert.equal(demoBlocksRequest("/api/realtime/ticket", "GET"), true);
});

test("browsing and signing out remain available", () => {
  assert.equal(demoBlocksRequest("/api/attendance/reports/example", "GET"), false);
  assert.equal(demoBlocksRequest("/dashboard/teacher", "GET"), false);
  assert.equal(demoBlocksRequest("/api/auth/signout", "POST"), false);
  assert.equal(demoBlocksRequest("/api/auth/callback/credentials", "POST"), false);
  assert.equal(demoBlocksRequest("/api/authentication-unrelated", "POST"), true);
});

test("demo mode can be disabled", () => {
  const previous = process.env.DEMO_MODE;
  try {
    delete process.env.DEMO_MODE;
    assert.equal(demoEnabled(), true);
    process.env.DEMO_MODE = "false";
    assert.equal(demoEnabled(), false);
  } finally {
    if (previous === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previous;
  }
});
