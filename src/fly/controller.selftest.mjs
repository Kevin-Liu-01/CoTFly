import assert from "node:assert/strict";
import { createFlyController, thinkFly, wrapAngle } from "./controller.ts";
import { createBrain, stepBrain } from "./brain.ts";
import { createStation, stepArm } from "./actuators.ts";
const base = {
  time: 0,
  yaw: 0,
  speed: 4,
  targetBearing: null,
  targetDistance: Infinity,
  blocked: false,
  sugar: false,
};
const out = () => ({ throttle: 0, steer: 0, fire: false, intent: "" });
function warm(s, seconds = 0.8) {
  const c = createFlyController(),
    m = out();
  for (let i = 0; i < seconds * 60; i++)
    thinkFly({ ...s, time: s.time + i / 60 }, m, c);
  return { c, m };
}
assert.equal(warm(base).m.fire, false);
assert.ok(
  warm(base).m.throttle > 0.7,
  "neural drive advances without a target",
);
assert.ok(
  warm({ ...base, targetBearing: 0.6, targetDistance: 200 }).m.steer > 0.5,
);
assert.ok(
  warm({ ...base, targetBearing: -0.6, targetDistance: 200 }).m.steer < -0.5,
);
assert.equal(
  warm({ ...base, targetBearing: 0, targetDistance: 100 }).m.throttle,
  0,
);
assert.ok(
  warm({ ...base, targetBearing: 0, targetDistance: 100, sugar: true }).m
    .throttle > 0.7,
);
assert.equal(
  warm({ ...base, targetBearing: Math.PI, targetDistance: 100 }).m.fire,
  false,
);
const recovery = warm({
  ...base,
  blocked: true,
  targetBearing: 0,
  targetDistance: 20,
});
assert.ok(recovery.m.throttle < 0);
assert.equal(recovery.m.fire, false);
const c = createFlyController(),
  m = out();
for (let i = 0; i < 60; i++)
  thinkFly({ ...base, time: 4 + i / 60, speed: 0 }, m, c);
assert.ok(c.reverseUntil > 4.65, "sustained stall triggers recovery");
const a = createFlyController(),
  b = createFlyController();
for (let i = 0; i < 600; i++) {
  const s = {
    ...base,
    time: i / 60,
    targetBearing: Math.sin(i * 0.04),
    targetDistance: 200,
  };
  assert.deepEqual(thinkFly(s, out(), a), thinkFly(s, out(), b));
  for (const v of a.brain.activity) assert.ok(v >= 0 && v <= 1);
}
const brain = createBrain();
for (let i = 0; i < 100; i++)
  stepBrain(brain, [0, 0, 0, 0, 0, 0, 1, 0], 1 / 60);
assert.ok(brain.activity[13] > 0.8, "sugar drives recurrent arousal");
assert.ok(brain.activity[16] > 0.7, "processing causes motor output");
const station = createStation();
stepArm(station.right, "fire", 1 / 60);
assert.equal(station.right.contact, false, "movement must precede actuation");
for (let i = 0; i < 5; i++) stepArm(station.right, "fire", 1 / 60);
assert.equal(station.right.pressed, true);
stepArm(station.right, "fire", 1 / 60);
assert.equal(station.right.pressed, false, "held key has only one rising edge");
stepArm(station.right, "repair", 1 / 60);
assert.equal(
  station.right.contact,
  false,
  "switching control requires another reach",
);
assert.ok(Math.abs(wrapAngle(2 * Math.PI + 0.1) - 0.1) < 1e-8);
console.log(
  "fly controller: neural causality, bounded deterministic activity, steering, recovery, sugar, and foreleg contact gates PASS",
);
