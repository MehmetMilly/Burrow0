import { describe, expect, it } from 'vitest';
import { Simulation } from './Simulation';
import { launchPower, ground } from './math';
import type { Input } from './Simulation';
const idle: Input = { surge: false, lurk: false, dive: false, lunge: false, turn: 0, yaw: 0 };
function drive(sim: Simulation, seconds: number, input: Partial<Input> = {}) {
  for (let t = 0; t < seconds; t += 1 / 120) sim.step(1 / 120, { ...idle, ...input });
}
describe('the dive / breach / slam loop', () => {
  it('rewards a real run-up rather than camping at depth', () => {
    expect(launchPower(12, 30)).toBeGreaterThan(launchPower(12, 4) * 3);
    const fast = new Simulation(), slow = new Simulation();
    drive(fast, 2, { surge: true, dive: true }); drive(slow, 3, { lurk: true, dive: true });
    drive(fast, 3, { surge: true }); drive(slow, 3, { lurk: true });
    expect(fast.stats.bestAir).toBeGreaterThan(slow.stats.bestAir * 3);
  });
  it('lands safely through ten cycles and exits tremor view', () => {
    const sim = new Simulation();
    for (let i = 0; i < 10; i++) {
      drive(sim, 1.6, { dive: true, surge: true }); drive(sim, 1.1, { surge: true });
      drive(sim, .5, { dive: true, surge: true }); drive(sim, 4);
      expect(sim.state).toBe('sand'); expect(sim.deep).toBe(false);
      expect(sim.y).toBeCloseTo(ground(sim.x, sim.z) - .8, 1);
      expect(Number.isFinite(sim.yaw)).toBe(true);
    }
    expect(sim.stats.slams).toBe(10);
  });
  it('does not hop without a deliberate dive, and reset clears an outing', () => {
    const sim = new Simulation(); drive(sim, 20, { surge: true });
    expect(sim.stats.breaches).toBe(0); expect(sim.state).toBe('sand');
    sim.reset(); expect(sim.stats.time).toBe(0); expect(sim.stats.bites).toBe(0);
    expect(sim.events.length).toBe(0);
  });
  it('throws and breaks nearby props with a committed slam', () => {
    const sim = new Simulation(); const p = sim.prey.find(p => p.kind === 'crate')!;
    sim.x = p.x; sim.z = p.z; sim.state = 'air'; sim.y = p.y + 1; sim.vy = -30;
    drive(sim, .1, { dive: true });
    expect(sim.stats.slams).toBe(1); expect(sim.stats.broken).toBeGreaterThan(0);
    expect(sim.events.some(e => e.type === 'break')).toBe(true);
  });
});
