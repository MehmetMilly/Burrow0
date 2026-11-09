import { describe, expect, it } from 'vitest';
import { freshCampaign, entryScale, parseCampaign, recordVictory } from './campaign';
import { Simulation } from './Simulation';

describe('between-hunt campaign saves', () => {
  it('unlocks Oasis only after a real win state and carries size without carrying the failed retry size', () => {
    const sim = new Simulation(); sim.startHunt();
    const fresh = freshCampaign(); expect(recordVictory(fresh, sim.hunt, sim.stats, .7)).toBe(fresh);
    sim.hunt.status = 'won'; sim.hunt.scale = 1.5; sim.hunt.score = 14000; sim.hunt.medal = 'gold'; sim.stats.time = 90;
    const won = recordVictory(fresh, sim.hunt, sim.stats, .7);
    const loaded = parseCampaign(JSON.stringify(won));
    expect(loaded.unlocked).toBe(2); expect(loaded.completed).toEqual([1]); expect(entryScale(loaded, 2)).toBe(1.5);
    sim.hunt.status = 'lost'; sim.hunt.scale = 2.65;
    expect(recordVictory(loaded, sim.hunt, sim.stats, 1.5)).toBe(loaded);
    expect(entryScale(loaded, 2)).toBe(1.5);
  });
  it('keeps best medals/scores/times across replays and recovers from damaged saves', () => {
    const sim = new Simulation(); sim.startHunt(); sim.hunt.status = 'won'; sim.hunt.scale = 1.5; sim.hunt.score = 14000; sim.hunt.medal = 'gold'; sim.stats.time = 90;
    const first = recordVictory(freshCampaign(), sim.hunt, sim.stats, .7);
    sim.hunt.score = 7000; sim.hunt.medal = 'bronze'; sim.stats.time = 120;
    const replay = recordVictory(first, sim.hunt, sim.stats, .7);
    expect(replay.records[1]).toMatchObject({ score: 14000, time: 90, medal: 'gold', exitScale: 1.5 });
    expect(parseCampaign('{broken')).toEqual(freshCampaign());
    expect(parseCampaign(JSON.stringify({ version: 1, unlocked: 2, records: {}, selected: 2 })).unlocked).toBe(1);
  });
});
