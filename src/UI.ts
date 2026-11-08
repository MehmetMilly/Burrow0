import type { Simulation, Stats, Event } from './game/Simulation';
import type { Sound } from './game/Audio';
import { clamp, ground } from './game/math';

export type Screen = 'title' | 'play' | 'pause' | 'settings' | 'guide' | 'report';
export interface Settings { sensitivity: number; invert: boolean; volume: number; quality: string; }
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
          <div class="title-actions"><button class="primary" data-action="start">ENTER THE DUNES ${arrow}</button><div class="secondary-actions"><button data-action="guide">FIELD GUIDE <span>↗</span></button><button data-action="settings">SETTINGS <span>↗</span></button></div></div>
          <p class="scope-note">A sandworm playground. Follow your appetite.</p>
        </main>
        <div class="specimen"><span class="specimen-line"></span><p>THE HATCHLING <span>—</span> <small>SMALL. FOR NOW.</small></p></div>
        <footer class="title-footer"><span>25° 17′ N &nbsp; 46° 42′ E</span><span class="footer-middle">HEADPHONES ON. &nbsp; LEAVE THE SURFACE BEHIND.</span><span>MOUSE + KEYBOARD <span class="key-icon">⌘</span></span></footer>
      </div>
      <div id="hud" class="hud" hidden>
        <div class="hunt-label"><span class="tiny-sun">✳</span><div><span class="eyebrow">DUNE SEA</span><strong>FIRST LIGHT</strong><small>FREE ROAM</small></div></div>
        <div class="hud-top-right"><span id="clock">00:00</span><span class="pause-note"><kbd>ESC</kbd> PAUSE</span></div>
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
      <div class="modal-scrim" id="scrim" hidden></div>
      <section class="panel pause-panel" data-panel="pause" role="dialog" aria-modal="true" aria-label="Paused" hidden><p class="eyebrow">TAKE A BREATH</p><h2>THE DESERT<br>CAN WAIT.</h2><p class="panel-prose">Your next meal isn't going anywhere.<br>Well. It probably is.</p><button class="primary" data-action="resume">BACK BENEATH ${arrow}</button><button class="text-button" data-action="settings">SETTINGS <span>↗</span></button><button class="text-button" data-action="guide">FIELD GUIDE <span>↗</span></button><button class="text-button subdued" data-action="finish">END OUTING <span>→</span></button><p class="panel-foot"><kbd>ESC</kbd> RETURN TO THE DUNES</p></section>
      <section class="panel settings-panel" data-panel="settings" role="dialog" aria-modal="true" aria-label="Settings" hidden><button class="close-button" data-action="back" aria-label="Back">×</button><p class="eyebrow">MAKE YOURSELF AT HOME</p><h2>INSTINCTS.</h2><label class="setting"><span>MOUSE SENSITIVITY <output id="sensitivity-output">1.0</output></span><input id="sensitivity" type="range" min="0.2" max="2.5" step="0.1" value="${this.settings.sensitivity}"></label><label class="setting toggle"><span>INVERT VERTICAL LOOK</span><input id="invert" type="checkbox" ${this.settings.invert ? 'checked' : ''}></label><label class="setting"><span>MASTER VOLUME <output id="volume-output">65%</output></span><input id="volume" type="range" min="0" max="1" step="0.05" value="${this.settings.volume}"></label><label class="setting"><span>GRAPHICS QUALITY</span><select id="quality"><option value="high">HIGH · FULL SUN</option><option value="medium">MEDIUM · LIGHTER SAND</option><option value="low">LOW · SOFT SHADOWS OFF</option></select></label><button class="primary" data-action="back">ALL SET ${arrow}</button><p class="panel-foot">SAVED AUTOMATICALLY ON THIS DEVICE</p></section>
      <section class="panel guide-panel" data-panel="guide" role="dialog" aria-modal="true" aria-label="Field guide" hidden><button class="close-button" data-action="back" aria-label="Back">×</button><p class="eyebrow">A FIELD GUIDE TO BEING A WORM</p><h2>TRUST YOUR GUT.</h2><div class="guide-row"><span>01</span><div><h3>DRAW YOUR LINE</h3><p>Mouse to look. You follow with a little weight.<br><kbd>W</kbd> surges. <kbd>S</kbd> lurks. <kbd>A</kbd> / <kbd>D</kbd> help you turn.</p></div></div><div class="guide-row"><span>02</span><div><h3>DOWN. THEN VERY, VERY UP.</h3><p>Hold <kbd>SPACE</kbd> or <kbd>RMB</kbd> to dive. Release to breach.<br>Build speed first. Depth alone won't send you far.</p></div></div><div class="guide-row"><span>03</span><div><h3>MAKE AN ENTRANCE</h3><p>Press <kbd>SPACE</kbd> in the air to slam. Scatter the camp.<br><kbd>LMB</kbd> lunges and gives one mid-air correction.</p></div></div><div class="guide-row"><span>04</span><div><h3>IF IT FITS, IT'S FOOD</h3><p>Eating is automatic. Rabbits, chickens, crates, pots.<br>Jeeps are too tough. Flip one with a slam first.</p></div></div><button class="primary" data-action="back">GOT AN APPETITE ${arrow}</button></section>
      <section class="screen report-screen" data-panel="report" hidden><div class="report-header">${wormMark}<span>DUNE SEA EXPEDITION <small>FIELD REPORT / 01</small></span></div><div class="report-main"><p class="eyebrow">THE SURFACE WILL REMEMBER</p><h2>A GOOD DAY<br>TO BE A WORM.</h2><div class="report-stats"><div><strong id="report-bites">0</strong><span>MORSELS EATEN</span></div><div><strong id="report-air">0<small>M</small></strong><span>BEST BREACH</span></div><div><strong id="report-slams">0</strong><span>EARTHSHAKERS</span></div></div><div class="report-details"><span>TIME IN THE SAND <b id="report-time">0:00</b></span><span>LONGEST CHAIN <b id="report-chain">0</b></span><span>GROUND COVERED <b id="report-distance">0 M</b></span></div><div class="report-actions"><button class="primary" data-action="start">STILL HUNGRY ${arrow}</button><button class="text-button" data-action="title">BACK TO TITLE <span>→</span></button></div></div><div class="stamp"><span>DUNE SEA</span><strong id="report-rank">SAND<br>ROAMER</strong><span>LEAVE ONLY TREMORS</span></div><p class="report-foot">NO CLOCK TO BEAT. JUST A DESERT TO GET UNDER.</p></section>
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
  reset() { this.completed.clear(); this.lastChain = -1; this.currentLesson = -1; this.calloutTimer = 0; this.toastTimer = 0; this.callout.classList.remove('visible'); this.toast.classList.remove('visible'); }
  update(sim: Simulation, dt: number, deep: number) {
    this.root.style.setProperty('--deep', deep.toFixed(3));
    if (this.screen !== 'play') return;
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
    if (e.type === 'eat') {
      this.callout.textContent = e.label ?? 'GULP'; this.callout.classList.remove('visible'); void this.callout.offsetWidth; this.callout.classList.add('visible'); this.calloutTimer = 1.6;
      if (!this.reducedMotion.matches) this.biteValue.animate([{ transform: 'scale(1.28)', color: '#ffb26d' }, { transform: 'scale(1)', color: '#f3dfbf' }], { duration: 350 });
    }
    const achievement = e.type === 'slam' ? ['slam', 'EARTHSHAKER', 'The ground is a suggestion.'] : e.type === 'breach' && e.power > 25 ? ['breach', 'HELLO, SUNSHINE', 'That’s what a run-up feels like.'] : e.type === 'eat' && sim.stats.bites === 1 ? ['bite', 'AN APPETITE AWAKENS', 'There’s plenty more where that came from.'] : null;
    if (achievement && !this.completed.has(achievement[0])) {
      this.completed.add(achievement[0]); this.toast.innerHTML = `<span class="toast-star">✳</span><div><small>A LITTLE DISCOVERY</small><strong>${achievement[1]}</strong><p>${achievement[2]}</p></div>`;
      this.toast.classList.add('visible'); this.toastTimer = 4.5;
    }
  }
  report(stats: Stats) {
    this.el('report-bites').textContent = String(stats.bites); this.el('report-air').innerHTML = `${stats.bestAir.toFixed(1)}<small>M</small>`;
    this.el('report-slams').textContent = String(stats.slams); this.el('report-time').textContent = time(stats.time);
    this.el('report-chain').textContent = `×${stats.bestChain}`; this.el('report-distance').textContent = `${Math.round(stats.distance)} M`;
    this.el('report-rank').innerHTML = stats.slams > 4 ? 'DUNE<br>MENACE' : stats.bestAir > 18 ? 'SKY<br>THIEF' : stats.bites > 6 ? 'LOCAL<br>LEGEND' : 'SAND<br>ROAMER';
    this.show('report');
  }
}
