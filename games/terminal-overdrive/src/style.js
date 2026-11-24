// style.js. Style rank from D to S. Slide kills, airborne kills, quick swaps, headshots.
export class StyleRank {
  constructor() { this.points = 0; this.kills = 0; this.multikillT = 0; this.multikill = 0; }
  get rank() {
    const p = this.points;
    if (p >= 900) return 'S'; if (p >= 600) return 'A'; if (p >= 350) return 'B'; if (p >= 150) return 'C'; return 'D';
  }
  add(n) { this.points += n; }
  onKill(G, opts) {
    const o = opts || {};
    this.kills++;
    let pts = 10;
    let label = 'ELIMINATED +10';
    if (o.headshot) { pts += 15; label = 'HEADSHOT +25'; }
    if (o.weak) { pts += 15; label = 'WEAK POINT +25'; }
    if (G.player.sliding) { pts += 20; label = 'SLIDE KILL +30'; }
    if (!G.player.onGround) { pts += 20; label = 'AIRBORNE KILL +30'; }
    if (G.player.lastSwapT < 2) { pts += 15; label = 'QUICK SWAP KILL +25'; }
    this.multikillT = 2.5; this.multikill++;
    if (this.multikill >= 2) { pts += this.multikill * 10; label = 'MULTI KILL x' + this.multikill + ' +' + pts; }
    this.points += pts;
    return label;
  }
  update(dt) {
    if (this.multikillT > 0) { this.multikillT -= dt; if (this.multikillT <= 0) this.multikill = 0; }
    this.points = Math.max(0, this.points - dt * 1.2);
  }
}
