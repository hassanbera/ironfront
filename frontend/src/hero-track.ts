export type HeroPosition = { x: number; y: number; z: number };
type Sample = HeroPosition & { at: number };

/** Small authoritative interpolation buffer, shared by the hero and its camera.
 * Never predicts past the newest position (including collision stops).
 */
export class HeroTrack {
  private samples: Sample[] = [];
  static readonly delay = 0.12;
  push(at: number, position: HeroPosition) {
    const last = this.samples.at(-1);
    if (last && Math.hypot(position.x - last.x, position.z - last.z) > 30)
      this.samples.length = 0;
    if (last && at <= last.at) return;
    this.samples.push({ at, x: position.x, y: position.y, z: position.z });
    if (this.samples.length > 8) this.samples.shift();
  }
  sample(now: number, out: HeroPosition) {
    if (!this.samples.length) return;
    const at = now - HeroTrack.delay;
    while (this.samples.length > 2 && this.samples[1].at <= at)
      this.samples.shift();
    const a = this.samples[0],
      b = this.samples[1] ?? a;
    const t =
      b.at > a.at ? Math.max(0, Math.min(1, (at - a.at) / (b.at - a.at))) : 1;
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
  }
}
