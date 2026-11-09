import type { Simulation, Stats, Event } from './game/Simulation';
import type { Sound } from './game/Audio';
import { clamp, ground } from './game/math';

export type Screen = 'title' | 'expedition' | 'play' | 'pause' | 'settings' | 'guide' | 'report';
export interface Settings { sensitivity: number; invert: boolean; volume: number; quality: string; }
export interface HuntReport { status: 'active' | 'won' | 'lost'; score: number; medal: string; biggestMeal?: string; }
interface HuntReadout extends HuntReport {
  health: number; hunger: number; heat: number; growth: number; stage: number; scale: number;
  apexReady: boolean; apexEaten: boolean; damageFlash: number; growthFlash: number; kills: number;
}
const stageNames = ['HATCHLING', 'DUNE STALKER', 'SAND TYRANT'];
const defaults: Settings = { sensitivity: 1, invert: false, volume: .65, quality: 'high' };
export function readSettings(): Settings {
  try {
    const value = JSON.parse(localStorage.getItem('burrow.settings') ?? '{}');
    return { sensitivity: clamp(Number(value.sensitivity) || 1, .2, 2.5), invert: value.invert === true,
      volume: typeof value.volume === 'number' ? clamp(value.volume) : .65,
      quality: ['low', 'medium', 'high'].includes(value.quality) ? value.quality : 'high' };
  } catch { return { ...defaults }; }
}
const wormMark = `<svg class="worm-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M8 35c5-21 10-25 16-25s12 9 16 25M15 35c3-14 5-18 9-18s8 6 10 18M22 35c1-6 3-6 4 0M4 39h40" stroke="currentColor" stroke-width="2.5"/><path d="m18 10 1-5m10 6 2-5M11 21l-5-2m32 4 5-3" stroke="currentColor" stroke-width="2"/></svg>`;
const arrow = '<span aria-hidden="true">↗</span>';
const time = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
export class UI {
  screen: Screen = 'title'; settings = readSettings(); backScreen: Screen = 'title';
  onAction: (action: string) => void = () => {};
  onSettings: (s: Settings) => void = () => {};
  root: HTMLElement;
  private toastTimer = 0; private calloutTimer = 0; private currentLesson = -1; private lastChain = -1;
  private damageHintTimer = 0; private damageHint = '';
  private growthTimer = 0; private lastStage = -1; private huntMode = false;
  private menuFocus = new Map<Screen, HTMLElement>();
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private completed = new Set<string>(); private hud: HTMLElement; private title: HTMLElement;
  private depthFill: HTMLElement; private speedFill: HTMLElement; private depthValue: HTMLElement; private stateLabel: HTMLElement;
  private biteValue: HTMLElement; private chain: HTMLElement; private clock: HTMLElement; private hint: HTMLElement; private hintText: HTMLElement;
  private callout: HTMLElement; private toast: HTMLElement;
  constructor(root: HTMLElement, sound: Sound) {
    this.root = root;
    root.innerHTML = `
      <div class="film-grain" aria-hidden="true"></div><div class="vignette" aria-hidden="true"></div>
      <div id="title-scene" class="screen title-screen" data-panel="title">
        <header class="masthead"><div class="studio-mark">${wormMark}<span>A DESERT<br>IN MOTION</span></div><div class="edition"><span class="live-dot"></span> FIRST LIGHT <span class="edition-rule"></span> DUNE SEA / 01</div></header>
        <main class="title-copy"><p class="eyebrow"><span></span> BENEATH THE QUIET</p><h1>BURROW<span class="title-period">.</span></h1><p class="tagline">The desert has a new appetite.</p>
          <div class="title-actions"><button class="primary" data-action="expedition">FIRST LIGHT ${arrow}</button><button class="free-roam-button" data-action="start" aria-label="ENTER THE DUNES">ENTER THE DUNES <span aria-hidden="true">FREE ROAM ↗</span></button><div class="secondary-actions"><button data-action="guide">FIELD GUIDE <span>↗</span></button><button data-action="settings">SETTINGS <span>↗</span></button></div></div>
          <p class="scope-note">Hunt the dawn. Roam the dunes.</p>
        </main>
        <div class="specimen"><span class="specimen-line"></span><p>THE HATCHLING <span>—</span> <small>SMALL. FOR NOW.</small></p></div>
        <footer class="title-footer"><span>25° 17′ N &nbsp; 46° 42′ E</span><span class="footer-middle">HEADPHONES ON. &nbsp; LEAVE THE SURFACE BEHIND.</span><span>MOUSE + KEYBOARD <span class="key-icon">⌘</span></span></footer>
      </div>
      <section id="expedition" class="screen expedition-screen" data-panel="expedition" aria-label="First Light expedition" hidden>
        <header class="expedition-header">${wormMark}<span>DUNE SEA EXPEDITION <small>HUNT / 01</small></span><button class="text-button" data-action="title">BACK TO TITLE <span>→</span></button></header>
        <div class="expedition-layout"><div class="expedition-copy"><p class="eyebrow">01 / DAWN IN THE DUNE SEA</p><h2>FIRST<br>LIGHT<span>.</span></h2><p class="expedition-intro">A little appetite.<br>A very big breakfast.</p><div class="expedition-objective"><span>APEX TARGET</span><strong>THE LEAD BALLOON</strong><p>Eat your way up the food chain.<br>Then take the rally out of the sky.</p></div><p class="expedition-survival">Keep eating to grow and heal.<br>When the desert fights back, go deep and quiet.</p><button class="primary" data-action="hunt">BEGIN THE HUNT ${arrow}</button><p class="expedition-duration">A 3–5 MINUTE HUNT <span>NO COUNTDOWN</span></p></div>
        <div class="expedition-map" aria-hidden="true"><svg viewBox="0 0 520 520" fill="none"><g class="map-contours" stroke="currentColor"><path d="M-30 129C98 16 123 191 258 92s180-23 300-7M-20 150C100 38 137 218 274 115s181-20 284-4M-30 186C90 67 159 249 295 146s162-29 265-4M-30 216C90 98 181 276 311 176s146-24 249-3M-30 262C97 142 171 335 319 222s152-29 241-8M-30 300C88 191 176 373 333 264s152-16 227-2M-30 350C86 233 202 424 350 315s147-31 210-14M-30 390C88 273 222 466 372 361s128-30 188-15M-30 435C94 318 248 511 403 406s123-30 157-13"/><circle cx="329" cy="155" r="75"/><circle cx="329" cy="155" r="89"/></g><path class="map-route" d="M141 393c-36-79 103-58 85-137s103-29 103-101" stroke="currentColor" stroke-width="2" stroke-dasharray="5 8"/><circle cx="141" cy="393" r="6" fill="currentColor"/><circle cx="141" cy="393" r="14" stroke="currentColor"/><path d="m116 340 14-24 14 24h-28Zm-8 0h44M245 300l14-24 14 24h-28Zm-8 0h44" stroke="currentColor" stroke-width="1.5"/><g class="map-balloon" stroke="currentColor" stroke-width="2"><path d="M329 104c-33 0-40 40-23 59l12 15h22l12-15c17-19 10-59-23-59Z"/><path d="M329 104c-19 21-19 47-6 74m6-74c19 21 19 47 6 74m-17 0 4 17h14l4-17m-18 17v9h14v-9"/></g><path d="M44 63V44h19m394 0h19v19M44 457v19h19m394 0h19v-19" stroke="currentColor"/><path d="M453 103V75m-6 7 6-7 6 7" stroke="currentColor"/></svg><span class="map-region">THE DUNE SEA</span><span class="map-start">YOU START HERE</span><span class="map-target">THE RALLY</span><span class="map-coordinate">25° 17′ N / 46° 42′ E</span></div></div>
      </section>
      <div id="hud" class="hud" hidden>
        <div class="hunt-label"><span class="tiny-sun">✳</span><div><span class="eyebrow">DUNE SEA</span><strong>FIRST LIGHT</strong><small id="mode-label">FREE ROAM</small></div></div>
        <div class="hud-top-right"><span id="clock">00:00</span><span class="pause-note"><kbd>ESC</kbd> PAUSE</span></div>
        <div id="hunt-hud" class="hunt-hud" hidden>
          <div class="hunt-vitals"><div class="vital health"><div><span>HEALTH</span><b id="hunt-health-value">100</b></div><div id="hunt-health" class="vital-track" role="progressbar" aria-label="Health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i id="hunt-health-fill"></i></div></div><div class="vital hunger"><div><span>HUNGER</span><b id="hunt-hunger-value">100</b></div><div id="hunt-hunger" class="vital-track" role="progressbar" aria-label="Hunger" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i id="hunt-hunger-fill"></i></div><small id="hunt-hunger-state">WELL FED · HEALING</small></div><div class="growth-readout"><div><span id="hunt-stage">HATCHLING</span><b id="hunt-size">SIZE ×1.0</b></div><div id="hunt-growth" class="growth-track" role="progressbar" aria-label="Growth to next stage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="hunt-growth-fill"></i></div><small id="hunt-growth-state">STAGE I / III · FOOD BECOMES GROWTH</small></div></div>
          <div class="hunt-objective"><span>APEX TARGET</span><strong id="hunt-objective">THE LEAD BALLOON</strong><small id="hunt-objective-state">GROW TO STAGE III TO SWALLOW IT</small></div>
          <div class="heat-readout"><div><span>HEAT</span><b id="hunt-heat-value">0</b></div><div id="hunt-heat" class="heat-track" role="progressbar" aria-label="Heat" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="hunt-heat-fill"></i></div><strong id="hunt-heat-state">UNNOTICED</strong><span class="hunt-score"><b id="hunt-score">0</b> POINTS</span></div>
          <div id="growth-callout" class="growth-callout" aria-live="assertive"><span>SOMETHING STIRS BENEATH THE SAND</span><strong id="growth-title">DUNE STALKER</strong><small id="growth-subtitle">A BIGGER BITE. A WIDER WORLD.</small></div><div id="hunt-damage" class="damage-feedback" aria-hidden="true"></div>
        </div>
        <div class="reticle" aria-hidden="true"><i></i><i></i><span></span></div>
        <div class="depth-readout"><span id="state-label">SANDSKIMMING</span><strong id="depth-value">0.8 <small>M</small></strong><div class="depth-track"><i id="depth-fill"></i></div></div>
        <div class="appetite"><div class="appetite-icon">${wormMark}</div><div><span class="eyebrow">MORSELS</span><strong id="bites">00</strong></div><div id="chain" class="chain"></div></div>
        <div class="momentum"><div><span>RUN-UP</span><span id="speed-label">CRUISING</span></div><div class="speed-track"><i id="speed-fill"></i><b></b><b></b><b></b></div><small>SPEED + DEPTH = A BIGGER BREACH</small></div>
        <div id="lesson" class="lesson"><span class="lesson-number">01</span><div><strong id="lesson-title">FIND YOUR FEET. ALL ZERO OF THEM.</strong><p id="lesson-text"><kbd>MOUSE</kbd> to look &nbsp; <kbd>W</kbd> to surge &nbsp; <kbd>S</kbd> to lurk</p></div></div>
        <div id="callout" class="callout" aria-live="polite"></div>
        <div id="toast" class="toast" aria-live="polite"></div>
        <div class="bottom-controls"><span><kbd>W</kbd> SURGE</span><span><kbd>SPACE</kbd> DIVE / SLAM</span><span><kbd>LMB</kbd> LUNGE</span></div>
        <div id="deep-label" class="deep-label">TREMOR SENSE <span>LISTEN TO THE SAND</span></div>
      </div>
      <div id="apex-marker" class="apex-marker" hidden><i>➜</i><span>RALLY LEADER</span><small></small></div>
      <div class="modal-scrim" id="scrim" hidden></div>
      <section class="panel pause-panel" data-panel="pause" role="dialog" aria-modal="true" aria-label="Paused" hidden><p class="eyebrow">TAKE A BREATH</p><h2>THE DESERT<br>CAN WAIT.</h2><p class="panel-prose">Your next meal isn't going anywhere.<br>Well. It probably is.</p><button class="primary" data-action="resume">BACK BENEATH ${arrow}</button><button class="text-button" data-action="settings">SETTINGS <span>↗</span></button><button class="text-button" data-action="guide">FIELD GUIDE <span>↗</span></button><button id="finish-button" class="text-button subdued" data-action="finish">END OUTING <span>→</span></button><p class="panel-foot"><kbd>ESC</kbd> RETURN TO THE DUNES</p></section>
      <section class="panel settings-panel" data-panel="settings" role="dialog" aria-modal="true" aria-label="Settings" hidden><button class="close-button" data-action="back" aria-label="Back">×</button><p class="eyebrow">MAKE YOURSELF AT HOME</p><h2>INSTINCTS.</h2><label class="setting"><span>MOUSE SENSITIVITY <output id="sensitivity-output">1.0</output></span><input id="sensitivity" type="range" min="0.2" max="2.5" step="0.1" value="${this.settings.sensitivity}"></label><label class="setting toggle"><span>INVERT VERTICAL LOOK</span><input id="invert" type="checkbox" ${this.settings.invert ? 'checked' : ''}></label><label class="setting"><span>MASTER VOLUME <output id="volume-output">65%</output></span><input id="volume" type="range" min="0" max="1" step="0.05" value="${this.settings.volume}"></label><label class="setting"><span>GRAPHICS QUALITY</span><select id="quality"><option value="high">HIGH · FULL SUN</option><option value="medium">MEDIUM · LIGHTER SAND</option><option value="low">LOW · SOFT SHADOWS OFF</option></select></label><button class="primary" data-action="back">ALL SET ${arrow}</button><p class="panel-foot">SAVED AUTOMATICALLY ON THIS DEVICE</p></section>
      <section class="panel guide-panel" data-panel="guide" role="dialog" aria-modal="true" aria-label="Field guide" hidden><button class="close-button" data-action="back" aria-label="Back">×</button><p class="eyebrow">A FIELD GUIDE TO BEING A WORM</p><h2>TRUST YOUR GUT.</h2><div class="guide-row"><span>01</span><div><h3>DRAW YOUR LINE</h3><p>Mouse to look. You follow with a little weight.<br><kbd>W</kbd> surges. <kbd>S</kbd> lurks. <kbd>A</kbd> / <kbd>D</kbd> help you turn.</p></div></div><div class="guide-row"><span>02</span><div><h3>DOWN. THEN VERY, VERY UP.</h3><p>Hold <kbd>SPACE</kbd> or <kbd>RMB</kbd> to dive. Release to breach.<br>Build speed first. Depth alone won't send you far.</p></div></div><div class="guide-row"><span>03</span><div><h3>MAKE AN ENTRANCE</h3><p>Press <kbd>SPACE</kbd> in the air to slam. Scatter the camp.<br><kbd>LMB</kbd> lunges and gives one mid-air correction.</p></div></div><div class="guide-row"><span>04</span><div><h3>IF IT FITS, IT'S FOOD</h3><p>Eating is automatic. Rabbits, chickens, crates, pots.<br>Jeeps are too tough. Flip one with a slam first.</p></div></div><div class="guide-row"><span>05</span><div><h3>STAY HUNGRY. STAY ALIVE.</h3><p>In a hunt, food fills hunger and digests into growth.<br>Eat to heal. Travel deep and quiet to lose heat.</p></div></div><button class="primary" data-action="back">GOT AN APPETITE ${arrow}</button></section>
      <section class="screen report-screen" data-panel="report" hidden><div class="report-header">${wormMark}<span>DUNE SEA EXPEDITION <small id="report-subtitle">FIELD REPORT / 01</small></span></div><div class="report-main"><p id="report-eyebrow" class="eyebrow">THE SURFACE WILL REMEMBER</p><h2 id="report-heading">A GOOD DAY<br>TO BE A WORM.</h2><div id="toy-report-stats" class="report-stats"><div><strong id="report-bites">0</strong><span>MORSELS EATEN</span></div><div><strong id="report-air">0<small>M</small></strong><span>BEST BREACH</span></div><div><strong id="report-slams">0</strong><span>EARTHSHAKERS</span></div></div><div id="hunt-report-stats" class="report-stats" hidden><div><strong id="hunt-report-score">0</strong><span>POINTS SCORED</span></div><div><strong id="hunt-report-time">0:00</strong><span>HUNT TIME</span></div><div><strong id="hunt-report-bites">0</strong><span>MORSELS EATEN</span></div></div><div class="report-details"><span><span id="report-detail-label">TIME IN THE SAND</span> <b id="report-time">0:00</b></span><span>LONGEST CHAIN <b id="report-chain">0</b></span><span>GROUND COVERED <b id="report-distance">0 M</b></span></div><div class="report-actions"><button id="report-replay" class="primary" data-action="start">STILL HUNGRY ${arrow}</button><button class="text-button" data-action="title">BACK TO TITLE <span>→</span></button></div></div><div class="stamp"><span id="report-stamp-label">DUNE SEA</span><strong id="report-rank">SAND<br>ROAMER</strong><span id="report-stamp-foot">LEAVE ONLY TREMORS</span></div><div id="hunt-biggest" class="biggest-bite" hidden><span>BIGGEST THING EATEN</span><strong id="hunt-report-meal">NOTHING YET</strong></div><p id="report-footer" class="report-foot">NO CLOCK TO BEAT. JUST A DESERT TO GET UNDER.</p></section>
      <div id="input-notice" class="input-notice" hidden><p>A LITTLE MORE ROOM TO ROAM.</p><span>Burrow needs a keyboard, a mouse, and a wider window.</span></div>
    `;
    this.hud = this.el('hud'); this.title = this.el('title-scene'); this.depthFill = this.el('depth-fill'); this.speedFill = this.el('speed-fill'); this.depthValue = this.el('depth-value'); this.stateLabel = this.el('state-label');
    this.biteValue = this.el('bites'); this.chain = this.el('chain'); this.clock = this.el('clock'); this.hint = this.el('lesson'); this.hintText = this.el('lesson-text'); this.callout = this.el('callout'); this.toast = this.el('toast');
    (this.el('quality') as HTMLSelectElement).value = this.settings.quality; this.refreshSettingLabels();
    root.addEventListener('click', e => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
      if (!button) return; sound.tick(); this.onAction(button.dataset.action!);
    });
    root.querySelectorAll('button').forEach(button => button.addEventListener('mouseenter', () => sound.tick()));
    root.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || this.screen === 'play') return;
      const controls = [...root.querySelectorAll<HTMLElement>(`[data-panel="${this.screen}"] button, [data-panel="${this.screen}"] input, [data-panel="${this.screen}"] select`)];
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    });
    ['sensitivity', 'invert', 'volume', 'quality'].forEach(id => this.el(id).addEventListener('input', () => {
      this.settings = {
        sensitivity: Number((this.el('sensitivity') as HTMLInputElement).value), invert: (this.el('invert') as HTMLInputElement).checked,
        volume: Number((this.el('volume') as HTMLInputElement).value), quality: (this.el('quality') as HTMLSelectElement).value
      };
      try { localStorage.setItem('burrow.settings', JSON.stringify(this.settings)); } catch { /* private browsing still plays */ }
      this.refreshSettingLabels(); this.onSettings(this.settings);
    }));
    const checkSize = () => { this.el('input-notice').hidden = innerWidth >= 760 && innerHeight >= 480; };
    checkSize(); window.addEventListener('resize', checkSize);
  }
  el(id: string) { return this.root.querySelector<HTMLElement>(`#${id}`)!; }
  private refreshSettingLabels() { this.el('sensitivity-output').textContent = this.settings.sensitivity.toFixed(1); this.el('volume-output').textContent = `${Math.round(this.settings.volume * 100)}%`; }
  show(screen: Screen) {
    const active = document.activeElement;
    if (active instanceof HTMLElement && this.root.querySelector(`[data-panel="${this.screen}"]`)?.contains(active)) this.menuFocus.set(this.screen, active);
    this.screen = screen;
    this.root.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== screen; });
    this.hud.hidden = screen !== 'play'; this.title.hidden = screen !== 'title';
    this.el('scrim').hidden = !['pause', 'settings', 'guide'].includes(screen);
    this.root.dataset.screen = screen;
    if (screen !== 'play') requestAnimationFrame(() => {
      if (this.screen !== screen) return;
      const focus = this.menuFocus.get(screen) ?? this.root.querySelector<HTMLElement>(`[data-panel="${screen}"] button`);
      focus?.focus({ preventScroll: true });
    });
  }
  reset() {
    this.completed.clear(); this.lastChain = -1; this.lastStage = -1; this.currentLesson = -1;
    this.damageHintTimer = 0; this.growthTimer = 0; this.calloutTimer = 0; this.toastTimer = 0;
    this.callout.classList.remove('visible'); this.toast.classList.remove('visible'); this.el('growth-callout').classList.remove('visible');
  }
  private readHunt(sim: Simulation): HuntReadout | null {
    const current = sim as Simulation & { mode?: 'toy' | 'hunt'; hunt?: HuntReadout };
    return current.mode === 'hunt' && current.hunt ? current.hunt : null;
  }
  private meter(id: string, value: number) {
    const amount = clamp(value / 100);
    this.el(id).setAttribute('aria-valuenow', String(Math.round(amount * 100)));
    this.el(`${id}-fill`).style.transform = `scaleX(${amount})`;
  }
  private announceGrowth(stage: number) {
    this.lastStage = stage;
    this.el('growth-title').textContent = stageNames[stage] ?? stageNames[2];
    this.el('growth-subtitle').textContent = stage < 2 ? 'A BIGGER BITE. A WIDER WORLD.' : 'THE LEAD BALLOON IS YOURS TO TAKE.';
    const title = this.el('growth-callout'); title.classList.remove('visible'); void title.offsetWidth; title.classList.add('visible');
    this.growthTimer = 3.2; this.callout.classList.remove('visible'); this.calloutTimer = 0;
  }
  private teach(key: number, title: string, text: string, number: string) {
    if (this.currentLesson === key) return;
    this.currentLesson = key; this.hint.classList.remove('dismissed');
    this.el('lesson-title').textContent = title; this.hintText.innerHTML = text;
    this.root.querySelector('.lesson-number')!.textContent = number;
  }
  private updateHunt(hunt: HuntReadout, sim: Simulation, dt: number) {
    this.meter('hunt-health', hunt.health); this.meter('hunt-hunger', hunt.hunger);
    this.meter('hunt-heat', hunt.heat); this.meter('hunt-growth', hunt.stage === 2 ? 100 : hunt.growth);
    this.el('hunt-health-value').textContent = String(Math.ceil(hunt.health));
    this.el('hunt-hunger-value').textContent = String(Math.ceil(hunt.hunger));
    this.el('hunt-heat-value').textContent = String(Math.round(hunt.heat));
    this.el('hunt-hunger-state').textContent = hunt.hunger <= 0 ? 'STARVING · LOSING HEALTH' : hunt.hunger < 30 ? 'FIND A MEAL' : hunt.hunger > 55 ? hunt.health < 100 ? 'WELL FED · HEALING' : 'WELL FED' : 'GETTING HUNGRY';
    this.el('hunt-health').classList.toggle('critical', hunt.health < 30);
    this.el('hunt-hunger').classList.toggle('critical', hunt.hunger < 25);
    this.el('hunt-heat-state').textContent = hunt.heat > 75 ? 'ALL EYES ON YOU' : hunt.heat > 45 ? 'HUNTED' : hunt.heat > 15 ? 'NOTICED' : 'UNNOTICED';
    this.el('hunt-heat').classList.toggle('critical', hunt.heat > 65);
    this.el('hunt-stage').textContent = stageNames[hunt.stage] ?? stageNames[0];
    this.el('hunt-size').textContent = `SIZE ×${(hunt.scale / .7).toFixed(1)}`;
    this.el('hunt-growth-state').textContent = hunt.stage === 2 ? 'STAGE III / III · APEX SIZE' : `STAGE ${hunt.stage === 0 ? 'I' : 'II'} / III · FOOD BECOMES GROWTH`;
    this.el('hunt-score').textContent = Math.round(hunt.score + sim.chainScore).toLocaleString('en-US');
    this.el('hunt-score').parentElement!.classList.toggle('unbanked', sim.chainScore > 0);
    this.el('hunt-objective-state').textContent = hunt.apexEaten ? 'THE RALLY IS OVER' : hunt.apexReady ? 'APEX SIZE REACHED · BREACH AND BITE' : 'GROW TO STAGE III TO SWALLOW IT';
    this.el('hunt-objective').parentElement!.classList.toggle('ready', hunt.apexReady);
    this.el('hunt-damage').style.opacity = String(clamp(hunt.damageFlash) * .7);
    if (hunt.stage > this.lastStage && this.lastStage >= 0) this.announceGrowth(hunt.stage);
    else this.lastStage = hunt.stage;
    this.growthTimer -= dt; if (this.growthTimer <= 0) this.el('growth-callout').classList.remove('visible');

    this.damageHintTimer = Math.max(0, this.damageHintTimer - dt);
    if (hunt.apexReady && sim.state === 'air') this.teach(104, 'THE SKY IS ON THE MENU.', 'Stay on the balloon. <kbd>LMB</kbd> corrects your bite in the air.', '04');
    else if (this.damageHintTimer > 0) this.teach(110, this.damageHint, this.damageHint.includes('GOAT') ? 'Eat rabbits and chickens first. Goats become food when you grow.' : this.damageHint.includes('SEISMIC') ? 'Break your circle or release to surface before the pulse lands.' : this.damageHint.includes('STARV') ? 'Find food. Well-fed worms recover health.' : 'Change course, dive, or breach clear of the marked sand.', '!');
    else if (hunt.hunger < 25) this.teach(105, 'TIME FOR A MEAL.', 'Food fills hunger. Stay well fed to recover health.', '!');
    else if (hunt.health < 30) this.teach(106, 'DON’T BECOME A FOSSIL.', 'Keep eating to heal. Go deep and keep moving to escape.', '!');
    else if (sim.stats.time < 10) this.teach(100, 'START WITH THE SMALL STUFF.', '<kbd>MOUSE</kbd> to look. <kbd>W</kbd> to surge. Eat on contact.', '01');
    else if (sim.stats.breaches === 0) this.teach(101, 'GET UNDER IT.', 'Build speed with <kbd>W</kbd>. Hold <kbd>SPACE</kbd> to dive. Release to breach.', '02');
    else if (hunt.apexReady) this.teach(104, 'THE SKY IS ON THE MENU.', 'Build speed. Dive toward the balloon. Release before it; <kbd>LMB</kbd> corrects in air.', '04');
    else if (hunt.heat > 65) this.teach(107, 'THEY FELT THAT.', 'Hold <kbd>SPACE</kbd> + <kbd>S</kbd> to travel deep and quiet. Keep moving.', '!');
    else if (hunt.stage > 0 && sim.stats.slams === 0) this.teach(103, 'TURN THE TABLES.', 'Press <kbd>SPACE</kbd> in the air to slam. Flip armored prey before you bite.', '03');
    else this.teach(102, 'A GROWING APPETITE.', 'Food digests into growth. Find your next meal. The balloon can wait.', '03');
  }
  update(sim: Simulation, dt: number, deep: number) {
    this.root.style.setProperty('--deep', deep.toFixed(3));
    if (this.screen !== 'play') return;
    const hunt = this.readHunt(sim);
    if (this.huntMode !== !!hunt) { this.huntMode = !!hunt; this.currentLesson = -1; }
    this.hud.dataset.mode = hunt ? 'hunt' : 'toy'; this.el('hunt-hud').hidden = !hunt;
    this.el('mode-label').textContent = hunt ? 'HUNT / 01' : 'FREE ROAM';
    this.el('finish-button').innerHTML = `${hunt ? 'ABANDON HUNT' : 'END OUTING'} <span>→</span>`;
    this.depthValue.innerHTML = `${(sim.state === 'air' ? Math.max(0, sim.y - ground(sim.x, sim.z)) : sim.depth).toFixed(1)} <small>M</small>`;
    this.depthFill.style.height = `${sim.state === 'air' ? 100 : sim.depth / 12 * 100}%`;
    this.stateLabel.textContent = sim.state === 'air' ? sim.slam ? 'EARTHSHAKER' : 'ABOVE IT ALL' : sim.deep ? 'TREMOR SENSE' : sim.state === 'rise' ? 'COMING UP' : sim.depth > 2 ? 'LOADING THE SPRING' : 'SANDSKIMMING';
    this.speedFill.style.width = `${clamp((sim.speed - 3) / 27) * 100}%`;
    this.el('speed-label').textContent = sim.speed > 25 ? 'FULL TILT' : sim.speed < 9 ? 'LURKING' : 'CRUISING';
    this.biteValue.textContent = String(sim.stats.bites).padStart(2, '0'); this.clock.textContent = time(sim.stats.time);
    if (sim.chain !== this.lastChain) {
      this.lastChain = sim.chain;
      this.chain.innerHTML = sim.chain > 1 ? `<strong>×${sim.chain}</strong><span>KEEP EATING</span><i class="chain-life" aria-hidden="true"></i>` : '';
      if (sim.chain > 1 && !this.reducedMotion.matches) this.chain.animate([{ transform: 'translateY(4px) scale(1.08)' }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
    }
    this.chain.style.setProperty('--chain-life', String(clamp(sim.chainTime / 4.5)));
    this.hud.dataset.motion = sim.state === 'air' ? sim.slam ? 'slam' : 'air' : sim.deep ? 'deep' : 'sand';
    this.hud.classList.toggle('full-tilt', sim.speed > 25);
    this.el('deep-label').classList.toggle('visible', sim.deep);
    this.calloutTimer -= dt; if (this.calloutTimer <= 0) this.callout.classList.remove('visible');
    this.toastTimer -= dt; if (this.toastTimer <= 0) this.toast.classList.remove('visible');
    if (hunt) { this.updateHunt(hunt, sim, dt); return; }
    const lesson = sim.stats.time < 9 ? 0 : sim.stats.breaches === 0 ? 1 : sim.stats.slams === 0 ? 2 : sim.stats.time < 55 ? 3 : 4;
    if (lesson !== this.currentLesson) {
      this.currentLesson = lesson;
      const texts = [
        ['FIND YOUR FEET. ALL ZERO OF THEM.', '<kbd>MOUSE</kbd> to look &nbsp; <kbd>W</kbd> to surge &nbsp; <kbd>S</kbd> to lurk'],
        ['GET UNDER IT.', 'Build speed with <kbd>W</kbd>. Hold <kbd>SPACE</kbd> to dive. Release to breach.'],
        ['WHAT GOES UP, CAN HIT HARDER.', 'In the air, press <kbd>SPACE</kbd> to slam. Try it near a camp.'],
        ['THE DESERT IS YOURS.', '<kbd>LMB</kbd> to lunge. Eat on contact. Flip jeeps before you bite.']
      ];
      this.hint.classList.toggle('dismissed', lesson === 4);
      if (lesson < 4) { this.el('lesson-title').textContent = texts[lesson][0]; this.hintText.innerHTML = texts[lesson][1]; this.root.querySelector('.lesson-number')!.textContent = `0${lesson + 1}`; }
    }
  }
  event(e: Event, sim: Simulation) {
    if (this.screen !== 'play') return;
    const hunt = this.readHunt(sim), eventType: string = e.type;
    if (e.type === 'eat') {
      if (this.growthTimer <= 0) { this.callout.textContent = e.label ?? 'GULP'; this.callout.classList.remove('visible'); void this.callout.offsetWidth; this.callout.classList.add('visible'); this.calloutTimer = 1.6; }
      if (!this.reducedMotion.matches) this.biteValue.animate([{ transform: 'scale(1.28)', color: '#ffb26d' }, { transform: 'scale(1)', color: '#f3dfbf' }], { duration: 350 });
    }
    if (hunt) {
      if (eventType === 'hurt') { this.damageHint = e.label ?? 'HIT — CHANGE COURSE'; this.damageHintTimer = 3; }
      if (eventType === 'grow') this.announceGrowth(hunt.stage);
      if (eventType === 'hurt' && !this.reducedMotion.matches) this.el('hunt-health-value').animate([{ transform: 'translateX(-3px)', color: '#ff896a' }, { transform: 'translateX(3px)' }, { transform: 'none', color: '#f3dfbf' }], { duration: 220 });
      return;
    }
    const achievement = e.type === 'slam' ? ['slam', 'EARTHSHAKER', 'The ground is a suggestion.'] : e.type === 'breach' && e.power > 25 ? ['breach', 'HELLO, SUNSHINE', 'That’s what a run-up feels like.'] : e.type === 'eat' && sim.stats.bites === 1 ? ['bite', 'AN APPETITE AWAKENS', 'There’s plenty more where that came from.'] : null;
    if (achievement && !this.completed.has(achievement[0])) {
      this.completed.add(achievement[0]); this.toast.innerHTML = `<span class="toast-star">✳</span><div><small>A LITTLE DISCOVERY</small><strong>${achievement[1]}</strong><p>${achievement[2]}</p></div>`;
      this.toast.classList.add('visible'); this.toastTimer = 4.5;
    }
  }
  target(cue: { x: number; y: number; angle: number; distance: number; onScreen: boolean; ready: boolean } | null) {
    const marker = this.el('apex-marker'); marker.hidden = !cue || this.screen !== 'play';
    if (!cue) return;
    marker.style.left = `${cue.x}px`; marker.style.top = `${cue.y}px`;
    marker.classList.toggle('offscreen', !cue.onScreen); marker.classList.toggle('ready', cue.ready);
    marker.querySelector('i')!.style.transform = `rotate(${cue.angle}rad)`;
    marker.querySelector('small')!.textContent = `${Math.round(cue.distance)} M${cue.ready ? ' · EDIBLE' : ' · GROW FIRST'}`;
  }
  report(stats: Stats, hunt?: HuntReport) {
    this.el('report-bites').textContent = String(stats.bites); this.el('report-air').innerHTML = `${stats.bestAir.toFixed(1)}<small>M</small>`;
    this.el('report-slams').textContent = String(stats.slams); this.el('report-time').textContent = time(stats.time);
    this.el('report-chain').textContent = `×${stats.bestChain}`; this.el('report-distance').textContent = `${Math.round(stats.distance)} M`;
    this.el('report-rank').innerHTML = stats.slams > 4 ? 'DUNE<br>MENACE' : stats.bestAir > 18 ? 'SKY<br>THIEF' : stats.bites > 6 ? 'LOCAL<br>LEGEND' : 'SAND<br>ROAMER';
    const won = hunt?.status === 'won', screen = this.root.querySelector<HTMLElement>('[data-panel="report"]')!;
    screen.dataset.mode = hunt ? 'hunt' : 'toy'; screen.dataset.result = hunt ? won ? 'won' : 'lost' : 'outing';
    this.el('toy-report-stats').hidden = !!hunt; this.el('hunt-report-stats').hidden = !hunt; this.el('hunt-biggest').hidden = !hunt;
    this.el('report-subtitle').textContent = hunt ? 'HUNT REPORT / 01' : 'FIELD REPORT / 01';
    this.el('report-eyebrow').textContent = hunt ? won ? 'HUNT COMPLETE · RALLY CANCELLED' : 'HUNT ENDED · THE SAND REMEMBERS' : 'THE SURFACE WILL REMEMBER';
    this.el('report-heading').innerHTML = hunt ? won ? 'THE SKY<br>WAS LUNCH.' : 'THE DESERT<br>BITES BACK.' : 'A GOOD DAY<br>TO BE A WORM.';
    this.el('report-detail-label').textContent = hunt ? 'BEST BREACH' : 'TIME IN THE SAND';
    this.el('report-stamp-label').textContent = hunt ? 'FIRST LIGHT' : 'DUNE SEA';
    this.el('report-stamp-foot').textContent = hunt ? won ? 'APEX TARGET SWALLOWED' : 'ANOTHER APPETITE AWAITS' : 'LEAVE ONLY TREMORS';
    this.el('report-footer').textContent = hunt ? won ? 'SMALL WAS ONLY EVER THE BEGINNING.' : 'THE NEXT MEAL IS STILL OUT THERE.' : 'NO CLOCK TO BEAT. JUST A DESERT TO GET UNDER.';
    const replay = this.el('report-replay'); replay.dataset.action = hunt ? 'hunt' : 'start'; replay.innerHTML = `${hunt ? 'HUNT AGAIN' : 'STILL HUNGRY'} ${arrow}`;
    if (hunt) {
      this.el('hunt-report-score').textContent = Math.round(hunt.score).toLocaleString('en-US');
      this.el('hunt-report-time').textContent = time(stats.time); this.el('hunt-report-bites').textContent = String(stats.bites);
      this.el('hunt-report-meal').textContent = (hunt.biggestMeal ?? 'Nothing yet').toUpperCase();
      this.el('report-time').textContent = `${stats.bestAir.toFixed(1)} M`;
      const medal = ['gold', 'silver', 'bronze'].includes(hunt.medal) ? hunt.medal.toUpperCase() : 'NO';
      this.el('report-rank').innerHTML = `${medal}<br>MEDAL`; screen.dataset.medal = hunt.medal;
    }
    this.show('report');
  }
}
