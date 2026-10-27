/* SPDX-License-Identifier: Apache-2.0 */
(function (A) {
  'use strict';
  A.Input = class {
    constructor(canvas, enabled, pause) {
      this.canvas = canvas; this.enabled = enabled; this.pause = pause;
      this.keys = new Set(); this.taps = new Set(); this.touch = new Map(); this.touchTaps = new Set(); this.mouseFireTap = false; this.mouseSpecialTap = false; this.pointer = null; this.mouseFire = false; this.mouseSpecial = false; this.previous = [A.emptyInput(), A.emptyInput()]; this.gamepadBlocked = true;
      const gameKeys = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyJ','KeyK','KeyE','KeyZ','KeyX','KeyC','Space','KeyU','KeyI','KeyO','KeyH','Numpad1','Numpad2','Numpad0','Numpad3']);
      window.addEventListener('keydown', e => {
        if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
        if (document.querySelector('dialog[open]')) return;
        if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) { if (this.pause()) e.preventDefault(); return; }
        if (!this.enabled()) return;
        if (gameKeys.has(e.code)) { e.preventDefault(); this.keys.add(e.code); if (!e.repeat) this.taps.add(e.code); }
      });
      window.addEventListener('keyup', e => this.keys.delete(e.code));
      canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || !this.enabled()) return; const r = canvas.getBoundingClientRect(); this.pointer = { x: (e.clientX-r.left)*480/r.width, y: (e.clientY-r.top)*270/r.height }; });
      canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || !this.enabled()) return; canvas.focus({preventScroll:true}); if (e.button === 0) this.mouseFire = this.mouseFireTap = true; if (e.button === 2) this.mouseSpecial = this.mouseSpecialTap = true; });
      window.addEventListener('pointerup', e => { if (e.button === 0) this.mouseFire = false; if (e.button === 2) this.mouseSpecial = false; });
      canvas.addEventListener('contextmenu', e => e.preventDefault());
      window.addEventListener('pointercancel', e => { this.mouseFire = this.mouseFireTap = false; this.mouseSpecial = this.mouseSpecialTap = false; this.touchTaps.delete(this.touch.get(e.pointerId)); this.touch.delete(e.pointerId); });
      for (const button of document.querySelectorAll('[data-touch]')) {
        button.addEventListener('pointerdown', e => { if (!this.enabled()) return; e.preventDefault(); button.setPointerCapture(e.pointerId); this.touch.set(e.pointerId, button.dataset.touch); this.touchTaps.add(button.dataset.touch); button.classList.add('held'); });
        const release = e => { if (e.type === 'pointercancel') this.touchTaps.delete(button.dataset.touch); this.touch.delete(e.pointerId); button.classList.remove('held'); };
        button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
      }
    }
    clear() { this.keys.clear(); this.taps.clear(); this.touch.clear(); this.touchTaps.clear(); this.mouseFireTap = this.mouseSpecialTap = false; this.mouseFire = this.mouseSpecial = false; this.pointer = null; this.previous = [A.emptyInput(), A.emptyInput()]; this.gamepadBlocked = true; for (const b of document.querySelectorAll('.held')) b.classList.remove('held'); }
    pollPause() {
      let pressed = false; try { pressed = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).some(p => p && p.mapping === 'standard' && p.buttons[9]?.pressed); } catch (_) {}
      if (pressed && !this.padPause && !document.querySelector('dialog[open]')) this.pause();
      this.padPause = pressed;
    }
    sample(players) {
      let pads = []; try { pads = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(p => p && p.mapping === 'standard'); } catch (_) { /* Gamepads are optional. */ }
      if (this.gamepadBlocked && pads.every(p => p.buttons.every(b => !b.pressed))) this.gamepadBlocked = false;
      const has = (...codes) => codes.some(k => this.keys.has(k) || this.taps.has(k));
      const tapped = (...codes) => codes.some(k => this.taps.has(k));
      const inputs = [0, 1].map(i => {
        const a = A.emptyInput(), arrows = i === 1 || players === 1;
        a.x = (i === 0 && has('KeyD') ? 1 : 0) - (i === 0 && has('KeyA') ? 1 : 0);
        a.y = (i === 0 && has('KeyS') ? 1 : 0) - (i === 0 && has('KeyW') ? 1 : 0);
        if (arrows) { a.x += Number(has('ArrowRight')) - Number(has('ArrowLeft')); a.y += Number(has('ArrowDown')) - Number(has('ArrowUp')); }
        a.fire = i === 0 ? has('KeyJ','KeyZ') || this.mouseFire || this.mouseFireTap : has('KeyU','Numpad1');
        a.special = i === 0 ? has('KeyK','KeyX') || this.mouseSpecial || this.mouseSpecialTap : has('KeyI','Numpad2');
        a.jump = i === 0 ? has('Space','KeyC') : has('KeyO','Numpad0');
        a.interact = i === 0 ? has('KeyE') : has('KeyH','Numpad3');
        if (i === 0) {
          for (const key of new Set([...this.touch.values(), ...this.touchTaps])) { if (key === 'left') a.x--; else if(key === 'right') a.x++; else if(key === 'up') a.y--; else if(key === 'down') a.y++; else a[key] = true; }
          a.aim = this.pointer;
        }
        const p = pads[i];
        if (p && !this.gamepadBlocked) {
          a.x += Math.abs(p.axes[0]) > .2 ? p.axes[0] : 0; a.y += Math.abs(p.axes[1]) > .2 ? p.axes[1] : 0;
          a.x += Number(p.buttons[15]?.pressed) - Number(p.buttons[14]?.pressed); a.y += Number(p.buttons[13]?.pressed) - Number(p.buttons[12]?.pressed);
          a.fire ||= !!p.buttons[0]?.pressed; a.special ||= !!p.buttons[1]?.pressed; a.jump ||= !!p.buttons[2]?.pressed; a.interact ||= !!p.buttons[3]?.pressed;
        }
        const n = Math.hypot(a.x, a.y); if (n > 1) { a.x /= n; a.y /= n; }
        const edges = i === 0 ? { special: tapped('KeyK','KeyX') || this.mouseSpecialTap || this.touchTaps.has('special'), jump: tapped('Space','KeyC') || this.touchTaps.has('jump'), interact: tapped('KeyE') || this.touchTaps.has('interact') } : { special: tapped('KeyI','Numpad2'), jump: tapped('KeyO','Numpad0'), interact: tapped('KeyH','Numpad3') };
        for (const action of ['special','jump','interact']) a[action+'Pressed'] = !!edges[action] || (a[action] && !this.previous[i][action]);
        return a;
      });
      this.previous = inputs; this.taps.clear(); this.touchTaps.clear(); this.mouseFireTap = this.mouseSpecialTap = false; return inputs;
    }
  };
})(globalThis.Arcade);
