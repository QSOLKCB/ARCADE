// SPDX-License-Identifier: Apache-2.0
export class FixedClock {
  constructor({step = 1/120, maxFrame = 0.25, maxSteps = 32, snapTolerance = 0} = {}) {
    if (!(Number.isFinite(step) && step > 0 && Number.isFinite(maxFrame) && maxFrame > 0 &&
      Number.isInteger(maxSteps) && maxSteps > 0 && Number.isFinite(snapTolerance) &&
      snapTolerance >= 0 && snapTolerance < step / 2)) {
      throw new RangeError('invalid fixed clock limits');
    }
    // By default no frame snapping occurs: all existing callers retain their
    // original tick/alpha/dropped behaviour. Opt-in snapping repays its drift.
    Object.assign(this, {step, maxFrame, maxSteps, snapTolerance,
      drift:0, accumulator:0, paused:false, ticks:0});
  }
  reset() { this.accumulator = 0; this.drift = 0; this.ticks = 0; }
  setPaused(paused) { this.paused = Boolean(paused); this.accumulator = 0; this.drift = 0; }
  advance(seconds, update, timeScale = 1) {
    if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(timeScale) || timeScale < 0 || timeScale > 4) {
      throw new RangeError('invalid elapsed time or time scale');
    }
    if (this.paused || timeScale === 0) return {steps:0, alpha:1, dropped:0};
    let clamped = Math.min(seconds, this.maxFrame);
    let dropped = (seconds - clamped) * timeScale;
    if (this.snapTolerance > 0) {
      const whole = Math.round(clamped / this.step);
      const candidateDrift = this.drift + clamped - whole * this.step;
      if (timeScale === 1 && whole >= 1 && Math.abs(candidateDrift) < this.snapTolerance) {
        this.drift = candidateDrift;
        clamped = whole * this.step;
      } else {
        // Repay the signed remainder on the next unsnapped frame. Never let
        // rounded 59/61 Hz timestamps accumulate an unbounded clock-rate error.
        const payable = clamped + this.drift;
        if (payable < 0) {
          // A zero or very short frame cannot repay a negative timing debt.
          // Keep the remainder for future frames instead of discarding time.
          clamped = 0;
          this.drift = payable;
        } else {
          clamped = payable;
          this.drift = 0;
        }
      }
    }
    this.accumulator += clamped * timeScale;
    let steps = 0;
    while (this.accumulator + 1e-12 >= this.step && steps < this.maxSteps) {
      update(this.step);
      this.accumulator = Math.max(0, this.accumulator - this.step);
      this.ticks++; steps++;
      if (this.paused) return {steps, alpha:1, dropped};
    }
    if (this.accumulator >= this.step) {
      const debt = Math.floor(this.accumulator / this.step) * this.step;
      dropped += debt; this.accumulator -= debt;
    }
    return {steps, alpha:this.accumulator / this.step, dropped};
  }
}
