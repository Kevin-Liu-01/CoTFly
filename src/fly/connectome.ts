import data from "./data/circuit.json" with { type: "json" };
export const CELLS = data.nodes;
const index = new Map(CELLS.map((n, i) => [n.id, i]));
export const CONNECTIONS = data.edges.map((e) => ({
  from: index.get(e.source)!,
  to: index.get(e.target)!,
  weight: e.weight,
}));
const targets = CELLS.filter((n) => n.group === "P1").length;
const normalization =
  CONNECTIONS.reduce((sum, e) => sum + e.weight, 0) / targets;
export function createConnectome() {
  const count = CELLS.length;
  return {
    voltage: Float64Array.from(CELLS, (_, i) => -65 + (i % 13) * 0.4),
    refractory: new Float64Array(count),
    inhibition: new Float64Array(count),
    rates: new Float64Array(count),
    spikes: new Uint32Array(count),
    previous: new Uint8Array(count),
    elapsed: 0,
    remainder: 0,
    output: 0,
  };
}
export type ConnectomeState = ReturnType<typeof createConnectome>;
/** Live LIF dynamics at 1 ms: tau_m=20 ms, rest/reset=-65 mV,
 * threshold=-50 mV, refractory=3 ms, inhibitory decay=12 ms.
 * Measured anatomical counts; all dynamics and battle input mappings authored. */
export function stepConnectome(
  s: ConnectomeState,
  threat: number,
  sugar: number,
  dt: number,
  outputBlock = false,
) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  s.remainder += Math.min(dt, 1 / 30);
  const drive = Math.max(0, Math.min(1, threat));
  const reward = Math.max(0, Math.min(1, sugar));
  while (s.remainder >= 0.001 - 1e-10) {
    s.remainder -= 0.001;
    for (let i = 0; i < CELLS.length; i++)
      s.inhibition[i] *= Math.exp(-0.001 / 0.012);
    if (!outputBlock)
      for (const e of CONNECTIONS) {
        if (s.previous[e.from])
          s.inhibition[e.to] += (e.weight / normalization) * 18;
      }
    s.previous.fill(0);
    for (let i = 0; i < CELLS.length; i++) {
      s.rates[i] *= Math.exp(-0.001 / 0.12);
      if (s.refractory[i] > 0) {
        s.refractory[i] -= 0.001;
        continue;
      }
      const inhibitory = CELLS[i]!.group === "mAL";
      const current = inhibitory
        ? 17 + drive * 10 - reward * 3
        : 22 + reward * 10 + drive * 3;
      const heterogeneity = 0.92 + (CELLS[i]!.id % 17) * 0.01;
      s.voltage[i] +=
        (-65 - s.voltage[i]! + current * heterogeneity - s.inhibition[i]!) *
        (1 - Math.exp(-0.001 / 0.02));
      if (s.voltage[i]! >= -50) {
        s.voltage[i] = -65;
        s.refractory[i] = 0.003;
        s.previous[i] = 1;
        s.spikes[i]++;
        s.rates[i] += 1 / 0.12;
      }
    }
    s.elapsed += 0.001;
  }
  let rate = 0;
  for (let i = 0; i < CELLS.length; i++)
    if (CELLS[i]!.group === "P1") rate += s.rates[i]!;
  s.output = Math.min(1, rate / targets / 50);
}
