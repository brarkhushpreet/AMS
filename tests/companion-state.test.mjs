import test from "node:test";
import assert from "node:assert/strict";
import { companionMood } from "../src/lib/companion-state.js";

test("companion closes eyes while typing, whether the password is visible or masked", () => {
  for (const passwordVisible of [false, true]) {
    assert.equal(companionMood({ passwordTyping: true, passwordVisible }), "shy");
  }
});

test("companion looks again after typing stops only when both passwords are masked", () => {
  assert.equal(companionMood({ passwordTyping: false, passwordVisible: false }), "curious");
  assert.equal(companionMood({ passwordTyping: false, passwordVisible: true }), "shy");
  assert.equal(companionMood({ confirmationVisible: true }), "shy");
  assert.equal(companionMood({ confirmationTyping: true }), "shy");
});

test("privacy always takes priority over pending, success, and error reactions", () => {
  for (const feedback of [{ pending: true }, { success: true }, { error: true }]) {
    assert.equal(companionMood({ ...feedback, passwordVisible: true }), "shy");
    assert.equal(companionMood({ ...feedback, confirmationTyping: true }), "shy");
  }
});

test("companion reflects checking and server feedback without reading credentials", () => {
  assert.equal(companionMood({ pending: true, error: true }), "checking");
  assert.equal(companionMood({ error: true }), "error");
  assert.equal(companionMood({ success: true }), "happy");
  assert.equal(companionMood({}), "curious");
});
