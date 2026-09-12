import assert from "node:assert/strict";
import { Vector3 } from "three";
import { installFlyRuntime } from "./runtime.ts";
import { createFlyFrameDocument } from "./frameFocus.ts";
const messages = [],
  listeners = {};
const parent = { postMessage: (m, origin) => messages.push({ m, origin }) };
globalThis.document = {documentElement:{dataset:{}}};
globalThis.location = { origin: "https://fly.test" };
globalThis.window = {
  parent,
  addEventListener: (type, listener) => {
    listeners[type] = listener;
  },
};
const entity = (id, team, z) => ({
  id,
  team,
  spec: { name: id, hp: 100, dims: { heightM: 3 } },
  state: { pos: new Vector3(0, 0, z), yaw: 0, speed: 2, turretYaw: 0 },
  combat: { hp: 100, destroyed: false, reload: { t: 0 } },
  input: {
    throttle: 0,
    steer: 0,
    fire: false,
    brake: false,
    aimPoint: new Vector3(),
  },
});
const player = entity("fly", "player", 0),
  enemy = entity("enemy", "enemy", 100);
const game = {
  phase: "garage",
  player,
  tanks: [player, enemy],
  timeS: 0,
  result: null,
};
let selectedTrial;
let starts = 0,
  visible = false,
  blocked = false;
const runtime = installFlyRuntime({
  game,
  start: async (tankId, mapId) => {
    selectedTrial = {tankId, mapId};
    starts++;
    game.phase = "battle";
  },
  isSpotted: () => visible,
  raycast: () => (blocked ? { dist: 5 } : null),
  follow: () => {},
});
assert.equal(messages[0].m.type, "ready");
const request = (type, extra = {}, origin = location.origin, source = parent) =>
  listeners.message({
    origin,
    source,
    data: { source: "fly-lab", trialId:"", type, ...extra },
  });
await request("start", {}, "https://evil.test");
await request("start", {}, location.origin, {});
await request("start", {trialId:"previous-trial"});
assert.equal(starts, 0, "untrusted origin, source, or stale trial cannot drive arena");
await request("start", {tankId:"bmp2", mapId:"alpine"});
await request("start");
assert.deepEqual(selectedTrial, {tankId:"bmp2", mapId:"alpine"}, "trial selection reaches the battle entry without hardcoded defaults");
assert.equal(starts, 1, "start deduplicates");
for (let i = 0; i < 60; i++) runtime.beforeStep();
assert.equal(player.input.fire, false, "unspotted enemy cannot trigger fire");
visible = true;
for (let i = 0; i < 60; i++) runtime.beforeStep();
assert.equal(player.input.fire, true, "visible aligned target can fire");
assert.equal(player.input.aimPoint.z, 100);
player.state.turretYaw = 1;
for (let i = 0; i < 60; i++) runtime.beforeStep();
assert.equal(
  player.input.fire,
  false,
  "physical turret alignment gates firing",
);
player.state.turretYaw = 0;
blocked = true;
for (let i = 0; i < 60; i++) runtime.beforeStep();
assert.equal(player.input.fire, false);
assert.ok(player.input.throttle < 0);
blocked = false;
game.timeS = 2;
await request("sugar");
for (let i = 0; i < 60; i++) runtime.beforeStep();
assert.ok(player.input.throttle > 0.7);
game.timeS = 20;
for (let i = 0; i < 60; i++) runtime.beforeStep();
assert.equal(player.input.throttle, 0, "sugar expires in simulation time");
await request("pause", { paused: true });
assert.equal(runtime.paused, true);
await request("pilot", { enabled: false });
assert.equal(runtime.paused, false);
player.input.throttle = 0.35;
for (let i = 0; i < 60; i++) runtime.beforeStep();
assert.equal(
  player.input.throttle,
  0.35,
  "human input remains owned by normal controls",
);
runtime.afterStep();
const telemetry = messages.at(-1).m;
assert.equal(telemetry.type, "telemetry");
assert.equal(telemetry.hp, 100);
assert.equal(telemetry.throttle, 0.35);
assert.equal(telemetry.enabled, false);
const owner = {
  hidden: false,
  hasFocus: () => true,
  addEventListener() {},
  removeEventListener() {},
};
const focus = createFlyFrameDocument({ parent: { document: owner } });
assert.equal(focus.hasFocus(), true);
owner.hidden = true;
assert.equal(focus.hasFocus(), false, "hidden lab suspends arena");
console.log(
  "fly runtime: origin isolation, start latch, spotting, turret alignment, sugar expiry, pause, human takeover and parent focus passed",
);

// Normal actions happen only after a physical press, and respect kit receipts.
const actions = [];
let receipt;
const p = entity("kit-tank", "player", 0),
  e = entity("target", "enemy", 100);
p.spec.gun = { shells: [{ name: "Cannon" }, { name: "ATGM", guided: true }] };
p.combat.ammo = [30, 2];
p.combat.shellSlot = 0;
p.combat.modules = { engine: { state: "damaged" } };
const g = { phase: "battle", player: p, tanks: [p, e], timeS: 0, result: null };
const rt = installFlyRuntime({
  game: g,
  start: async () => {},
  isSpotted: () => true,
  raycast: () => null,
  follow: () => {},
  onConsumableUsed: (fn) => (receipt = fn),
  action: (action) => {
    actions.push(action);
    if (action === "repair") {
      receipt(0, g.timeS + 90);
      p.combat.modules.engine.state = "ok";
    }
    if (action === "extinguish") {
      receipt(2, g.timeS + 90);
      p.combat.fire.burning = false;
    }
    if (action === "firstAid") {
      receipt(1, g.timeS + 90);
      p.combat.crew.gunner = true;
    }
    if (action === "missile") p.combat.shellSlot = 1;
    if (action === "cannon") p.combat.shellSlot = 0;
  },
});
const tick = (n) => {
  for (let i = 0; i < n; i++) {
    g.timeS += 1 / 60;
    rt.beforeStep();
  }
};
tick(5);
assert.equal(actions.length, 0, "no action before foreleg contact");
tick(1);
assert.deepEqual(actions, ["repair"]);
tick(60);
assert.ok(actions.includes("missile"));
assert.equal(p.input.fire, true);
p.combat.modules.engine.state = "damaged";
tick(30);
assert.equal(
  actions.filter((a) => a === "repair").length,
  1,
  "cooldown prevents repeated kit use",
);
p.combat.ammo[1] = 0;
tick(30);
assert.equal(p.combat.shellSlot, 0, "empty missiles fall back to cannon");
p.spec.gun.shells = [{ name: "Shillelagh", guided: true }];
p.combat.ammo = [8];
p.combat.shellSlot = 0;
e.state.pos.z = 45;
actions.length = 0;
tick(60);
assert.equal(
  p.input.fire,
  true,
  "missile-only Sheridan can fire at close range",
);
assert.ok(!actions.includes("cannon"), "never select a nonexistent cannon");
console.log(
  "fly embodied actions: contact timing, repair cooldown, real ammo selection and missile-only vehicle PASS",
);

g.timeS = 95;
p.combat.fire = { burning: true };
p.combat.modules.engine.state = "damaged";
p.combat.crew = { gunner: false };
actions.length = 0;
tick(30);
assert.deepEqual(
  actions,
  ["extinguish", "repair", "firstAid"],
  "different kit actions require separate presses even on the same physical panel",
);

// The parent must never reveal a half-built roster just because phase became battle.
let finishLoading;
const loadingGame = {phase:'battle', player, tanks:[player], timeS:1, result:null};
const loadingRuntime = installFlyRuntime({
  game: loadingGame,
  start: () => new Promise(resolve => { finishLoading = resolve; }),
  isSpotted: () => false, raycast: () => null, follow() {},
});
const launchPromise = request('start');
messages.length = 0;
loadingRuntime.afterStep();
assert.equal(messages.length, 0, 'no telemetry before covered deployment finishes');
finishLoading();
await launchPromise;
assert.equal(messages.at(-1).m.type, 'started');
loadingRuntime.afterStep();
assert.equal(messages.at(-1).m.type, 'telemetry', 'reveal only follows completed deployment');
console.log('fly trial entry: selection forwarding and deployment reveal gate PASS');

// A confirmed shot depresses the button briefly, then the foreleg releases
// during reload and must reach the button again before the next shot.
let shotReceipt;
const pressPlayer = entity('press-player', 'player', 0), pressEnemy = entity('press-enemy', 'enemy', 100);
const pressGame = {phase:'battle', player:pressPlayer, tanks:[pressPlayer,pressEnemy], timeS:0, result:null};
const pressRuntime = installFlyRuntime({
  game:pressGame, start:async()=>{}, isSpotted:()=>true, raycast:()=>null, follow(){},
  onShot: listener => {shotReceipt = listener;},
});
await request('start');
const pressTicks = count => {for(let i=0;i<count;i++){pressGame.timeS+=1/60;pressRuntime.beforeStep();}};
pressTicks(30);
assert.equal(pressPlayer.input.fire,true);
pressRuntime.afterStep();
assert.equal(messages.at(-1).m.shotFlash,0,'fire intent alone never invents a shot flash');
shotReceipt();
pressPlayer.combat.reload.t=6;
pressTicks(3);
pressRuntime.afterStep();
assert.ok(messages.at(-1).m.shotFlash>0,'confirmed shot reaches the visible cockpit');
assert.equal(messages.at(-1).m.arms.right.key,'fire');
pressTicks(15);
pressRuntime.afterStep();
assert.equal(pressPlayer.input.fire,false,'release the trigger during a long reload');
assert.equal(messages.at(-1).m.arms.right.key,'rest');
assert.equal(messages.at(-1).m.shotFlash,0,'shot flash expires in simulation time');
pressPlayer.combat.reload.t=0;
pressTicks(5);
assert.equal(pressPlayer.input.fire,false,'next shot waits for the foreleg to reach the key');
pressTicks(1);
assert.equal(pressPlayer.input.fire,true,'physical contact enables the next shot');
console.log('fly fire button: shot receipts, visible hold, reload release, and repeat contact PASS');
