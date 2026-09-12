import assert from "node:assert/strict";
import {
  CELLS,
  CONNECTIONS,
  createConnectome,
  stepConnectome,
} from "./connectome.ts";
assert.equal(CELLS.length, 124);
assert.equal(CONNECTIONS.length, 1106);
for (const e of CONNECTIONS) {
  assert.equal(CELLS[e.from].group, "mAL");
  assert.equal(CELLS[e.to].group, "P1");
  assert.ok(e.weight > 0);
}
function trial(block = false, sugar = 0) {
  const s = createConnectome();
  for (let i = 0; i < 300; i++) stepConnectome(s, 1, sugar, 1 / 60, block);
  return s;
}
const intact = trial(),
  blocked = trial(true),
  rewarded = trial(false, 1);
assert.ok(
  blocked.output > intact.output + 0.15,
  "blocking measured inhibitory edges increases target population output",
);
assert.ok(
  rewarded.output > intact.output,
  "sugar changes live population firing",
);
assert.deepEqual(
  trial(),
  intact,
  "the same inputs reproduce voltages and spikes",
);
assert.ok(
  intact.spikes.some((n) => n > 0),
  "neurons really spike",
);
for (const v of intact.voltage)
  assert.ok(Number.isFinite(v) && v <= -50 && v > -150);
const a = createConnectome(),
  b = createConnectome();
for (let i = 0; i < 60; i++) stepConnectome(a, 0.2, 0, 1 / 60);
for (let i = 0; i < 1000; i++) stepConnectome(b, 0.2, 0, 0.001);
assert.deepEqual(
  a.voltage,
  b.voltage,
  "1 ms integration is independent of frame partition",
);
assert.deepEqual(a.spikes, b.spikes);
const before = a.elapsed;
stepConnectome(a, 1, 1, 0);
assert.equal(a.elapsed, before);
console.log(
  "fly connectome: measured topology, spiking, inhibitory causality, sugar, deterministic fixed-step integration PASS",
);
