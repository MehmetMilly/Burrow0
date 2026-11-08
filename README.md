# BURROW

Become the thing beneath the dunes. A 3D sandworm playground built with Three.js, TypeScript and Vite.

This is **rung 1: the toy** from [BRIEF.md](BRIEF.md). It is a complete free-roam outing with a live title screen, settings, field guide, destructible camp props and an outing report. The five-hunt campaign is the next ladder, not included content. See [DESIGN.md](DESIGN.md) for the intended design and [NOTES.md](NOTES.md) for the current handoff.

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

Build forward speed, hold a dive, then release. A deep stationary release only gives a small hop. Eating is automatic on contact. Rabbits and chickens flee; crates and pots crunch. Slam near a camp to break props and flip a jeep, then eat the exposed jeep. Go deep to enter tremor sense; lurk to sense farther. There is no timer or starvation in this playground. Pause and choose **End outing** for the field report.

Clicking Enter the dunes captures the mouse. Escape releases it. Browsers that deny pointer lock can still use relative mouse movement within the window.

## Verify

```sh
npm test
npm run build
npx playwright install ffmpeg
npm run playtest
```

The automated browser playtest expects a dev server at `http://127.0.0.1:5173` (override with `BURROW_URL`). It uses real keyboard/mouse input, saves screenshots, a WebM recording and a JSON report under ignored `artifacts/`. Set `CHROME_PATH` if Chrome is elsewhere. Mechanics tests cover the run-up rule, repeated dive/breach/slam cycles, slam destruction and reset.

Graphics quality controls pixel ratio, shadows and sand shedding. High caps device pixel ratio at 1.65; medium at 1.25; low at 1 and disables dynamic shadows. Frame timing from software-rendered cloud Chrome does not establish performance on an M5. Target-machine profiling remains required.

## Assets and licenses

Game code, procedural models, shaders, icon and procedural Web Audio layers are original to this project. Recorded wind, crunch and stone foley are CC0 derivatives; see [audio credits](public/audio/CREDITS.md) for recordists, sources and edits. Barlow and Barlow Condensed by Jeremy Tribby are bundled under the SIL Open Font License in `public/fonts/OFL.txt`. Three.js is MIT licensed; other dependency licenses are available in their npm packages.
