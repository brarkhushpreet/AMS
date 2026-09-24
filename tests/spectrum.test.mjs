import assert from "node:assert/strict";
import test from "node:test";
import { detectSpectrum } from "../public/audio/spectrum.js";

function tone(frequency, sampleRate, amplitude = .02, noise = 0) {
  let seed = 9;
  return Float32Array.from({ length: 4096 }, (_, i) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate) + noise * (seed / 2 ** 32 - .5);
  });
}

for (const rate of [44100, 48000]) {
  test(`detects every bank frequency with background noise at ${rate} Hz`, () => {
    for (let hz = 17200; hz <= 18800; hz += 100) {
      const result = detectSpectrum(tone(hz, rate, .02, .01), rate);
      assert.equal(result.observedHz, hz);
      assert.ok(result.signalToNoiseDb >= 4.5);
      assert.ok(result.amplitude >= .00035);
    }
  });
}
test("silence cannot satisfy the signal gate", () => {
  const result = detectSpectrum(new Float32Array(4096), 48000);
  assert.equal(result.amplitude, 0);
  assert.ok(result.signalToNoiseDb < 4.5);
});
test("an unsupported sample rate cannot report a spectral peak", () => {
  assert.equal(detectSpectrum(tone(1000, 16000), 16000), null);
});
test("an ordinary audible tone cannot satisfy the acoustic amplitude gate", () => {
  const result = detectSpectrum(tone(1000, 48000), 48000);
  assert.ok(result.amplitude < .00035);
});
