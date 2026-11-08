# BURROW — design and build plan

## North star

A small, ridiculous predator becomes a desert myth. The pleasure is in drawing a line through the dunes, loading up a dive, then punching into the light with a mouthful of trouble. Weight, a readable camera, and a beautiful desert come before the number of features.

The fixed brief remains the destination: five distinct hunts with persistent growth; physical destruction; fresh situations; a dedicated game UI; mouse and keyboard; 60 fps on the target MacBook Air. A rung is only complete when its actual play and presentation earn it. Incomplete later rungs will not be dressed up as a complete campaign.

## Decisions

- **Art direction: sun-bleached desert adventure.** Apricot light, copper shadow, chalk rock, ink-blue chitin, ivory teeth, small safety-orange accents. Layered dune silhouettes and wind-combed sand give distance and scale. Everything is modeled procedurally in a consistent sculptural style, not assembled from unrelated asset packs.
- **Hero: a plated ribbon with a flower-mouth.** Each segment follows the head's traveled path, with overlapping armored collars, a warm underside, dorsal spines and a tapering tail. The maw opens for prey and lunges. Sand sheds from the body during flight.
- **Controls: camera-led pursuit.** Mouse looks; the worm turns toward the camera with inertia. A/D supplement steering. W builds speed; S lurks. Space (or right mouse) dives underground and slams in flight. Left mouse lunges, with one correction per jump. Escape pauses and releases the mouse. Input is mouse/keyboard only.
- **No stationary super-jumps.** Launch energy is the product of depth and forward momentum. Lurking at maximum depth gives a modest hop; a committed run-up gives a high breach. Charge decays at low speed. Diving stays mobile. The HUD explains the run-up through a live launch meter and one short contextual prompt.
- **Surface first.** Most travel happens just below the sand, with a visible silhouette, a moving ridge and a wide wake. The chase camera stays above the sand at shallow depth. Deep travel engages a separate, muffled tremor view with entry/exit hysteresis; only moving prey remains legible as echoes. The camera leads the release back to daylight.
- **Air has a readable arc.** Gravity and momentum govern flight, with limited steering and one lunge correction. Space commits to a fast slam. Landing throws a radial sand wave and physically launches nearby props.
- **Eating is generous.** A swept mouth volume catches near misses and prevents fast motion tunneling. Small animals flee; movable props scatter and spin. A bite gives a sharp sound, a restrained pause, a camera impulse, floating morsels and a short-lived in-world callout.
- **A bounded living playground.** A generous basin, distant rock silhouettes, camps, scattered grazing animals and readable wind flags. The boundary bends steering back into the basin; it never becomes an invisible collision wall. Food replenishes away from the player, so the toy stays playful.
- **A game, from its first frame.** A live 3D title scene, clean typography, animated menu transitions, concise controls, pause/settings and an intentional end-of-outing report. No debug UI in normal play. A toy is explicitly called a free-roam playground rather than pretending to be Hunt 1.

## Rung 1 — The toy

Ship a complete free-roam experience: title → play → pause/settings or end outing → field report → play again/title. No mission pressure. The only counters are bites, best air and satisfying play accomplishments. The camera, worm, dunes, wake, prey, breakable props, physical debris, breach, slam, lunge, feedback and audio belong here.

Implementation sequence:

1. Scaffold TypeScript/Vite/Three.js, deterministic world generation and a sand/sky lighting pass.
2. Build the segmented hero and tune movement, charge, breach, slam and camera together.
3. Add moving food, breakable camp objects, pooled effects, swept eating and tremor sense.
4. Finish title, HUD, contextual teaching, settings, pause and outing report.
5. Drive real keyboard/mouse playtests, capture screenshots and video, inspect composition and failure cases, and tune.

Toy acceptance:

- First bite and breach possible within 30 seconds of starting.
- Ten consecutive dive/release/slam cycles feel predictable; landing never strands the camera underground.
- A fast run-up launches substantially higher than a stationary deep release.
- A real player can steer into food, track an airborne target and see the landing point.
- A slam breaks and throws camp objects, leaving debris and a sand scar.
- New session, pause/resume, settings persistence, reset and report all work without a dead end.
- Browser console is clean, resources stay bounded, and measured frame times are recorded honestly. Target-hardware performance cannot be certified from a different cloud machine.

Do not advance until the toy passes. If this session ends at rung 1, make it an honest, finished rung 1.

## Rung 2 — First light (vertical slice)

Build on the toy, not alongside it. A compact 3–5 minute dawn hunt starts as a snake-sized worm among rabbits/chickens, turns goats from threats into meals, and ends by catching the rally's lead balloon. Health and hunger are separate; digestion pays growth after food reaches the tail. Three pronounced growth events change turning radius, camera distance, prey permissions and visible armor.

Heat creates the rhythm: militia, pickups, then a helicopter and telegraphed seismic charges. Surface violence raises heat; mobile, deep lurking loses it. Seismic sweeps make camping untenable. Ground prey is plentiful and scores well; helicopters are risky opportunities rather than the entire food economy. Slam-flipped targets temporarily become edible. A quiet sinkhole trades spectacle and score for safety.

Add banked combos, two or three clear contextual lessons, authored opening routes, a balloon rally set piece, scored/medaled results and a replayable complete menu-to-results flow. Use recorded audio assets with tracked licenses when they improve the mix. No campaign UI promises content that does not yet exist.

## Rung 3 — One day, five hunts

Finish each hunt to the first hunt's bar before beginning the next:

1. **Dune sea / dawn / balloon rally:** mobile breaches and hungry slapstick.
2. **Oasis / noon / cargo plane:** populated streets, heat management and water channels that force surface crossings.
3. **Red canyon / afternoon / bridge train:** bedrock routes, verticality, flipping armor and bridge collapse.
4. **Oil fields / sunset / refinery:** breakable salt crust, food effects, fuel chains and controlled infernos.
5. **Glass desert / storm night / launching rocket:** all verbs combined at mythic scale, harpoons and storm windows.

Growth crosses hunt boundaries. A route-like expedition map follows the day's changing light. Save only between hunts, with explicit replay choices and medals for time and score.

## Rung 4 — Finish

Audit readability, repeated tactics, camera occlusion, asset cohesion, audio headroom, input latency, accessibility and frame-time spikes throughout. Add endless/skins only after the five-hunt campaign is complete and polished.

## Engineering and verification

Vite + strict TypeScript + Three.js. Separate simulation, world rendering, hero, effects, audio and UI. Use capped frame deltas and fixed-step movement where needed, shared geometry/materials, pooled particles/debris and bounded world populations. Device pixel ratio is capped and quality settings reduce shadows and particles. No large runtime downloads.

Keep browser automation out of shipped play. An explicit development-only inspection hook can expose simulation telemetry for meaningful mechanics tests. Verify the production build as well as development. Record screenshots/video under ignored `artifacts/`, with reproducible scripts committed. Record measured hardware/browser conditions rather than claiming the cloud machine proves M5 performance.

Every substantive milestone is committed with a clear message. NOTES.md records what actually exists, checks, known weaknesses and the next concrete action. README.md describes install/run, controls, scope and licenses.

## Rung 1 implementation decisions

The first playable scope is the free-roam Dune Sea outing, with no hunger or mission clock. It includes the complete title, field guide, settings, pause, outing report and replay flow. Camp props and flip-to-eat jeeps make slams useful without introducing unfinished combat systems. The first prey route gives a meal within seconds.

The hero now uses a continuous tapered skin, sliding beveled chitin plates, swept dorsal fins, a six-petal jaw and two rings of curved teeth. A stable yaw/pitch frame keeps its armor facing up during dives. Repeated hero details, prey, camp geometry, sand particles, wind strokes and tremor echoes are batched. The central dune grid is denser while the full terrain uses fewer triangles.

The deep view keeps the ceiling quiet and the signal warm: moving prey emits expanding amber echoes, with louder objects colored toward orange. The contrast back into sunlit dunes is part of the movement payoff. Recorded CC0 wind, crunch and stone layers supplement original pressure tones and granular sand, with license provenance bundled.

Playtests exposed two control exploits and one pause surprise: holding a slam through landing primed an unwanted second breach, a lunge could reverse a committed slam, and resuming a charged dive could launch automatically. All are fixed and covered by behavior tests. The slam input is consumed until release; pausing cancels stored control intent while preserving the actual airborne state.

Rung 2 remains behind the toy acceptance gate. Browser correctness and art review are established in cloud Chrome; 60 fps on the specified M5 still requires direct target-machine profiling. No cloud software-renderer result is used to claim that requirement is met.

## Hunt 1 integration contract

Rung 1's playable/visual gate passed; M5 certification remains a hardware verification task. Hunt 1 is now being built while preserving the toy. The first hunt is a complete dawn expedition, with three growth stages, a heat response, separate health/hunger, and the lead balloon as an apex target. Free roam remains selectable.

Shared simulation contract for the slice:

- `sim.mode: 'toy' | 'hunt'`; `sim.startHunt()` resets into the authored Hunt 1 opening. `sim.reset()` retains the original toy behavior.
- `sim.hunt` is always present, with `status: 'active' | 'won' | 'lost'`, `health`, `hunger`, `heat` (0–100), `growth` (0–100 within stage), `stage` (0–2), `scale`, `score`, `medal`, `apexReady`, `apexEaten`, `damageFlash`, `growthFlash`, and `kills`.
- New prey kinds: `goat`, `militia`, `pickup`, `helicopter`, `balloon`. Prey retain stable IDs and the existing position/physics fields. All species used by either mode must be allocated during reset so rendering can keep its instance pools stable. Unused hunt-only entities are not alive in toy mode.
- `sim.markers` is a bounded array of `{id, x, z, radius, time, duration, kind: 'shell' | 'seismic'}`. Time is remaining telegraph seconds; impact resolves when it reaches zero. Visual code reads markers only.
- New events: `hurt`, `grow`, `shot`, `win`, `lose`; existing burst/bite/slam events remain. `power` and optional label carry intensity/copy, with events emitted at relevant world coordinates.
- Three stages scale the actual hero and generous mouth, slow turning, change edible permissions and pull the camera back. Stored food digests before paying growth. Hunger fills from eating, health regenerates while fed, starving damages health. A slam flips armored prey before eating; mobile deep lurking lowers heat, camping at depth triggers telegraphed seismic strikes.
- Balloon: visible from the opening, too large until the last stage. It stays catchable at an altitude reachable with a fast dive/run-up and one lunge. Eating it ends the hunt; no unrelated kill grind remains afterward.
- Main flow: title → expedition card → Hunt 1 → win/loss report → replay/title. Free-roam title action continues to use toy reset. No inaccessible future hunts are advertised.

The slice must be played to a legitimate win with real input. Every subsystem is held to the toy's presentation bar before advancing to later hunts.
