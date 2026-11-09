import { clamp, ground } from './math';

export type HuntIndex = 1 | 2;
export const OASIS_WATER_LEVEL = 1.2;
export const OASIS_SPAWN = { x: -65, z: 105 };
export const OASIS_RUNWAY = { x: 96, startZ: 112, endZ: -112, halfWidth: 15 };
export const OASIS_HOMES = [
  [-82, 44], [-48, 63], [-55, 104], [-9, 94], [18, 90], [47, 82],
  [5, 37], [22, 43], [51, 24], [60, -13], [26, -5], [28, -61],
  [58, -72], [9, -96], [-47, -94], [-80, -64],
] as const;

export function isWater(x: number, z: number, hunt: HuntIndex = 1): boolean {
  if (hunt !== 2) return false;
  const pool = ((x + 62) / 29) ** 2 + ((z - 10) / 40) ** 2 < 1;
  const river = Math.abs(x - (-20 + 7 * Math.sin(z * .035))) < 7 && z > -125 && z < 125 && Math.abs(z + 55) > 10 && Math.abs(z - 65) > 10;
  const join = x > -62 && x < -17 && z > 5 && z < 17;
  const channel = x > -20 && x < 75 && Math.abs(z - (-34 + 5 * Math.sin(x * .04))) < 5;
  return pool || river || join || channel;
}
export function terrainHeight(x: number, z: number, hunt: HuntIndex = 1): number {
  if (hunt === 1) return ground(x, z);
  if (isWater(x, z, hunt)) return OASIS_WATER_LEVEL - 3.2;
  const edge = clamp((Math.max(Math.abs(x), Math.abs(z)) - 125) / 90);
  const town = 2.1 + Math.sin(x * .021) * .45 + Math.sin(z * .018) * .35;
  return town + ground(x, z) * edge * .65;
}
export function surfaceHeight(x: number, z: number, hunt: HuntIndex = 1): number {
  return isWater(x, z, hunt) ? OASIS_WATER_LEVEL : terrainHeight(x, z, hunt);
}

// Used by projected markers and wind, matching the CPU terrain exactly.
export const BIOME_GLSL = `
  bool oasisWater(vec2 p) {
    bool pool=dot((p-vec2(-62.,10.))/vec2(29.,40.),(p-vec2(-62.,10.))/vec2(29.,40.))<1.;
    bool river=abs(p.x-(-20.+7.*sin(p.y*.035)))<7. && p.y>-125. && p.y<125. && abs(p.y+55.)>10. && abs(p.y-65.)>10.;
    bool join=p.x>-62. && p.x<-17. && p.y>5. && p.y<17.;
    bool canal=p.x>-20. && p.x<75. && abs(p.y-(-34.+5.*sin(p.x*.04)))<5.;
    return pool||river||join||canal;
  }
  float duneHeight(vec2 p) {return sin(p.x*.026+p.y*.016)*4.8+sin(p.y*.048-p.x*.017)*2.7+sin(p.x*.065+p.y*.037)*1.1+sin(p.x*.012-p.y*.009)*4.;}
  float biomeGround(vec2 p,float biome) {
    if(biome<1.5) return duneHeight(p);
    if(oasisWater(p)) return -2.;
    float edge=clamp((max(abs(p.x),abs(p.y))-125.)/90.,0.,1.);
    return 2.1+sin(p.x*.021)*.45+sin(p.y*.018)*.35+duneHeight(p)*edge*.65;
  }
  float biomeSurface(vec2 p,float biome) {return biome>1.5&&oasisWater(p)?1.2:biomeGround(p,biome);}
`;
