import { detectSpectrum } from "./spectrum.js";

class PresenceDetectorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.minimumHz = 17_200;
    this.maximumHz = 18_800;
    this.stepHz = 100;
    this.windowSize = 4_096;
    this.samples = new Float32Array(this.windowSize);
    this.offset = 0;
    this.port.onmessage = (event) => {
      if (event.data?.type !== "configure") return;
      this.minimumHz = Number(event.data.minimumHz) || this.minimumHz;
      this.maximumHz = Number(event.data.maximumHz) || this.maximumHz;
      this.stepHz = Number(event.data.stepHz) || this.stepHz;
    };
  }

  inspect() {
    const reading = detectSpectrum(this.samples, sampleRate, this.minimumHz, this.maximumHz, this.stepHz);
    this.port.postMessage(reading
      ? { type: "spectral_peak", ...reading }
      : { type: "unsupported_sample_rate", sampleRate });
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (let index = 0; index < channel.length; index += 1) {
      this.samples[this.offset] = channel[index];
      this.offset += 1;
      if (this.offset === this.windowSize) {
        this.inspect();
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("presence-detector", PresenceDetectorProcessor);
