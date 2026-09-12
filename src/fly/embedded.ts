import { Group } from 'three';
import type { BootScreen } from '../ui/bootScreen.ts';
import type { BattleLoadScreen } from '../ui/battleLoad.ts';
import type { GarageRuntime } from '../ui/garage.ts';
import type { GarageStageRuntime } from '../ui/garageStage.ts';

export const flyEmbedded = new URLSearchParams(location.search).get('fly-agent') === '1' && window.parent !== window;
const send = (payload: object) => window.parent.postMessage({ source: 'fly-arena', trialId: new URLSearchParams(location.search).get('trial') ?? '', ...payload }, location.origin);
const stages: Record<string, [number, string]> = {
  renderer: [0.03, 'Connecting the renderer'], sky: [0.06, 'Preparing atmosphere'],
  lighting: [0.09, 'Calibrating optics'], garage: [0.11, 'Connecting battle systems'],
  vehicle: [0.13, 'Connecting vehicle controls'], hud: [0.15, 'Connecting instruments'],
  ui: [0.17, 'Linking the console'], audio: [0.19, 'Connecting battlefield audio'],
  post: [0.21, 'Preparing the viewport'], ready: [0.23, 'Neural pilot connected'],
};
/** The parent owns all loading pixels. These ports preserve covered-render barriers. */
export function createFlyBootScreen(): BootScreen {
  return {
    begin(key) { const [fraction, label] = stages[key] ?? [0.2, 'Preparing battle systems']; send({type: 'progress', fraction, label}); },
    end() {}, sub() {}, note(label) { send({type:'progress', label}); },
    async ready() {}, dismiss() {}, gated: false,
  };
}
export function createFlyBattleLoader(): BattleLoadScreen {
  let covering = false;
  const root = document.createElement('div');
  return {
    root, get visible() { return covering; }, get covering() { return covering; },
    showPending() { covering = true; }, show() { covering = true; }, rosters() {}, countdown() {},
    progress(fraction, label) { send({type:'progress', fraction: 0.24 + Math.max(0, Math.min(1, fraction)) * 0.75, label}); },
    async hide() { covering = false; },
  };
}
/** Battle adapters retain selection ports without constructing a Garage DOM or its images. */
export function createFlyGarage(): GarageRuntime {
  let selected = 'm1a1', map = 'desert';
  return {
    root: document.createElement('div'), isOpen: false,
    show() {}, hide() {}, drainThumbs() {}, attachSettingsControl() {},
    getStageRect: () => ({x: 0, y: 0, w: innerWidth, h: innerHeight}),
    setSelected(id) { selected = id; }, getSelected: () => selected,
    getSelectedGarageVariant: () => 'verdant_motor_pool', setSelectedGarageVariant: () => false,
    getNeighborIds: () => [], setRoomStatus() {}, isVehicleLocked: () => false,
    getSelectedMap: () => map, setSelectedMap(id) { map = id; }, startSolo() {},
  };
}
/** No workshop geometry, procedural textures, scene packs, or background exhibits. */
export function createFlyGarageStage(): GarageStageRuntime {
  const unavailable = (): never => { throw new Error('Garage diagnostics are unavailable in the CoTFly battle runtime.'); };
  return {group: new Group(), setVariant: id => id, async prepareSelector() {},
    async prepareVariant() { return unavailable(); }, stats: unavailable, dispose() {}};
}
