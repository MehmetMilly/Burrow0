# BURROW

Become the thing beneath the dunes. A 3D sandworm playground built with Three.js, TypeScript and Vite.

This build contains **First Light, Hunt 1**, plus the original free-roam dune playground. Hunt the dawn, grow through three stages, survive the humans’ response, and swallow the rally’s lead balloon. Both modes have a complete title-to-results/replay flow. Hunts 2–5 and persistent campaign progression are future work. See [DESIGN.md](DESIGN.md) for the intended design and [NOTES.md](NOTES.md) for the current handoff.

## Run

Requires Node.js 22.12+ (Node 24 recommended) and a current desktop Chrome with graphics acceleration / WebGL 2.

```sh
npm ci
npm run dev
```

Open the printed URL. For a production build:

```sh
npm run build
npm run preview
```

All runtime assets are bundled locally. There are no account requirements, API keys, backend services or third-party runtime downloads. Settings persist in local storage. Mouse and keyboard only; a window at least 760 × 480 is required.

## Play

Choose **FIRST LIGHT → BEGIN THE HUNT** for the mission, or **ENTER THE DUNES** for pressure-free roaming.

| Input | Instinct |
| --- | --- |
| Mouse | Aim the camera; the worm follows with weight |
| W / S | Surge / lurk |
| A / D | Additional steering |
| Hold Space or right mouse | Dive |
| Release Space or right mouse | Rise and breach |
| Space or right mouse while airborne | Slam |
| Left mouse | Lunge; one correction per jump |
| Escape | Pause / resume |

Build forward speed, hold a dive, then release. A deep stationary release gives a small hop. Eating is automatic on contact. A good balloon catch needs a run-up: dive toward it and **release before reaching it**, then use the air lunge to correct your bite.

In First Light, rabbits and chickens feed hunger and digest into growth. Goats and patrols become edible after the first growth event. Crates and pots crunch for points but do not feed hunger. Slam to flip armored vehicles before eating them. At stage III the helicopter and rally leader become edible.

Health and hunger are separate. Stay fed to recover health. Visible hunting raises heat; moving deep and quiet lowers it. Watch the marked sand and change course or dive before a shell lands. Deep circling attracts seismic sweeps: release your dive and surface, or break your circle before the countdown ends. There is no mission countdown; medals reward a fast, high-scoring hunt. Maintain an eating chain to multiply points, including the final catch.

Go deep for tremor sense; lurk to sense farther. Pale signals are edible, blue signals are too large, and orange signals are dangerous. The lead balloon has its own bearing/range cue above ground. In free roam, health/hunger pressure is disabled. Pause and choose **End outing** or **Abandon hunt** for a report.

Clicking Enter the dunes captures the mouse. Escape releases it. Browsers that deny pointer lock can still use relative mouse movement within the window.

## Verify

```sh
npm test
npm run build
npx playwright install ffmpeg
npm run playtest
```

For a real-input Hunt 1 win or defeat (dev server running):

```sh
BURROW_URL=http://127.0.0.1:5173 node scripts/hunt-playtest.mjs
BURROW_URL=http://127.0.0.1:5173 BURROW_HUNT_SCENARIO=loss node scripts/hunt-playtest.mjs
```

The automated browser playtest expects a dev server at `http://127.0.0.1:5173` (override with `BURROW_URL`). It uses real keyboard/mouse input, saves screenshots, a WebM recording and a JSON report under ignored `artifacts/`. Set `CHROME_PATH` if Chrome is elsewhere. Fourteen mechanics tests cover movement, slam/input/reset safety, food/digestion, survival, size/apex gates, camping pressure, and a real response to incoming shells. See [QA.md](QA.md) for browser reports and the measured limits.

Graphics quality controls pixel ratio, shadows and sand shedding. High caps device pixel ratio at 1.65; medium at 1.25; low at 1 and disables dynamic shadows. Frame timing from software-rendered cloud Chrome does not establish performance on an M5. Target-machine profiling remains required.

## Assets and licenses

Game code, procedural models, shaders, icon and procedural Web Audio layers are original to this project. Recorded wind, crunch and stone foley are CC0 derivatives; see [audio credits](public/audio/CREDITS.md) for recordists, sources and edits. Barlow and Barlow Condensed by Jeremy Tribby are bundled under the SIL Open Font License in `public/fonts/OFL.txt`. Three.js is MIT licensed; other dependency licenses are available in their npm packages.

## Hosting

The Vercel project is `burrow0` under `mehmetmillys-projects`. The first deployment is currently blocked by Vercel’s commit-author/team verification (`TEAM_ACCESS_REQUIRED`); there is no live hosted build yet. The user requested continuing game work rather than stalling on that account issue. See [Vercel’s account-link guidance](https://vercel.com/docs/deployments/troubleshoot-project-collaboration) before retrying hosting. `vercel.json` declares the Vite build and `dist` output; `.vercelignore` keeps captures, local environment files and tooling out of the upload. The local CLI link is ignored. In a fresh checkout, use `vercel link --project burrow0` before deploying.

To check the performance requirement on an M5, run a high-quality production build in Chrome at the intended play resolution and record a sustained route with several breaches and a camp slam in the Performance panel. Record resolution, graphics quality and frame-time distribution. Cloud software rendering is insufficient for this check.
