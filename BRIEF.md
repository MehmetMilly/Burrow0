# Burrow

You're building Burrow (working title), a complete 3D action game that runs in the browser. The player is a sandworm that starts out barely bigger than a snake and ends the game big enough to swallow a rocket mid-launch. The humans of the desert fight back the whole way.

This brief holds the vision and a strong first draft of the design. You own the game. Where you have a better idea, use it. Where something here falls flat once you play it, change it. The goal is the best game you can make, and following this document line by line is secondary to that. The section "What must stay true" is fixed; everything else is a recommendation you're free to improve.

## The bar

Someone opening this game should assume a professional studio made it and sells it on Steam for $20 to $30. The bar is quality per minute, not hours of content: a tight campaign of about an hour, plus reasons to replay, where every minute looks and feels like a shipped commercial game.

Two things matter most: how the game feels to play and how it looks. Everything else (UI, audio, progression, menus) exists to serve those two, and is still held to the same bar.

Judge your work with a player's eye. A build that compiles, passes tests, has clean code and ticks every feature can still be a bad game. The question every time is whether someone playing it would grin, want one more go, and want to show a friend. Play it, look at it, and be honest with yourself about what you see.

## What must stay true

- The fantasy: an apex predator that grows from tiny and ridiculous to mythic, in a desert that fights back.
- Destruction that feels physical and satisfying. Things break, flip, scatter, burn and collapse with weight.
- The game stays fresh. Every few minutes the player meets something new to do, eat, dodge or look at.
- Five hunts across five biomes, with the worm's growth carried across the whole campaign.
- A real game UI (see the UI section).
- Mouse and keyboard only. No gamepad or touch support.
- 60 fps in Chrome on a MacBook Air M5 with 16 GB of RAM.

## The design

### Tone

Epic visuals with a wink. The worm is a force of nature: the ground heaves, the sound is enormous, every movement has weight. The humans are tiny and comically panicked. They scream, flee, call for backup on frantic radio, and escalate to absurd lengths. The early game is funny because the worm is so small that a goat is a fair fight.

### Movement and controls

This scheme came out of comparing the alternatives (keys-only turning, steering toward a screen cursor, camera-led aiming):

- The mouse aims the camera, and the worm steers toward where the camera looks at its own turn rate. The mouse gives precision; the lag gives weight. A bigger worm turns slower, so growth changes how you play.
- W surges (fast, loud). S lurks (slow, quiet, close to a stop, for ambushes). A and D also steer.
- One button means "down" everywhere. Underground, hold it to dive deeper and release to rise. It works like a ball held under water: the harder you push it down, the harder it shoots up, and if you hit the surface fast enough the worm breaches into a ballistic arc. Hold the same button in the air to slam down, sending out a shockwave that flips and launches whatever is nearby.
- A lunge: a short burst forward with a bite. In the air, it gives one mid-air correction toward a target.
- Eating is automatic on contact, with a generous mouth. Near misses should still land.

We prototyped the dive and breach loop as a 2D toy. It was fun for a minute, then collapsed into a dominant strategy: sit deep, wait for a helicopter, release, repeat, and ignore everything on the ground. Your design has to make that impossible. Some directions: launch power that comes from speed as well as depth, so a big breach needs a run-up and a line instead of camping; prey that doesn't wander into your mouth; threats that punish sitting still and deep; ground kills worth as much as air kills in their own way. Treat any dominant strategy you find while playtesting as a bug.

### Above and below

The camera is the hardest design problem in the game. Give it the care it needs.

- Near the surface, the camera stays above the sand. The player sees the bulge and wake their body makes, plus its silhouette under the sand.
- Past a certain depth, the camera drops beneath the sand. Down there the player can't see the surface world, only sense it: anything moving on top shows as vibration or echo shapes, clearer for bigger and louder things. Audio goes muffled and heavy. Then the player releases, bursts through, and the camera snaps back up into the bright, loud world. That contrast should be one of the best moments in the game. Make the transition smooth, and give it enough hysteresis that it never flickers or disorients.
- Tremor sense replaces a minimap. Moving things ripple the sand, and the ripple's size and color show whether something is edible, too big, or dangerous. Lurking sharpens the sense; surging dulls it.
- In the air, the camera frames the arc and the target. Big catches get slow motion. Shake scales with impact.

### Health and hunger

Two bars with separate jobs. Health is what enemies take away. Hunger drains all the time, faster the bigger you are. While well fed, health regenerates; while starving, hunger eats into health. Food mostly fills hunger. That ties survival to hunting without merging the two.

Ideas to build on:

- Visible digestion. Everything the worm eats travels down its body as a bulge, and turns into growth when it reaches the tail.
- Starving mode. Faster and stronger but fragile, color drains from the screen, a heartbeat kicks in. A dramatic comeback window.
- Foods with effects. A fuel tanker gives fire breath on the next breach, an ammo truck makes the next slam explode, a radar truck sharpens tremor sense. What to eat becomes a choice.
- Frenzy. Combos fill a meter. When it pops, the worm gets about ten seconds of eating one size up and taking no damage, a taste of its next stage.

### Growth

- The worm starts small: a couple of meters long, eating rabbits and chickens, losing fights with an angry goat. It ends colossal. Size carries across the campaign, so each hunt starts roughly where the last one ended.
- Size gates work like Katamari. Things too big for you bounce you off or hurt you, but slams and other tools can break them into pieces you can eat.
- Every growth stage is an event: slow motion, a roar, a shockwave, the camera pulling back, a new tier of the world lighting up as edible, a title card naming the new stage.
- By the end it should get wild and ridiculous.

### The humans fight back

Escalation works like a wanted level. Eating where people can see raises heat; vanishing deep and quiet, out of sight, lowers it. Each hunt gets a rhythm of stalk, strike, frenzy, hide.

- Threats are also food. The helicopter shooting at you is the best meal around, so heat is both risk and opportunity, and good players raise it on purpose.
- Each enemy type asks for a different answer, and every attack is telegraphed: a shell's whistle and an impact marker on the sand, a lock-on laser, a mine's ping. Getting hit should always feel fair.
- The player fights back with every verb they have: bite, breach, slam, lunge, and the kill from below, a sinkhole that quietly drags a vehicle under. Sinkhole kills keep heat low and look modest; breach kills are loud, score big and raise heat. Both styles should be worth using.

A starting threat ladder. Expand, rebalance or replace it:

| Threat | What it does | The answer |
|---|---|---|
| Militia on foot | Fire rifles, flee, regroup | Snacks; take whole groups with a sinkhole |
| Armed pickups | Circle and strafe whenever you surface | Ground chomps, or slam them airborne and juggle |
| Tanks | Shells with long telegraphs; too armored to swallow at first | Slam to flip them, then eat the soft underside |
| Attack helicopters | Hover high and fire rockets | A breach with a real run-up, or bait them low |
| Seismic charges, sonar drones | Pulse the sand and hurt you underground | Force you up; eat or slam the drones |
| Hunters (late game) | Track your tremors, fire harpoon cables that tether you and drag you out | Dive hard and rip them under the sand |

### Combos and juice

- A chain stays alive while the worm keeps eating. Airtime and skimming just under the surface keep it alive between bites, and the points bank when it drops.
- Multipliers for several eats in one jump, kills in the air, near-miss dodges, and juggles (slam things into the air, breach, and eat them before they land).
- Feedback scales with the size of what you ate: hit-stop, rising pitch on each step of the chain, camera kick, chunky callouts.
- Destruction leaves evidence: debris, fire, smoke, craters, wreckage, panicked survivors.

### Structure

A campaign of five hunts, structured like Katamari levels. There's no clock; the pressure comes from health, hunger and heat. A hunt ends when the worm eats its apex target, which takes reaching a target size. Hunts get longer as they go, from about 3 minutes for the first to about 10 for the last. Medals for score and time give replay value. An endless mode after the campaign is a stretch goal.

| Hunt | Biome | Time of day | New idea | Apex target |
|---|---|---|---|---|
| 1 | Dune sea | Dawn | Steer, breach, eat | A hot-air balloon rally, which teaches big jumps |
| 2 | Oasis town | Midday | Heat and hiding; water the worm can't cross underground | A cargo plane taking off |
| 3 | Red canyon | Afternoon | Bedrock the worm can't burrow through; slams | An armored train on the canyon bridge |
| 4 | Oil fields and salt flats | Sunset | Foods with effects; fire | The refinery |
| 5 | Glass desert spaceport | Night storm | Everything at once | A rocket mid-launch |

The campaign plays out as one long day. Each hunt introduces one new idea and remixes the earlier ones. Terrain types (soft sand, bedrock, breakable salt crust, water) should make each biome play differently, beyond looking different. Teach through play, with short contextual prompts at most.

The first minute decides everything. From the title screen, a new player should be breaching and eating within about thirty seconds.

### Difficulty

Easy to pick up, hard to master. Early hunts are generous. Later hunts reward routing, heat management, juggles and clean breaches. The difficulty should climb with the player's skill, so the game stays somewhat challenging without becoming frustrating.

## Art, animation and VFX

- Stylized and cohesive beats realistic. Strong silhouettes, a deliberate palette for each biome, and lighting doing heavy lifting, so every time of day feels distinct.
- The sand is a star. It sparkles, ripples in the wind, heaves around the worm and pours off its body after a breach.
- The worm is the hero asset, so spend real effort on it. A plated, ridged body that flexes with follow-through along its whole length; a round maw with rings of teeth that opens like a flower; new visible features at each growth stage.
- Vehicles, buildings and people are chunky, readable and full of character, and they're animated: people run and flail, rotors spin, treads roll, guns recoil.
- Destruction uses breakaway parts, fire, smoke, debris, scorch marks and craters.
- Build assets in code, download them, or mix both. Use whatever gives the best cohesive result.

## Audio

Sound carries half the feel: the rumble of the worm underground, the roar and sand blast of a breach, chomps layered from crunch, metal and gulp and scaled to the prey, explosions, sirens, radio chatter, screams. The music adapts to heat and frenzy. Download sounds and music from the web freely; sounds synthesized from scratch usually come out cheap, so only make your own when you're confident they beat a good recording. Mix everything properly.

## UI

A game UI designed for this game, nothing like a website or a dashboard. Its typography, shapes, color and motion come from the game's art direction, the way the UI in games like Hades or Splatoon belongs to its world.

- A minimal HUD, with much of it living in the world itself: tremor ripples on the sand, hunger visible on the worm's body. The elements that are on screen react to everything; numbers pop, meters shake on hits, the combo counter feels alive.
- A main menu over a live 3D scene, with the worm breaching in the background.
- Hunt select as an expedition map. A results screen that tallies up, stamps a medal and shows off the biggest thing eaten.
- Pause and settings: mouse sensitivity, invert, volume, graphics quality.
- Animated transitions and sound on every interaction.

## Technical

- A browser game. Engine and libraries are your call; Three.js with TypeScript and Vite is a solid default, and a physics library for destruction is fine.
- Quality comes before performance, but keep 60 fps on the target machine: avoid obvious performance killers and profile the heavy scenes.
- Downloading libraries, fonts, textures, models, sounds and music is fine.
- A README with how to install and run it.

## How to work: the ladder

Build in rungs. Each rung ends in a complete, polished, playable game at that scope. Climb as high as you can; wherever you stop, what exists is finished.

1. **The toy.** The worm alone in a stretch of dunes with a few things to eat: movement, camera, breaching, slams, the sand, and the core juice. It passes the toy test when moving around is fun with no goals at all. Nothing else gets built until it passes.
2. **The vertical slice.** Hunt 1 complete: health, hunger, growth, heat, enemies, combos, the apex set piece, the full flow from title menu to hunt to results, audio, and polish. This rung alone should look like a Steam demo.
3. **The campaign.** Hunts 2 to 5, one at a time, each brought to the same bar before starting the next.
4. **The finish.** A polish pass across the whole game, then stretch goals such as endless mode or unlockable worm skins.

When time gets short, cut breadth and keep the polish.

Before writing code, write `DESIGN.md`: your version of this design with your own decisions and changes, and your plan for the ladder. Keep `NOTES.md` up to date with progress, known issues and next steps, so the work can resume in a fresh session.

Playtest constantly. Run the game, drive it with real input (scripted runs or a bot that plays), capture screenshots and video, and review them with a player's eye and an art director's eye. Look for dominant strategies, dead moments, confusion and ugliness, and fix them before climbing to the next rung. Use every tool you have for this.

Work autonomously and make decisions rather than stopping to ask. If the person running you gives feedback, it overrides this brief.

## Done

The highest rung you reached is complete: the game plays from the title screen through the last hunt you built and its results screen with no placeholder art, no visible debug UI and no dead ends. You've played it through end to end yourself, it holds 60 fps on the target machine, `DESIGN.md` and `NOTES.md` reflect the final state, and the README explains how to run it.
