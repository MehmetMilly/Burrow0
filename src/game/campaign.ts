import type { HuntState, Stats } from './Simulation';
import type { HuntIndex } from './biomes';

export const CAMPAIGN_KEY = 'burrow.campaign.v1';
export interface HuntRecord {
  score: number; time: number; medal: 'bronze' | 'silver' | 'gold'; entryScale: number; exitScale: number;
}
export interface CampaignSave {
  version: 1; unlocked: HuntIndex; selected: HuntIndex; completed: HuntIndex[];
  carriedScale: number; records: Partial<Record<HuntIndex, HuntRecord>>;
}
export function freshCampaign(): CampaignSave {
  return { version: 1, unlocked: 1, selected: 1, completed: [], carriedScale: .7, records: {} };
}
export function parseCampaign(raw: string | null): CampaignSave {
  const fresh = freshCampaign();
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || value.version !== 1 || typeof value.records !== 'object' || !value.records) return fresh;
    for (const index of [1, 2] as const) {
      const record = value.records[index];
      if (!record || !Number.isFinite(record.score) || record.score < 0 || !Number.isFinite(record.time) || record.time < 0 ||
        !Number.isFinite(record.entryScale) || !Number.isFinite(record.exitScale) || record.entryScale < .5 || record.exitScale < record.entryScale || record.exitScale > 8 ||
        !['bronze', 'silver', 'gold'].includes(record.medal)) continue;
      fresh.records[index] = { score: record.score, time: record.time, medal: record.medal, entryScale: record.entryScale, exitScale: record.exitScale };
    }
    // A later record never unlocks a missing predecessor on a damaged save.
    if (fresh.records[1]) { fresh.completed.push(1); fresh.unlocked = 2; }
    if (fresh.records[1] && fresh.records[2]) fresh.completed.push(2);
    else delete fresh.records[2];
    fresh.carriedScale = Math.max(.7, ...Object.values(fresh.records).map(record => record!.exitScale));
    fresh.selected = value.selected === 2 && fresh.unlocked === 2 ? 2 : 1;
    return fresh;
  } catch { return fresh; }
}
export function loadCampaign(): CampaignSave {
  try { return parseCampaign(localStorage.getItem(CAMPAIGN_KEY)); } catch { return freshCampaign(); }
}
export function saveCampaign(save: CampaignSave) {
  try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(save)); } catch { /* Session progress still works when storage is unavailable. */ }
}
export function entryScale(save: CampaignSave, index: HuntIndex): number {
  return index === 1 ? .7 : Math.max(1.5, save.records[1]?.exitScale ?? 1.5);
}
export function recordVictory(save: CampaignSave, hunt: HuntState, stats: Stats, enteredAt: number): CampaignSave {
  if (hunt.status !== 'won') return save;
  const index = hunt.index, next = parseCampaign(JSON.stringify(save)), old = next.records[index];
  const medal = hunt.medal === 'none' ? 'bronze' : hunt.medal;
  const rank = { bronze: 0, silver: 1, gold: 2 };
  next.records[index] = {
    score: Math.max(old?.score ?? 0, hunt.score), time: Math.min(old?.time ?? Infinity, stats.time),
    medal: old && rank[old.medal] > rank[medal] ? old.medal : medal,
    entryScale: old?.entryScale ?? enteredAt, exitScale: Math.max(old?.exitScale ?? 0, hunt.scale),
  };
  if (!next.completed.includes(index)) next.completed.push(index);
  next.completed.sort(); next.unlocked = next.completed.includes(1) ? 2 : 1;
  next.selected = next.unlocked; next.carriedScale = Math.max(next.carriedScale, hunt.scale);
  return next;
}
