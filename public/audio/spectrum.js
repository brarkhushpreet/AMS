/** Local spectral measurement only. These values are not trusted identity evidence. */
export function detectSpectrum(samples, sampleRate, minimumHz = 17200, maximumHz = 18800, stepHz = 100) {
  const size = samples.length;
  const windowed = new Float32Array(size);
  for (let i = 0; i < size; i++) windowed[i] = samples[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
  const candidates = [];
  for (let frequency = minimumHz; frequency <= maximumHz; frequency += stepHz) {
    if (frequency >= sampleRate / 2 - 120) continue;
    const coefficient = 2 * Math.cos(2 * Math.PI * frequency / sampleRate);
    let previous = 0;
    let beforePrevious = 0;
    for (const sample of windowed) {
      const value = sample + coefficient * previous - beforePrevious;
      beforePrevious = previous;
      previous = value;
    }
    const power = Math.max(0, beforePrevious ** 2 + previous ** 2 - coefficient * previous * beforePrevious);
    candidates.push({ frequency, power });
  }
  if (candidates.length < 2) return null;
  candidates.sort((a, b) => b.power - a.power);
  const peak = candidates[0];
  const noise = candidates.slice(1).reduce((sum, item) => sum + item.power, 0) / (candidates.length - 1);
  return {
    observedHz: peak.frequency,
    signalToNoiseDb: 10 * Math.log10((peak.power + 1e-12) / (noise + 1e-12)),
    amplitude: Math.sqrt(peak.power) * 2 / size,
    sampleRate,
  };
}
