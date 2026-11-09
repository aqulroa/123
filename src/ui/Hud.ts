import type { LightingPreset } from '../core/EventBus';

export interface HudState {
  speedKmh: number;
  fps: number;
  preset: LightingPreset;
  laneLabel: string;
  pocketInfo: string;
}

/** DOM overlay: loading screen, speed readout and controls hint. */
export class Hud {
  private root: HTMLElement;
  private loader: HTMLElement;
  private loaderBar: HTMLElement;
  private loaderLabel: HTMLElement;
  private speed: HTMLElement;
  private info: HTMLElement;
  private visible = true;

  constructor(parent: HTMLElement) {
    parent.insertAdjacentHTML(
      'beforeend',
      `<div class="loader" id="loader">
         <div class="loader__title">ГОРОДСКОЙ ПОТОК<span>ШАШКИ</span></div>
         <div class="loader__track"><div class="loader__bar"></div></div>
         <div class="loader__label">Загрузка…</div>
       </div>
       <div class="hud" id="hud">
         <div class="hud__speed"><b>0</b><small>км/ч</small></div>
         <div class="hud__info"></div>
         <div class="hud__keys">W/S — газ/тормоз · A/D — перестроение · N — день/ночь · H — HUD</div>
       </div>`,
    );
    this.loader = parent.querySelector('#loader')!;
    this.loaderBar = this.loader.querySelector('.loader__bar')!;
    this.loaderLabel = this.loader.querySelector('.loader__label')!;
    this.root = parent.querySelector('#hud')!;
    this.speed = this.root.querySelector('.hud__speed b')!;
    this.info = this.root.querySelector('.hud__info')!;
  }

  progress(label: string, value: number): void {
    this.loaderLabel.textContent = label;
    this.loaderBar.style.width = `${Math.round(value * 100)}%`;
  }

  hideLoader(): void {
    this.loader.classList.add('loader--done');
    setTimeout(() => this.loader.remove(), 900);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.style.display = this.visible ? '' : 'none';
  }

  update(s: HudState): void {
    if (!this.visible) return;
    this.speed.textContent = String(Math.round(s.speedKmh));
    this.info.textContent = `${s.preset === 'golden' ? 'Золотой час' : 'Ночь · мокрый асфальт'} · ${s.laneLabel}${
      s.pocketInfo ? ' · ' + s.pocketInfo : ''
    } · ${Math.round(s.fps)} FPS`;
  }
}
