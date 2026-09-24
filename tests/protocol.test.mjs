import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIT_GENESIS_HASH,
  canonicalJson,
  computeAuditEventHash,
} from "../src/lib/audit-core.js";
import {
  buildAcousticChallenge,
  verifyAcousticChallenge,
  frequencyForSlot,
} from "../src/lib/presence-core.js";

test("canonical JSON is stable across object insertion order", () => {
  assert.equal(
    canonicalJson({ z: 1, nested: { b: true, a: [3, 2, 1] } }),
    canonicalJson({ nested: { a: [3, 2, 1], b: true }, z: 1 }),
  );
});

test("audit event hashes bind sequence, payload and previous hash", () => {
  const base = {
    sessionId: "session-1",
    sequence: 1,
    type: "SESSION_STARTED",
    actorId: "teacher-1",
    payload: { protocolVersion: 2 },
    previousHash: AUDIT_GENESIS_HASH,
    createdAt: "2026-07-28T10:00:00.000Z",
  };
  const hash = computeAuditEventHash(base);
  assert.equal(hash.length, 64);
  assert.notEqual(
    hash,
    computeAuditEventHash({
      ...base,
      payload: { protocolVersion: 1 },
    }),
  );
  assert.notEqual(
    hash,
    computeAuditEventHash({ ...base, sequence: 2 }),
  );
});

test("acoustic challenge generation is deterministic and committed", () => {
  const input = {
    sessionId: "session-1",
    emittedAt: 1_785_234_567_800,
    minHz: 17_200,
    maxHz: 18_800,
    intervalMs: 1_100,
    secret: "test-secret-with-enough-entropy",
  };
  const first = buildAcousticChallenge(input);
  const second = buildAcousticChallenge(input);
  assert.deepEqual(first, second);
  assert.equal(verifyAcousticChallenge(first, input.secret), true);
  assert.equal(
    verifyAcousticChallenge(
      { ...first, frequency: first.frequency + 100 },
      input.secret,
    ),
    false,
  );
  assert.equal(
    verifyAcousticChallenge(
      { ...first, emittedAt: first.emittedAt + 1 },
      input.secret,
    ),
    false,
  );
  assert.equal(
    verifyAcousticChallenge(
      { ...first, durationMs: first.durationMs + 1 },
      input.secret,
    ),
    false,
  );
});

test("adjacent acoustic slots never reuse the same frequency", () => {
  const intervalMs = 1_100;
  const first = buildAcousticChallenge({
    sessionId: "session-2",
    emittedAt: 4_000 * intervalMs,
    minHz: 17_200,
    maxHz: 18_800,
    intervalMs,
    secret: "another-test-secret",
  });
  const second = buildAcousticChallenge({
    sessionId: "session-2",
    emittedAt: 4_001 * intervalMs,
    minHz: 17_200,
    maxHz: 18_800,
    intervalMs,
    secret: "another-test-secret",
  });
  assert.notEqual(first.frequency, second.frequency);
  for (const count of [3, 8, 17, 25]) {
    for (const secret of ["review-test-secret", "another-test-secret"]) {
      let previous = frequencyForSlot("review-session", -1, 17200, 17200 + (count - 1) * 100, secret);
      for (let slot = 0; slot < 1000; slot++) {
        const current = frequencyForSlot("review-session", slot, 17200, 17200 + (count - 1) * 100, secret);
        assert.notEqual(current, previous, `repeat at ${slot}, bank size ${count}`);
        previous = current;
      }
    }
  }
});

test("challenge identifiers and frequencies change with the secret", () => {
  const common = {
    sessionId: "session-3",
    emittedAt: 5_000 * 1_100,
    minHz: 17_200,
    maxHz: 18_800,
    intervalMs: 1_100,
  };
  const first = buildAcousticChallenge({
    ...common,
    secret: "secret-a",
  });
  const second = buildAcousticChallenge({
    ...common,
    secret: "secret-b",
  });
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.commitment, second.commitment);
});

test("frequency hopping remains inside the advertised discrete bank", () => {
  const minHz = 17_200;
  const maxHz = 18_800;
  const intervalMs = 1_100;
  for (let slot = 1; slot <= 250; slot += 1) {
    const challenge = buildAcousticChallenge({
      sessionId: "session-bank-test",
      emittedAt: slot * intervalMs,
      minHz,
      maxHz,
      intervalMs,
      secret: "frequency-bank-test-secret",
    });
    assert.ok(challenge.frequency >= minHz);
    assert.ok(challenge.frequency <= maxHz);
    assert.equal((challenge.frequency - minHz) % 100, 0);
  }
});

test("an audit chain cannot be reordered or have an event removed", () => {
  const first = {
    sessionId: "session-chain-test",
    sequence: 1,
    type: "SESSION_STARTED",
    actorId: "teacher",
    payload: { method: "ACOUSTIC" },
    previousHash: AUDIT_GENESIS_HASH,
    createdAt: "2026-07-28T10:00:00.000Z",
  };
  const firstHash = computeAuditEventHash(first);
  const second = {
    sessionId: first.sessionId,
    sequence: 2,
    type: "CHALLENGE_COMMITTED",
    actorId: null,
    payload: { challengeId: "challenge-1" },
    previousHash: firstHash,
    createdAt: "2026-07-28T10:00:01.000Z",
  };
  const secondHash = computeAuditEventHash(second);
  const third = {
    sessionId: first.sessionId,
    sequence: 3,
    type: "SESSION_CLOSED",
    actorId: "teacher",
    payload: { reason: "TEACHER_CLOSED" },
    previousHash: secondHash,
    createdAt: "2026-07-28T10:01:00.000Z",
  };

  assert.equal(computeAuditEventHash(third).length, 64);
  assert.notEqual(
    computeAuditEventHash({
      ...third,
      previousHash: firstHash,
    }),
    computeAuditEventHash(third),
  );
  assert.notEqual(
    computeAuditEventHash({
      ...second,
      sequence: 1,
      previousHash: AUDIT_GENESIS_HASH,
    }),
    secondHash,
  );
});
