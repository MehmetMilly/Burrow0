# Burrow — current handoff

## State

**Rung 1: playable and visually/behaviorally verified. Rung 2 (Hunt 1) is now in development.** The brief's toy gate is being treated seriously: the complete free-roam flow exists, but final integrated art/camera review and target-machine profiling remain. Do not describe this as the campaign or a finished Steam demo.

The repository began with only BRIEF.md. DESIGN.md was written and committed before code. Work stays in this repository. User has explicitly authorized Vercel deployment using the installed, logged-in CLI (`mehmetmilly`), and up to five subagents (GPT-6.1 Sol high/xhigh for critical work). No hosted Sites registration is needed.

## What exists

- Vite, strict TypeScript and Three.js; all runtime assets served locally.
- Fixed-step camera-led swimming, surge/lurk, depth-and-speed launch, ballistic breach, one air lunge, committed slam, swept automatic eating.
- Fleeing rabbits/chickens, crunchy crates/pots, slam-flipped edible jeeps, six camps and a bounded dune basin. Prey/props and sand particles use instanced rendering.
- Procedural dune/sky rendering, rock arch, animated flags, distant balloons, near-surface silhouette/wake, deep tremor echoes and a chase/cinematic camera.
- Pooled grain, soft dust, physical breakaway chunks, shockwave rings and eight persistent terrain-conforming impact scars.
- Live title → playground → pause/settings/field guide → outing report → replay/title. Persistent sensitivity/invert/volume/quality. No debug UI in shipped play; inspection hook exists only on the dev server.
- Original layered Web Audio plus bundled CC0 recorded wind, crunch and stone foley. Recordists/source links/edits are in public/audio/CREDITS.md. Barlow fonts and OFL license bundled.

## Latest verified changes

- Eight mechanics tests pass: speed beats stationary depth; ten complete dive/breach/slam cycles; destruction; reset; held slam cannot prime a second breach; lunge cannot reverse a slam; pausing a charged dive/ascent defuses launch intent.
- Parent integration calls `clearControlState()` on pause and ignores repeated Escape keydown.
- Earlier complete Chrome run passed title/guide → first bite → deep view → running breach + lunge (~25.5 m) → slam → mouse/keyboard steering → pause/persistent settings → report → replay/reset → title.
- A separate real-input camp route broke five props and flipped a jeep. That run exposed the held-slam second-breach bug, now covered and fixed.
- Production builds pass. Final integrated browser checks must be rerun after current parallel art work settles.

## Active parallel polish (user-authorized)

- Hero agent: src/render/Worm.ts, continuous armored body/maw and draw batching.
- World agent: src/render/World.ts, dune lighting, denser central terrain with lower overall geometry, batched tremor view.
- UI agent: src/UI.ts and src/style.css, readability, feedback, focus, compact layouts.
- QA agent: scripts/* and QA.md, independent browser/endurance/production checks and compact video review.
- Physics agent: finished Simulation.ts/tests; parent owns main.ts, Renderer.ts, Effects.ts, Audio.ts and integration.

## Browser evidence / performance limits

Screenshots, WebM, telemetry and video review live under ignored `artifacts/`. Repro scripts are committed under scripts/. `npm run playtest` uses real input; optional video is enabled with `BURROW_RECORD_VIDEO=1` (requires `npx playwright install ffmpeg`). Also see camp-playtest, quality-audit, production-smoke and review-video scripts.

Cloud has **no /dev/dri**; Chrome uses SwiftShader. Observed software frame times are hundreds of milliseconds, vary with capture/CPU load, and **do not establish M5 performance**. The target MacBook Air M5 at 60 fps still needs direct profiling. Particle, prey and tremor batching and terrain reduction address real draw/geometry costs. Renderer memory is lazily uploaded as new views appear; bounded-memory checks must compare warmed scenes rather than first-frame geometry counts.

Visual review has already fixed washed-out sand, horizon clutter, bright sky leaking underground, tail gaps, poor title framing, hidden shallow silhouette and HUD contrast. Latest integrated hero/world/UI captures are still pending.

## Immediate next actions

1. Collect parallel art/UI work; inspect integrated title, surface, deep view, breach and camp impact screenshots.
2. Run eight mechanics tests, production build, final real-input flow/camp checks, a bounded endurance audit and production smoke (including absence of dev hook).
3. Review compact video/contact sheet; fix observed game feel/camera defects before considering rung 2.
4. Commit the finished toy, deploy on Vercel, verify the deployed production flow, and record the literal deployment URL/project here and in README.
5. Decide the rung-1 acceptance gate honestly. Only then begin Hunt 1's health/hunger/growth/heat/balloon set piece. Preserve the toy as a complete playable scope if stopping here.

## Run

`npm ci`, then `npm run dev`. `npm test` and `npm run build` are required checks. README.md documents controls, scope, quality settings and asset licenses.

## Latest steering / hosting

User asked to continue game work rather than stall on Vercel. The first deployment was blocked by Vercel `TEAM_ACCESS_REQUIRED`: it cannot verify the existing Git commit author against the Hobby team. Build output itself passed, but the deployment is **not live**. CLI polling was stopped after detecting the terminal BLOCKED state. Do not claim a playable hosted URL.

Project: burrow0, team mehmetmillys-projects, project ID prj_KU2FT0AWBYRZh7sMgxidnRqPuOwI. Blocked deployment dpl_5GtKLcUY23Q2Bbh37bYJq9hfbS4N. Source commits are already present on GitHub (verified main HEAD8555fc2 at the time of the check). User's Vercel/GitHub account link, not missing source, is the unresolved permission issue. Do not strip metadata or impersonate another author to bypass it.

The final toy passes 8 mechanics tests, the full production flow and a stable real-input audit (3 breach/slam cycles, 15seconds roaming, settings, held-input pause, 4 resets and persistence). Resource counts plateaued at63 geometries and ~8.5MB JS heap. Independent art review passed; a brief camera/sand crossing seam remains optional polish.

Hunt 1 contract is appended to DESIGN.md. Preserve the toy. Parent integrates main/camera/audio/effects; agents own simulation, World, Worm, UI and QA respectively. Highest completed playable scope remains rung1 until a real-input Hunt1 win and full results flow pass.
