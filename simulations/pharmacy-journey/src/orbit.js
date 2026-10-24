// Minimal orbit control (the vendored stack ships no OrbitControls).
// Drag = rotate, wheel = zoom, right-drag / shift-drag = pan, pinch = zoom.
// External code may move camera.position and .target freely (viewpoint
// tweens do); update() only re-aims the camera.
import * as THREE from 'three';

export class SimpleOrbit {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.target = new THREE.Vector3();
    this.maxPolarAngle = Math.PI * 0.55;
    this.minDistance = 1.2;
    this.maxDistance = 40;
    this._pointers = new Map();
    this._lastPinch = 0;
    dom.style.touchAction = 'none';
    dom.addEventListener('pointerdown', e => this._down(e));
    dom.addEventListener('pointermove', e => this._move(e));
    dom.addEventListener('pointerup', e => this._up(e));
    dom.addEventListener('pointercancel', e => this._up(e));
    dom.addEventListener('wheel', e => this._wheel(e), { passive: false });
    dom.addEventListener('contextmenu', e => e.preventDefault());
  }
  _down(e) {
    this.dom.setPointerCapture(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, btn: e.button, shift: e.shiftKey });
  }
  _up(e) { this._pointers.delete(e.pointerId); this._lastPinch = 0; }
  _move(e) {
    const p = this._pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (this._pointers.size === 2) {
      const [a, b] = [...this._pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this._lastPinch) this._dolly(this._lastPinch / d);
      this._lastPinch = d;
    } else if (p.btn === 2 || p.shift) {
      this._pan(dx, dy);
    } else {
      this._rotate(dx, dy);
    }
    p.x = e.clientX; p.y = e.clientY;
  }
  _wheel(e) {
    e.preventDefault();
    this._dolly(e.deltaY > 0 ? 1.12 : 0.89);
  }
  _offset() { return this.camera.position.clone().sub(this.target); }
  _rotate(dx, dy) {
    const off = this._offset();
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta -= dx * 0.0052;
    sph.phi = THREE.MathUtils.clamp(sph.phi - dy * 0.0052, 0.05, this.maxPolarAngle);
    this.camera.position.copy(this.target).add(new THREE.Vector3().setFromSpherical(sph));
  }
  _pan(dx, dy) {
    const dist = this._offset().length();
    const k = dist * 0.0016;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const delta = right.multiplyScalar(-dx * k).add(up.multiplyScalar(dy * k));
    this.target.add(delta);
    this.camera.position.add(delta);
  }
  _dolly(f) {
    const off = this._offset();
    const len = THREE.MathUtils.clamp(off.length() * f, this.minDistance, this.maxDistance);
    this.camera.position.copy(this.target).add(off.setLength(len));
  }
  update() { this.camera.lookAt(this.target); }
}
