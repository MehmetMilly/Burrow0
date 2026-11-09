# Burrow — current handoff

## State

**Highest playable scope: rung 2 / First Light (Hunt 1), plus the complete toy.** The hunt has passed legitimate real-input win and loss, both growth events, the balloon catch, results/retry/title, and isolated production checks for both modes. Hunts 2–5 are not implemented. Do not claim full campaign completion or certified M5 performance.

Read BRIEF.md for the vision and DESIGN.md for decisions/contracts. DESIGN.md was written and committed before code. The user authorizes autonomous work, regular commits, Vercel deployment with the logged-in account, and up to 5 subagents (Sol 6.1 high/xhigh for critical work).

## Current game

- Title → First Light expedition map/card → Hunt 1 → win/loss report → retry/title. The original free-roam toy remains under ENTER THE DUNES.
- Camera-led movement, surge/lurk, depth×speed breach, air lunge, committed slam, swept eating and soft basin boundary. Holding a slam cannot charge a second breach; pausing cancels stored dive intent. Body path retains distance during slow travel.
- Three growth stages (.7/1.05/1.5 scale), delayed food digestion and visible traveling bulges, separate health/hunger, food-based healing and starvation, heat/hiding, banked chains, scored/time-based medals.
- Rabbits/chickens, angry goats, militia patrols, armed pickups, attack helicopter, armored flip-to-eat jeeps, breakable camp props, striped lead balloon. All 121 entity IDs are stable across modes; unused hunt species stay inactive in toy.
- Shells and anti-camping seismic strikes show terrain-conforming telegraphs and audio warnings. Constant W now crosses the predicted blast; a course change or dive avoids it. Deep local circling is punished, mobile quiet travel lowers heat.
- Balloon is visible from the opening and edible only at stage III. A real run-up/dive and a generous air catch ends the hunt. An in-world direction/range cue helps locate it.
- Continuous plated hero, articulated flower maw/teeth, stage-specific fins/crown, animated enemies/rotors/flags, sculpted dunes, sandstone arch/mesas, shallow wake/silhouette, deep tremor signals.
- Pooled physical sand/debris, dust, scars, impact rings, tracer lines, flat fluttering balloon fabric scraps. Instanced hero/prey/camps/particles/wind/echoes keep draw calls bounded.
- Original adaptive pressure/music cues with CC0 recorded wind/crunch/stone layers (public/audio/CREDITS.md). Local fonts/assets; no third-party runtime services.
- Game UI: persistent settings, keyboard focus, compact desktop support, separate survival/heat/growth instruments, live chain points, contextual damage causes, growth callouts, hunt-specific reports. No debug UI in production.

## Verification

- **14 mechanics tests pass**, plus strict production build. Tests cover launch/run-up,10 repeated cycles, slam latch/lunge commitment, paused dive intent, destruction/reset, stable pools, delayed digestion, health/hunger separation, size/apex gate, victory score banking, seismic camping pressure, and shell dodge response.
- Toy production flow and bounded-resource audit passed previously (QA.md).
- First Hunt 1 win: stages at 15.55 s / 26.54 s; balloon at 33.60 s;22 bites / 14,058 score. This is an efficient scripted route, not evidence of 3–5 minute human pacing. Root reviewed screenshots and fixed overlapping growth/bite text and balloon debris.
- Final post-combat-fix win passed at 34.78 s with 22 bites / 32,696 points / gold (artifacts/hunt-final-win). Final seismic loss occurred at 49.69 s with hunger 67.66, proving threat damage rather than starvation (artifacts/hunt-final-loss). Both results/retry/title paths passed.
- A focused warning capture verifies a distinct orange seismic field, visible countdown/response before any damage, and no deep-label/objective overlap (artifacts/hunt-final-warning).
- Isolated final production Hunt and toy flows both passed at 1280×800 with no dev hook, console errors or failed requests. Build artifact artifacts/hunt-qa-dist has JS index-D2uElL3S.js / CSS index-CXKUOIuU.css. See QA.md for exact evidence.
- Repro scripts: scripts/hunt-playtest.mjs (BURROW_HUNT_SCENARIO=win|loss), hunt-production-smoke.mjs, existing toy playtest/quality-audit/production-smoke.
- Dev snapshot is read-only tooling on Vite dev only, exposed as window.__BURROW__.snapshot(). Production excludes it. Bots use real keyboard/mouse input, never teleport or alter game state.
- Ignored artifacts/ holds screenshots, reports and optional video. npm run playtest defaults to no recording; BURROW_RECORD_VIDEO=1 enables it (npx playwright install ffmpeg).

## Known limits / next actions

1. All current gameplay source is verified and committed. Final recorded real-input win passed at 38.25 s, 34,897 points, health 94, heat 100. Root reviewed the condensed 45-second MP4 and 12-frame contact sheet under artifacts/hunt-final-review; growth, targeting, warnings, aerial catch and cloth aftermath are readable. Raw evidence is in artifacts/hunt-final-video. Temporary QA/dev servers were stopped at handoff.
2. Vite now ignores artifacts/ in its dev watcher so isolated QA builds cannot reload a live input run; this was an observed harness interruption earlier.
3. Target MacBook Air M5 60fps remains **unverified**. Cloud has no /dev/dri and uses SwiftShader. Software/capture frame intervals do not establish target GPU performance. Run the README profiling procedure on the target machine.
4. Human 3–5 minute pacing is an estimate. Efficient real-input bots finish in ~35 simulation seconds. Further human play should judge combat pressure, routing and medal balance; do not misrepresent those bots as a long balance study.
5. A brief camera/sand crossing seam remains optional polish; independent review judged it readable and not disorienting.
6. Next ladder rung: Oasis/Hunt 2 with water/heat routes and cargo-plane apex. Persistent campaign growth/save, later biomes and later apex set pieces are not implemented. Bring each hunt to the current presentation/flow bar before starting another.
7. No need to retry the Vercel account block to continue game work; user explicitly prioritized progress over hosting.

## Hosting — move on unless account access is fixed

User explicitly said not to stall on Vercel team access and to continue other game work. The first deployment is **blocked/not live** by TEAM_ACCESS_REQUIRED: Vercel cannot verify the existing Git commit author against the Hobby team. Build itself passed. CLI polling was stopped after confirming terminal BLOCKED. Source is on GitHub; missing source is not the issue. Do not strip metadata or impersonate another author.

Project burrow0, team mehmetmillys-projects, project ID prj_KU2FT0AWBYRZh7sMgxidnRqPuOwI. Blocked deployment dpl_5GtKLcUY23Q2Bbh37bYJq9hfbS4N. Link is locally ignored under .vercel/. vercel.json/.vercelignore are committed. Resume hosting only after a legitimate account/Git provider link fix; do not report the blocked URL as a playable game.

## Commands

npm ci; npm run dev; npm test; npm run build; npm run preview. Automated Hunt tests can target port 5174 via BURROW_URL. Temporary preview servers should be stopped at handoff. README documents controls, scope and licenses.
