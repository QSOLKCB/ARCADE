/* Original synthesized audio; no samples. SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  A.Audio = class {
    constructor() { this.enabled = false; this.ctx = null; this.beat = 0; this.timer = 0; this.voices = 0; }
    unlock() { if (!this.enabled) return; try { if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; this.ctx = new C(); this.master = this.ctx.createGain(); this.master.gain.value = .17; this.master.connect(this.ctx.destination); } if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); } catch (_) { this.ctx = null; } }
    setEnabled(value) { this.enabled = value; if (value) this.unlock(); else if (this.ctx) this.ctx.suspend().catch(() => {}); }
    suspend() { if (this.ctx) this.ctx.suspend().catch(() => {}); }
    tone(freq, duration, type = 'square', volume = .1, end = freq) {
      if (!this.enabled || !this.ctx || this.ctx.state !== 'running' || this.voices > 24) return;
      const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); this.voices++;
      o.type = type; o.frequency.setValueAtTime(Math.max(20,freq),t); o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
      g.gain.setValueAtTime(volume,t); g.gain.exponentialRampToValueAtTime(.001,t+duration); o.connect(g); g.connect(this.master); o.start(t); o.stop(t+duration+.02);
      o.onended = () => { o.disconnect(); g.disconnect(); this.voices--; };
    }
    effect(name) {
      const sounds = { fire:[220,.06,'sawtooth',.13,65], star:[800,.08,'triangle',.18,400], hit:[140,.09,'square',.13,35], hurt:[110,.22,'sawtooth',.16,30], boom:[65,.4,'sawtooth',.24,20], pickup:[620,.16,'sine',.3,1250], jump:[230,.15,'triangle',.2,520], win:[440,.7,'triangle',.3,880], lose:[230,.8,'triangle',.3,50], select:[510,.09,'sine',.3,730], magic:[140,.8,'sawtooth',.15,1400] };
      if (sounds[name]) this.tone(...sounds[name]);
    }
    tick(dt, id) {
      this.timer -= dt; if (this.timer > 0) return; this.timer = .23;
      const notes = { iron:[110,110,165,147,110,196,165,147], heist:[164.81,196,246.94,293.66,246.94,196,220,146.83], ninja:[146.83,220,293.66,329.63,293.66,220,174.61,220] };
      const n = (notes[id] || notes.iron)[this.beat % 8]; this.tone(n,.18,'triangle',.09); if (this.beat % 2 === 0) this.tone(n*2,.07,'sine',.05); this.beat++;
    }
  };
})(globalThis.Arcade);
