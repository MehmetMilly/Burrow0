# Burrow — session notes

## Current rung

Rung 1, not yet implemented. `DESIGN.md` records the design decisions and acceptance gates. The repository began with only `BRIEF.md`.

## Current work

Build a polished free-roam dune toy before adding campaign systems. Work in this existing repository; this task is source development, with local browser preview and no hosted Site registration.

## Next actions

1. Scaffold Vite/TypeScript/Three.js.
2. Implement terrain, hero, movement and camera together.
3. Add prey, destruction, effects, audio and complete UI flow.
4. Playtest with real input, capture screenshots/video, tune against the toy acceptance gates.

## Verification / limits

No implementation checks yet. Do not claim campaign completion or target-M5 performance without evidence.

## First implementation milestone

- Strict TypeScript / Vite / Three.js scaffold; original procedural models, locally bundled Barlow fonts with OFL license.
- Fixed-step movement, depth-and-speed launch, air lunge, slam, swept eating, fleeing prey, flip-and-eat jeeps, breakable camp props, bounded pooled particles.
- Sand/sky shaders, layered landscape, segmented plated worm with flower mouth, wake, deep-view echoes, follow camera.
- Title, in-play teaching/HUD, field guide, persistent settings, pause and outing report; original layered Web Audio.
- Four mechanics tests pass, including ten repeatable slam cycles and the anti-camping launch rule. Initial production build passes.
- First Chrome screenshot revealed a washed-out shader palette and too-small menu hero; tuning those before judging the toy.
- User authorized Vercel previews; CLI is installed/logged in. Deploy once visually reviewed and playable.

## Browser playtest milestone

- Full real-input Chrome run passed: title/guide → first meal → deep tremor view → running breach (~25.5 m with air lunge) → slam → mouse and keyboard steering → pause → persisted settings → outing report → replay/reset → title.
- Screenshots and WebM are in ignored `artifacts/playtest/`, with structured telemetry in `report.json`; `scripts/playtest.mjs` reproduces the run.
- Screenshot review found and fixed bright sky leaking into underground view, gaps in the tapered tail, low-contrast HUD edges and a poor initial title-camera placement.
- Reduced horizon clutter and batched all 360 sand/debris particles into one instanced draw. Added soft dust and eight persistent, terrain-conforming landing scars.
- Cloud has no `/dev/dri`; Chrome uses SwiftShader. Initial low-quality recorded run averaged ~257 ms per frame (including screenshot stalls), so it is visual/correctness evidence only. M5 profiling is still open. Frame telemetry now records uncapped real frame times.
