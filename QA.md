# Burrow QA

Current scope: rungs 1 and 2 are implemented and verified in the browser; rung 3 is partially complete through Oasis/Hunt 2. Hunts 3–5 and rung 4 are absent. MacBook Air M5 performance remains unverified.

The browser scripts drive real keyboard, mouse and menu controls. The development inspection hook is used only to read telemetry; the scripts never alter game state. Production smoke uses visible DOM state and asserts the development hook is absent.

## Reproduce

```sh
npm run dev -- --port 5174
BURROW_URL=http://127.0.0.1:5174 node scripts/quality-audit.mjs
```

The endurance audit defaults to ten dive/release/slam cycles plus 45 simulation seconds of continuous roaming. On a slow software renderer, use `BURROW_AUDIT_CYCLES=3 BURROW_AUDIT_ROAM_SECONDS=15` for a shorter audit. It samples garbage-collected JS heap, uploaded geometry, alive prey, frame intervals and reset behavior. Three.js uploads geometry lazily as new scenery enters view; the initial warm count is not a valid memory-leak baseline.

For production, build an isolated artifact and serve it separately:

```sh
npx vite build --outDir artifacts/qa-dist
npx vite preview --outDir artifacts/qa-dist --port 5175
BURROW_URL=http://127.0.0.1:5175 node scripts/production-smoke.mjs
```

`npm run playtest` captures screenshots without a video by default. Opt in with `BURROW_RECORD_VIDEO=1`; the quality audit supports that flag too. To reduce a long capture into a reviewable MP4 and contact sheet:

```sh
node scripts/review-video.mjs artifacts/playtest/RECORDING.webm artifacts/review
```

## Environment and limits

Cloud Linux has no `/dev/dri`; tests use Chrome SwiftShader, low quality, and 800×500 for the repeated mechanics audit / 1280×800 for production flow. This verifies correctness and presentation. It cannot certify 60 fps on a MacBook Air M5. Frame intervals include browser automation and screenshots and must be described with those limits.

A provisional run was interrupted by source HMR and is not acceptance evidence. The older 1000-second Playwright recording repeats one frame for almost its entire duration; its condensed contact sheet in `artifacts/review-latest/` is evidence of a recording stall, not useful evidence of smooth gameplay.

## Stable build findings

The corrected short audit passed against the frozen final toy at `artifacts/quality-audit-final/report.json`:

- Three complete deep-view → breach → slam cycles, about 32 simulation seconds including 15 seconds of continuous turning/roaming; best breach 20.1 m.
- Pause freezes time, a held Escape does not oscillate screens, and pausing clears a held dive.
- High/medium/low graphics changes work, four replay resets clear outing statistics, and sensitivity/invert/graphics survive a normal reload.
- No browser errors. Uploaded geometry reached 63 after roaming and stayed at 63 after settings and four resets. GC heap changed from 8.23 MB after roaming to 8.52 MB after settings/resets; event listeners remained at 63. No unbounded growth was observed in this short sample; this is not a multi-hour soak.
- The final no-video run measured roughly 146 ms mean / 233 ms p95 raw frame intervals at 800×500 low on shared SwiftShader. The final scene used roughly 52–62 draw calls / 271–273k triangles. These are software-renderer observations, not target-hardware performance claims.

The first stable video run is in `artifacts/quality-audit/page@a4e41dfe5003d2b32af6f47058f4742e.webm`; its screenshots show the final visuals. That run reached the final persistence assertion before a harness seeding mistake overwrote storage on reload. The corrected run above fixes that mistake and passes.

Production smoke passed against the isolated final artifact (`artifacts/qa-dist/assets/index-BWI4AxEF.js`), Chrome 156.0.8078.47, 1280×800 low quality. Title → field guide/settings → first bite (HUD clock 0:00) → pause/guide/resume → field report → replay/reset → title all work. The production inspection hook is absent, and no console errors or failed requests were recorded. Report: `artifacts/production-smoke/report.json`; final title/report screenshots are in that directory. These screenshots were visually inspected for clipping, contrast and composition.

The fresh final-build recording has a concise MP4 and twelve-frame contact sheet in `artifacts/quality-audit-review/`.

## Hunt 1 validation

The Hunt 1 scripts use the same real-input rule: telemetry is read only, with no teleports, state mutation, or synthetic simulation steps. Run the full win/loss scenarios and focused warning check sequentially:

```sh
BURROW_URL=http://127.0.0.1:5174 BURROW_AUDIT_DIR=artifacts/hunt-final-win node scripts/hunt-playtest.mjs
BURROW_URL=http://127.0.0.1:5174 BURROW_AUDIT_DIR=artifacts/hunt-final-loss BURROW_HUNT_SCENARIO=loss node scripts/hunt-playtest.mjs
BURROW_URL=http://127.0.0.1:5174 BURROW_AUDIT_DIR=artifacts/hunt-final-warning BURROW_HUNT_SCENARIO=warning node scripts/hunt-playtest.mjs
```

The final win after corrected shell prediction passed: stage 1 at 15.50 simulation seconds, stage 2 at 26.59 seconds, and the lead balloon eaten by 34.78 seconds. The hunt ended with 22 bites, 32,696 points, a gold medal, full health, and heat 85.94. Food was observed digesting before growth, hunger drained, and hunting raised heat. Win report → Hunt Again resets health/growth/bites → pause/abandon → title all passed, with no browser errors. `artifacts/hunt-final-win/` contains the report and stage/breach/result pictures. The result screenshot was inspected at 800×500 and shows balloon cloth debris behind the readable results.

Deep camping with real `S` + `Space` + `D` input produced a seismic warning at 9.66 seconds, with 1.48 seconds remaining on its 1.8-second telegraph. The first impact at 11.28 seconds reduced health from 100 to 84; repeated impacts caused loss at 49.69 seconds with hunger still 67.66. This was seismic damage rather than starvation. Loss report, clean retry, and return to title passed with no browser errors. Evidence is in `artifacts/hunt-final-loss/`. Damage cause text was visible and clear. Visual review prompted a UI/marker correction; a focused real-input run against that correction passed at `artifacts/hunt-final-warning/`: the orange seismic field is distinct from prey echoes, the visible lesson reads “SEISMIC SWEEP · 1.4 S” and “Release SPACE to surface. Break your circle.” while health remains 100, and the deep-view heading no longer overlaps the objective. The simulation did not change between the full loss and this focused warning check.

The final isolated production artifact is `artifacts/hunt-qa-dist/` (JavaScript `index-D2uElL3S.js`, CSS `index-CXKUOIuU.css`), built with `npm run build -- --outDir artifacts/hunt-qa-dist` and served on port 5176. To repeat the production flows:

```sh
npx vite preview --outDir artifacts/hunt-qa-dist --port 5176
BURROW_URL=http://127.0.0.1:5176 BURROW_AUDIT_DIR=artifacts/hunt-final-production node scripts/hunt-production-smoke.mjs
BURROW_URL=http://127.0.0.1:5176 BURROW_AUDIT_DIR=artifacts/toy-final-production node scripts/production-smoke.mjs
```

Hunt production smoke passed at 1280×800 low quality: expedition → first bite → valid accessible health/hunger/growth/heat meters → pause/settings/resume → abandoned-hunt report → retry with zero bites → title. The production development hook was absent, and no browser errors or failed requests occurred. The expedition/opening/result pictures in `artifacts/hunt-final-production/` were inspected for layout, contrast and clipping.

Free-roam production smoke also passed against the same artifact: title → guide/settings → play → first bite at HUD 0:00 → pause/guide/resume → outing report → clean replay → title. There was no development hook, browser error, or failed request. Title/report screenshots in `artifacts/toy-final-production/` were visually inspected. The existing free-roam flow remains usable beside Hunt 1.

These are fast scripted routes, not evidence that a typical hunt lasts 3–5 minutes or that the full combat economy remains balanced over repeated human play. They do not establish later hunts, campaign persistence, or 60 fps on target hardware. Final Hunt screenshots use Chrome 156.0.8078.47, SwiftShader, 800×500, low quality. Frame intervals include shared cloud CPU contention and automation; no target-performance claim is made.

A final video-enabled real-input win also passed against the final source: 38.25 simulation seconds, 34,897 points, health 94 and heat 100. The 38-second route included a landed enemy hit and the balloon catch. Its 71.2-second software-rendered recording was condensed to 45 seconds in `artifacts/hunt-final-review/review.mp4`, with a 12-frame contact sheet reviewed by the parent agent for growth readability, target direction, warnings and physical cloth aftermath. Raw run/report are under `artifacts/hunt-final-video/`. Vite's development watcher ignores artifacts/ so future isolated QA builds will not interrupt an ongoing input run.

## Oasis / Hunt 2 validation

The new scripts preserve the Hunt 1 and toy harnesses. `oasis-playtest.mjs` starts with a fresh isolated browser profile by default, earns the Hunt 1 win through keyboard/mouse input, and continues through the expedition UI. Standalone Oasis checks require `BURROW_PROFILE` pointing to the campaign JSON earned by that run. Those restored-profile checks initialize only between-hunt local storage; no script changes live simulation state, teleports, or calls simulation steps.

```sh
BURROW_URL=http://127.0.0.1:5174 BURROW_AUDIT_DIR=artifacts/oasis-continuity BURROW_RECORD_VIDEO=1 node scripts/oasis-playtest.mjs
BURROW_URL=http://127.0.0.1:5174 BURROW_AUDIT_DIR=artifacts/oasis-win BURROW_PROFILE=artifacts/oasis-continuity/earned-campaign.json BURROW_OASIS_SCENARIO=win BURROW_RECORD_VIDEO=1 node scripts/oasis-playtest.mjs
BURROW_URL=http://127.0.0.1:5174 BURROW_AUDIT_DIR=artifacts/oasis-water BURROW_PROFILE=artifacts/oasis-continuity/earned-campaign.json BURROW_OASIS_SCENARIO=water node scripts/oasis-playtest.mjs
BURROW_URL=http://127.0.0.1:5174 BURROW_AUDIT_DIR=artifacts/oasis-loss BURROW_PROFILE=artifacts/oasis-continuity/earned-campaign.json BURROW_OASIS_SCENARIO=loss node scripts/oasis-playtest.mjs
```

The recorded continuity run legitimately won Hunt 1 at 41.45 simulation seconds for 13,935 points/gold, saved its 1.5 exit size, and unlocked Oasis. Report Continue → Oasis expedition card → Begin worked. Reload → title saved Continue → Oasis card → Begin restored Hunt 2 at the carried 1.5 size. The earned save is `artifacts/oasis-continuity/earned-campaign.json`. That run's later Oasis apex attempt failed because the first bot's waiting circle drifted off the runway, and threats killed it. Its overall report therefore correctly says failed; the unlock/reload transitions remain valid evidence. The bot's staging controls were corrected without changing the engine.

The subsequent Oasis win restored that earned save and passed entirely through real input: stage II at 6.97 seconds, stage III at 11.52 seconds, and an airborne head-on cargo-plane catch at 49.46 seconds. It ate 16 meals, scored 18,180/gold, and ended with health 75.73, hunger pressure, heat 99.06, and size 2.65. Townspeople and market carts supplied growth, food was observed digesting, and heat rose. The missed first takeoff returned continuously for the successful low runway pass. Victory saved the Oasis record; Hunt Again restored the carried entry size 1.5, stage I, health and zero bites. Pause/withdraw/title also passed. No console errors or failed requests were recorded. Evidence: `artifacts/oasis-win/report.json`, `oasis-win-report.png`, and `completed-campaign.json`.

The water check passed a real dry causeway crossing at 4.69 seconds, a surface canal crossing at 9.23 seconds with held dive input and depth/launch charge both zero, then a dry-bank deep launch crossing above water at 18.37 seconds. The airborne sample was 25.04 m above the water surface with the wet restriction inactive. Screenshots show the surface-only/water-drag explanation and the airborne route. Its deliberate withdrawal report and carried-size retry passed. Evidence is under `artifacts/oasis-water/`; no console errors or failed requests occurred.

The defeat check showed a seismic warning at 9.49 seconds while health remained 100, then first damage at 11.29 seconds to health 84. Deep camping produced loss at 49.69 seconds with hunger 67.66, establishing threat damage rather than starvation. Warning, damage and loss screenshots are in `artifacts/oasis-loss/`; report/retry/title and clean console/network checks passed.

The 113.72-second successful Oasis recording is `artifacts/oasis-win/page@f97195ce613ce224b75f810fee38ccbf.webm`. Its condensed MP4 and twelve-frame contact sheet are in `artifacts/oasis-win-review/`. The parent reviewed the plane catch/destruction, camera, HUD and result; water and noon-town screenshots were also inspected. The bright noon town, turquoise channels, palms and cream buildings are visually distinct from Hunt 1. A palm briefly crosses the camera during one growth moment; surrounding frames are clear. These short routes establish mechanics and flow, not 3–5 minute human pacing or a long balance study. Chrome 156/SwiftShader, low quality, 800×500 capture remains a cloud correctness/presentation check; MacBook Air M5 60 fps is still unverified.

Final isolated production was built with `npm run build -- --outDir artifacts/oasis-final-dist`, producing JavaScript `index-BWeRtmsB.js` and CSS `index-_9OTo8GP.css`. Strict TypeScript and Vite passed; Vite's bundle-size warning (694 kB JavaScript, 191 kB gzip) is nonblocking. Serve and repeat only the three production flows with:

```sh
npx vite preview --outDir artifacts/oasis-final-dist --port 5176
BURROW_URL=http://127.0.0.1:5176 BURROW_AUDIT_DIR=artifacts/oasis-final-production BURROW_PROFILE=artifacts/oasis-continuity/earned-campaign.json node scripts/oasis-production-smoke.mjs
BURROW_URL=http://127.0.0.1:5176 BURROW_AUDIT_DIR=artifacts/hunt1-oasis-final-production node scripts/hunt-production-smoke.mjs
BURROW_URL=http://127.0.0.1:5176 BURROW_AUDIT_DIR=artifacts/toy-oasis-final-production node scripts/production-smoke.mjs
```

All three final production flows passed at 1280×800, low quality, Chrome 156.0.8078.47/SwiftShader. Restored Oasis and fresh Hunt 1 each passed expedition → first bite → valid accessible survival/growth/heat meters → pause/settings/resume → withdrawal report → clean retry → title. Toy passed title → guide/settings → first bite → pause/resume → outing report → reset → title. Every flow asserted that the development hook was absent, and final reports record zero console errors and zero failed requests. The Oasis harness waits for the first HUD update before asserting its cargo objective; an earlier immediate assertion raced that update, without an engine fault. Screenshots of the noon opening and water/air routes were inspected for readability. Reports and images are in the corresponding directories above. Owned QA development/preview servers were stopped after validation.
