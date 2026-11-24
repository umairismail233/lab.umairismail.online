// gamepad.js. Standard gamepad mapping, polled each frame.
export function pollGamepad(G, dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = pads && pads[0];
  if (!pad) return;
  const dz = (v) => Math.abs(v) < 0.14 ? 0 : v;
  const p = G.player;
  p.padMove.x = dz(pad.axes[0]); p.padMove.y = dz(pad.axes[1]);
  p.yaw -= dz(pad.axes[2]) * 2.4 * dt;
  p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch - dz(pad.axes[3]) * 2.0 * dt));
  const b = (i) => pad.buttons[i] && pad.buttons[i].pressed;
  const bv = (i) => pad.buttons[i] ? pad.buttons[i].value : 0;
  if (bv(7) > 0.3) G.tryFire(true);
  if (b(6)) p.aiming = true; else if (!G.mouseAim) p.aiming = false;
  if (b(0) && p.onGround) G.jump();
  if (b(1)) G.meleeAttack();
  if (b(2)) G.reloadWeapon();
  if (b(3) && !G._padView) { G.toggleView(); G._padView = true; }
  if (!b(3)) G._padView = false;
  if (b(14)) G.throwGrenade();
  if (b(4)) G.cycleWeapon(-1);
  if (b(5)) G.cycleWeapon(1);
  if (b(9)) G.togglePause();
  if (b(8) && !G._padSlide) { G.startSlide(); G._padSlide = true; }
  if (!b(8)) G._padSlide = false;
  if (b(12) || b(13)) p.padMove.y = b(12) ? -1 : 1;
}
