# Burrow QA

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
