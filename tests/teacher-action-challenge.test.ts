import assert from "node:assert/strict";
import { test } from "node:test";
import { makeTeacherActionChallenge, matchesTeacherActionChallenge } from "../src/lib/teacher-action-challenge";

test("teacher passkey challenges bind the exact action and include a fresh nonce", () => {
  const action = { action: "SIGN_REPORT", reportId: "report-1", reportHash: "hash-1" };
  const first = makeTeacherActionChallenge(action).toString("base64url");
  const second = makeTeacherActionChallenge(action).toString("base64url");
  assert.notEqual(first, second);
  assert.equal(matchesTeacherActionChallenge(first, action), true);
  assert.equal(matchesTeacherActionChallenge(first, { ...action, reportHash: "hash-2" }), false);
  assert.equal(matchesTeacherActionChallenge("invalid", action), false);
});
