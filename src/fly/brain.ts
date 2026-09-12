/** Authored recurrent rate-neuron model. No biological connectivity or trained weights claimed. */
export const NEURONS = [
  ["visionL", "Left vision", "Visible target to the left"],
  ["visionR", "Right vision", "Visible target to the right"],
  ["near", "Target range", "Approach distance reached"],
  ["obstacleL", "Left obstacle", "Left feeler proximity"],
  ["obstacleR", "Right obstacle", "Right feeler proximity"],
  ["stuck", "Contact", "Sustained motion loss or frontal contact"],
  ["reward", "Sugar", "Temporary arousal input"],
  ["aligned", "Alignment", "Clear target in the firing sector"],
  ["orientL", "Orient left", "Leftward visual response"],
  ["orientR", "Orient right", "Rightward visual response"],
  ["seek", "Seek", "Exploratory drive inhibited by close targets"],
  ["avoidL", "Avoid left", "Turns left away from right obstacles"],
  ["avoidR", "Avoid right", "Turns right away from left obstacles"],
  ["arousal", "Arousal", "Recurrent, sugar-modulated locomotion drive"],
  ["aim", "Aim", "Aligned-target response with contact inhibition"],
  ["retreat", "Retreat", "Contact recovery response"],
  ["drive", "Advance", "Forward throttle command"],
  ["left", "Turn left", "Left steering channel"],
  ["right", "Turn right", "Right steering channel"],
  ["reverse", "Reverse", "Reverse throttle command"],
  [
    "fire",
    "Fire",
    "Firing request; physical turret and reload still gate shells",
  ],
  ["brake", "Hold", "Stop at engagement distance"],
  ["gaitL", "Left gait", "Left locomotion channel"],
  ["gaitR", "Right gait", "Right locomotion channel"],
] as const;
export interface Synapse {
  from: number;
  to: number;
  weight: number;
}
export const SYNAPSES: readonly Synapse[] = [
  [0, 8, 1.8],
  [1, 9, 1.8],
  [9, 8, -0.45],
  [8, 9, -0.45],
  [2, 10, -1.5],
  [5, 10, -1.4],
  [13, 10, 0.35],
  [4, 11, 1.3],
  [3, 12, 1.3],
  [11, 12, -0.5],
  [12, 11, -0.5],
  [6, 13, 0.6],
  [13, 13, 0.22],
  [7, 14, 1.5],
  [5, 14, -2],
  [5, 15, 1.7],
  [15, 15, 0.08],
  [10, 16, 1.1],
  [13, 16, 0.3],
  [15, 16, -1.8],
  [2, 16, -1.1],
  [8, 17, 1],
  [11, 17, 1.2],
  [9, 18, 1],
  [12, 18, 1.2],
  [15, 19, 1.2],
  [14, 20, 1.2],
  [15, 20, -2],
  [2, 21, 1.2],
  [16, 22, 0.85],
  [19, 22, 0.6],
  [18, 22, 0.35],
  [17, 22, -0.25],
  [16, 23, 0.85],
  [19, 23, 0.6],
  [17, 23, 0.35],
  [18, 23, -0.25],
].map(([from, to, weight]) => ({ from: from!, to: to!, weight: weight! }));
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export interface NeuralState {
  activity: Float64Array;
  currents: Float64Array;
  elapsed: number;
}
export function createBrain(): NeuralState {
  return {
    activity: new Float64Array(24),
    currents: new Float64Array(24),
    elapsed: 0,
  };
}
/** Euler-free exponential integration of dr/dt = (clamp(I) - r) / tau. */
export function stepBrain(
  brain: NeuralState,
  senses: ArrayLike<number>,
  dt: number,
): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const step = Math.min(dt, 1 / 30),
    { activity, currents } = brain;
  currents.fill(0);
  currents[10] = 0.78;
  currents[13] = 0.42;
  for (let i = 0; i < 8; i++) currents[i] = clamp(senses[i] ?? 0);
  for (const s of SYNAPSES) currents[s.to]! += activity[s.from]! * s.weight;
  for (let i = 0; i < 24; i++) {
    const tau = i < 8 ? 0.025 : i < 16 ? 0.055 : 0.035;
    activity[i]! +=
      (clamp(currents[i]!) - activity[i]!) * (1 - Math.exp(-step / tau));
  }
  brain.elapsed += step;
}
