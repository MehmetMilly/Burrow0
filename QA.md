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
