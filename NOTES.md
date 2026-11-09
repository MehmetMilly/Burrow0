# Burrow — Hunt 2 milestone

## Scope and stopping point

The user requested a fixed comparison baseline at **`milestone-hunt2`**: finish Oasis verification, commit/push main, create an annotated tag, then stop. Do not start Hunt 3, add features, retry hosting, or continue polishing after that handoff without a new request.

**Playable scope: the complete toy, First Light / Hunt 1, and High Water / Hunt 2.** Rung 1 and rung 2 are implemented and browser-verified. Rung 3 is partially complete: Oasis is the first of four additional hunts; Hunts 3–5 are not built. Rung 4 has not started. The brief's target-hardware 60fps requirement remains unverified, so this is not a claim that every brief acceptance condition is met.

Read BRIEF.md for the fixed vision, DESIGN.md for decisions and QA.md for reproducible evidence. DESIGN.md predates implementation. Source implementation milestones are d3ca084 (Oasis design) and ccfa627 (Oasis implementation); the final milestone tag includes the verification scripts and accurate records.

## What exists

- Title → two-stop expedition map/card → hunt → victory/defeat report → retry/title. Hunt 1 victory unlocks Oasis and offers Continue. Saved Continue survives reload. The complete pressure-free toy remains under Enter the Dunes.
- Versioned between-hunt local save: unlocked/selected hunts, completed hunts, best scores/times/medals and carried growth. No mid-hunt resume. Hunt 2 starts at Hunt 1's adult scale 1.5 and grows through 2.05/2.65. Retry always restores its carried entry size, never the previous attempt's final size. Corrupt/unavailable storage has a safe fallback.
- Camera-led movement, surge/lurk, depth×speed breach, air correction/lunge, committed slam and swept automatic eating. Deep tremor view, bounded basin, separate health/hunger, delayed digestion with visible bulges, heat/hiding, telegraphed shells/seismic pressure, scored chains and medals.
- First Light: dawn dunes, rabbits/chickens/goats, patrols/pickups/helicopter, flip-to-eat armor, breakable camps and the balloon rally apex.
- High Water: a distinct noon oasis town with chalk houses, teal awnings, palms, turquoise canals, dry causeways and an eastern runway. Human-scale food, market carts, slammable houses, sonar drones and a cargo-plane apex. Stable entity pools total 185 across modes; unused species remain inactive.
- Water forces surface travel/drag, prevents dive charging and raises exposure; dry sand restores burrowing. Airborne crossings preserve the arc. The plane spools/takes off at apex size and makes a continuous go-around after a miss. Both plane and worm must be airborne for the catch; a parked/ground pass cannot win.
- Continuous plated hero, flower maw/teeth, inherited adult armor plus two Oasis growth additions, instanced scenery/prey/effects, physical debris, water droplets/rings and aircraft fragments. No sand scars on water. Hunt-specific palette, camera, lessons, reports and audio, with recorded CC0 foley credits bundled.
- Settings, focus/keyboard navigation, compact desktop layout and a development-only read-only telemetry hook. Production contains no inspection hook or debug UI. All gameplay assets are local; no backend/account is needed to play.

## Verification at the milestone

- `npm test`: **24/24 passed** (22 simulation, 2 campaign). `npm run build`: strict TypeScript and production Vite build passed. Final assets: JS `index-BWeRtmsB.js`, CSS `index-_9OTo8GP.css`.
- Real-input Hunt 1 win in this integrated build: 41.45 simulation seconds, 13,935 points/gold. Unlock, carried growth, Continue into Oasis and reload → saved Continue → Oasis passed. Evidence: `artifacts/oasis-continuity/earned-campaign.json` and screenshots/report. That first combined run later lost after the bot drifted off its aircraft staging line; it is not claimed as a combined campaign win.
- Separate Hunt 2 win restored only that legitimately earned between-hunt profile. Both growth stages at 6.97/11.52 seconds; aircraft caught at 49.46 seconds, 16 bites, 18,180 points/gold, health 75.73. Food/digestion/hunger/heat, victory persistence, carried-size retry and return to title passed; no console errors or failed requests. `artifacts/oasis-win/` contains raw evidence; parent reviewed its result and 12-frame contact sheet in `artifacts/oasis-win-review/` (45-second MP4 also available).
- Real-input water route passed: dry causeway 4.69s; wet canal 9.23s with depth 0/charge 0 despite held dive; dry-bank diving restored and airborne canal crossing 18.37s. Parent reviewed surface restriction and airborne screenshots. Evidence: `artifacts/oasis-water/`.
- Real-input defeat passed: seismic warning at 9.49s with health 100, first damage at 11.29s to 84, loss at 49.69s with hunger 67.66. Warning preceded threat damage; loss report, carried-size retry and title passed with no console/network errors. Parent reviewed the warning screenshot. Evidence: `artifacts/oasis-loss/`.
- Final isolated production checks passed for Oasis, Hunt 1 and the toy at 1280×800/low: first bite, HUD, pause/settings/guide as applicable, report, clean retry and title. No production inspection hook, console errors or failed requests. Reports: `artifacts/oasis-final-production/`, `artifacts/hunt1-oasis-final-production/`, `artifacts/toy-oasis-final-production/`. The isolated artifact matches the final asset hashes above. No Hunt 2 acceptance checks remain pending.
- Earlier toy/Hunt 1 acceptance and repeated movement/resource checks remain recorded in QA.md. Browser scripts use real keyboard/mouse input; telemetry is read only, never teleporting or mutating simulation state. Restored profiles are explicitly disclosed.

## Known limits

1. **MacBook Air M5 60fps is unverified.** This Linux cloud has no `/dev/dri`; Chrome uses SwiftShader. Software frame intervals, screenshots and recording do not establish target GPU performance. The production route still needs direct target-machine profiling (README).
2. Human hunt pacing and long-term balance are unverified. Efficient bots reach growth quickly and win in roughly 35–50 simulation seconds; they are acceptance routes, not proof of the brief's 3–10 minute human pacing or an hour-long campaign.
3. Brief foreground foliage/building occlusion is visible in some town routes, including a growth frame. Other reviewed town/runway/air views remain readable. A small sand/camera crossing seam also remains. These are known visual polish limits; no broad camera rework was added to this frozen milestone.
4. No multi-hour soak or broad hardware/browser matrix was performed. Short bounded-resource checks and the documented production flows passed. Vite reports a nonblocking bundle-size warning (about 694 kB JS /191 kB gzip); assets are locally bundled.
5. Hunts 3–5, campaign finish and stretch modes are absent. The expedition UI exposes only implemented hunts.
6. Captures/videos/build artifacts live in ignored `artifacts/`, not in the Git tag; source, lockfile, test scripts and written evidence are versioned. The tag identifies the reproducible source baseline.

## Hosting

No live deployment is claimed. Vercel's first deployment was terminal BLOCKED / `TEAM_ACCESS_REQUIRED`: existing Git commit author cannot be verified against the Hobby team, although the build passed. The user explicitly directed moving on. Do not strip metadata or impersonate an author.

Project `burrow0`, team `mehmetmillys-projects`, project ID `prj_KU2FT0AWBYRZh7sMgxidnRqPuOwI`; blocked deployment `dpl_5GtKLcUY23Q2Bbh37bYJq9hfbS4N`. CLI link/env are ignored; Vercel config is committed. Only revisit after a legitimate account/Git-provider link fix and a new request.

## Run and reproduce

`npm ci`; `npm run dev`; `npm test`; `npm run build`; `npm run preview`. README explains controls and licenses; QA.md gives exact browser commands and evidence. Temporary test/dev/preview servers are stopped at handoff. The next development work, if explicitly requested later, begins after this tagged comparison baseline; do not begin it during this wrap-up.
