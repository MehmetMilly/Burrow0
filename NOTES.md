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
