export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const damp = (a: number, b: number, rate: number, dt: number) => lerp(a, b, 1 - Math.exp(-rate * dt));
export function angleDiff(a: number, b: number) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
export function random(seed: number) {
  let n = seed;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) | 0; return (n >>> 0) / 4294967296; };
}
export function ground(x: number, z: number): number {
  return Math.sin(x * 0.026 + z * 0.016) * 4.8
    + Math.sin(z * 0.048 - x * 0.017) * 2.7
    + Math.sin(x * 0.065 + z * 0.037) * 1.1
    + Math.sin(x * 0.012 - z * 0.009) * 4;
}
export function launchPower(depth: number, speed: number) {
  const run = clamp((speed - 4) / 25);
  return 5 + Math.sqrt(clamp(depth, 0, 12) / 12) * (4 + run * 27);
}
export function sweptDistance(ax: number, ay: number, az: number, bx: number, by: number, bz: number, x: number, y: number, z: number) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const t = clamp(((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / (dx * dx + dy * dy + dz * dz || 1));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t, z - az - dz * t);
}
