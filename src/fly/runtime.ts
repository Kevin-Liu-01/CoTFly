import { Vector3 } from "three";
import { createFlyController, thinkFly, wrapAngle } from "./controller.ts";
import { createStation, stepArm } from "./actuators.ts";
import type { FlyMotor, FlySense } from "./controller.ts";

interface Entity {
  id: string;
  team: string;
  spec: {
    name: string;
    hp: number;
    dims: { heightM: number };
    gun?: {
      shells: { name: string; guided?: boolean; velocityMps?: number }[];
    };
  };
  state: { pos: Vector3; yaw: number; speed: number; turretYaw: number } | null;
  combat: {
    hp: number;
    destroyed: boolean;
    reload: { t: number };
    shellSlot?: number;
    ammo?: number[];
    modules?: Record<string, { state: string }>;
    crew?: Record<string, boolean>;
    fire?: { burning: boolean };
  } | null;
  input: {
    throttle: number;
    steer: number;
    fire: boolean;
    brake: boolean;
    aimPoint: Vector3;
  };
}
export interface FlyPorts {
  game: {
    phase: string;
    player: Entity | null;
    tanks: Entity[];
    timeS: number;
    result: string | null;
  };
  isSpotted(id: string): boolean;
  start(tankId: string, mapId: string): Promise<unknown>;
  action?(
    action: "repair" | "firstAid" | "extinguish" | "missile" | "cannon",
  ): void;
  setFire?(pressed: boolean): void;
  onShot?(listener: () => void): void;
  onConsumableUsed?(listener: (slot: number, readyAt: number) => void): void;
  raycast(
    origin: Vector3,
    direction: Vector3,
    distance: number,
  ): { dist: number } | null;
  follow(yaw: number, scopeTarget: Vector3 | null): void;
  releaseScope?(): void;
  releaseHumanControls?(): void;
}
export interface FlyRuntime {
  readonly autonomous: boolean;
  paused: boolean;
  beforeStep(): void;
  afterStep(): void;
}

/** Same-origin, opt-in solo integration. No debug surface or multiplayer access. */
export function installFlyRuntime(ports: FlyPorts): FlyRuntime {
  let enabled = true,
    started = false,
    deploymentReady = false,
    sugarUntil = 0,
    lastReport = -1,
    lastCamera = -1,
    targetId: string | null = null,
    cameraYaw = 0,
    scoped = false;
  const trialId = new URLSearchParams(location.search).get("trial") ?? "";
  let lastShotAt = -Infinity;
  ports.onShot?.(() => { if (enabled) lastShotAt = ports.game.timeS; });
  const controller = createFlyController();
  const station = createStation();
  const kitReadyAt = [0, 0, 0];
  ports.onConsumableUsed?.((slot, readyAt) => {
    kitReadyAt[slot] = readyAt;
  });
  let repairSlot = -1;
  const pendingAim = new Vector3();
  const sense: FlySense = {
    time: 0,
    yaw: 0,
    speed: 0,
    targetBearing: null,
    targetDistance: Infinity,
    blocked: false,
    sugar: false,
  };
  const motor: FlyMotor = {
    throttle: 0,
    steer: 0,
    fire: false,
    intent: "Waiting for the arena",
  };
  const origin = new Vector3(),
    direction = new Vector3(),
    targetPoint = new Vector3();
  const send = (type: string, payload: object = {}) =>
    window.parent.postMessage(
      { source: "fly-arena", trialId, type, ...payload },
      location.origin,
    );
  const runtime: FlyRuntime = {
    get autonomous() {
      return enabled;
    },
    paused: false,
    beforeStep() {
      const { game } = ports,
        player = game.player;
      if (
        !enabled ||
        !player?.state ||
        !player.combat ||
        player.combat.destroyed ||
        game.result
      ) {
        if (scoped) {
          scoped = false;
          ports.releaseScope?.();
        }
        return;
      }
      const state = player.state;
      origin.copy(state.pos);
      origin.y += 2;
      direction.set(Math.sin(state.yaw), 0, Math.cos(state.yaw));
      const obstacle = ports.raycast(origin, direction, 18);
      sense.blocked = !!obstacle && obstacle.dist < 10;
      direction.set(Math.sin(state.yaw - 0.55), 0, Math.cos(state.yaw - 0.55));
      const left = ports.raycast(origin, direction, 22);
      sense.obstacleLeft = left ? Math.max(0, 1 - left.dist / 22) : 0;
      direction.set(Math.sin(state.yaw + 0.55), 0, Math.cos(state.yaw + 0.55));
      const right = ports.raycast(origin, direction, 22);
      sense.obstacleRight = right ? Math.max(0, 1 - right.dist / 22) : 0;
      sense.time = game.timeS;
      sense.yaw = state.yaw;
      sense.speed = state.speed;
      sense.sugar = game.timeS < sugarUntil;
      sense.targetBearing = null;
      sense.targetDistance = Infinity;
      let selectedScore = Infinity;
      let nextTarget: string | null = null;
      for (const enemy of game.tanks) {
        if (
          enemy.team === player.team ||
          !enemy.state ||
          !enemy.combat ||
          enemy.combat.destroyed
        )
          continue;
        if (!ports.isSpotted(enemy.id)) continue;
        targetPoint.copy(enemy.state.pos);
        targetPoint.y += enemy.spec.dims.heightM * 0.55;
        direction.copy(targetPoint).sub(origin);
        const distance = direction.length();
        const score = distance * (enemy.id === targetId ? 0.72 : 1);
        if (score >= selectedScore || distance < 1) continue;
        direction.multiplyScalar(1 / distance);
        const hit = ports.raycast(origin, direction, distance);
        if (hit && hit.dist < distance - 4) continue;
        selectedScore = score;
        nextTarget = enemy.id;
        sense.targetDistance = distance;
        sense.targetBearing = Math.atan2(direction.x, direction.z);
        pendingAim.copy(targetPoint);
      }
      targetId = nextTarget;
      thinkFly(sense, motor, controller);
      // Fire only after the physical turret has actually reached the bearing.
      if (sense.targetBearing !== null)
        motor.fire &&=
          Math.abs(
            wrapAngle(sense.targetBearing - state.yaw - state.turretYaw),
          ) < 0.08;
      else
        pendingAim.set(
          state.pos.x + Math.sin(state.yaw) * 250,
          state.pos.y + 2,
          state.pos.z + Math.cos(state.yaw) * 250,
        );
      player.input.throttle = motor.throttle;
      player.input.steer = motor.steer;
      const shells = player.spec.gun?.shells ?? [];
      const missileSlot = shells.findIndex((shell) => shell.guided);
      const hasCannon = shells.some((shell) => !shell.guided);
      const guided = !!shells[player.combat.shellSlot ?? 0]?.guided;
      const wantsMissile =
        missileSlot >= 0 &&
        (player.combat.ammo?.[missileSlot] ?? 0) > 0 &&
        sense.targetBearing !== null &&
        sense.targetDistance > 75;
      const previousRepairSlot = repairSlot;
      repairSlot = -1;
      if (player.combat.fire?.burning && game.timeS >= kitReadyAt[2]!)
        repairSlot = 2;
      else if (
        Object.values(player.combat.modules ?? {}).some(
          (module) => module.state !== "ok",
        ) &&
        game.timeS >= kitReadyAt[0]!
      )
        repairSlot = 0;
      else if (
        Object.values(player.combat.crew ?? {}).some((alive) => !alive) &&
        game.timeS >= kitReadyAt[1]!
      )
        repairSlot = 1;
      if (
        repairSlot >= 0 &&
        repairSlot !== previousRepairSlot &&
        station.right.key === "repair"
      )
        station.right.key = "rest";
      stepArm(
        station.left,
        sense.targetBearing !== null ? "aim" : "look",
        1 / 60,
      );
      stepArm(
        station.right,
        repairSlot >= 0
          ? "repair"
          : wantsMissile !== guided && missileSlot >= 0 && hasCannon
            ? "missile"
            : motor.fire && (player.combat.reload.t <= 0.09 || game.timeS - lastShotAt < 0.12)
              ? "fire"
              : "rest",
        1 / 60,
      );
      if (station.left.contact) player.input.aimPoint.copy(pendingAim);
      if (station.right.pressed && station.right.key === "repair")
        ports.action?.(
          repairSlot === 2
            ? "extinguish"
            : repairSlot === 1
              ? "firstAid"
              : "repair",
        );
      if (station.right.pressed && station.right.key === "missile")
        ports.action?.(wantsMissile ? "missile" : "cannon");
      player.input.fire =
        motor.fire &&
        station.right.key === "fire" &&
        station.right.contact &&
        station.left.contact;
      ports.setFire?.(player.input.fire);
      player.input.brake = false;
      cameraYaw +=
        wrapAngle(
          (sense.targetBearing ??
            state.yaw + Math.sin(game.timeS * 0.32) * 0.55) - cameraYaw,
        ) * 0.12;
      // Scope as the turret lines up, before the fire press. Keep the sight
      // through reloads; the wider exit angle avoids flicker on a moving target.
      const shouldScope = station.left.contact && sense.targetBearing !== null &&
        !sense.blocked && motor.throttle >= 0 &&
        Math.abs(wrapAngle(sense.targetBearing - state.yaw - state.turretYaw)) < (scoped ? 0.5 : 0.2);
      const scopeChanged = shouldScope !== scoped;
      scoped = shouldScope;
      if (scopeChanged || (station.left.contact && game.timeS - lastCamera >= 1 / 30)) {
        ports.follow(cameraYaw, scoped ? pendingAim : null);
        lastCamera = game.timeS;
      }
    },
    afterStep() {
      const { game } = ports,
        player = game.player;
      if (!deploymentReady || game.timeS - lastReport < 1 / 30 || !player?.combat || !player.state)
        return;
      lastReport = game.timeS;
      send("telemetry", {
        time: game.timeS,
        neurons: Array.from(controller.brain.activity),
        connectome: {
          voltage: Array.from(controller.connectome.voltage),
          rates: Array.from(controller.connectome.rates),
          spikes: Array.from(controller.connectome.spikes),
          output: controller.connectome.output,
        },
        look: wrapAngle(cameraYaw - player.state.yaw),
        gaitLeft: motor.gaitLeft ?? 0,
        gaitRight: motor.gaitRight ?? 0,
        bearing:
          sense.targetBearing === null
            ? 0
            : wrapAngle(sense.targetBearing - player.state.yaw),
        range: Number.isFinite(sense.targetDistance)
          ? sense.targetDistance
          : null,
        sugarRemaining: Math.max(0, sugarUntil - game.timeS),
        speed: player.state.speed * 3.6,
        hp: player.combat.hp,
        maxHp: player.spec.hp,
        reload: player.combat.reload.t,
        tank: player.spec.name,
        throttle: enabled ? motor.throttle : player.input.throttle,
        steer: enabled ? motor.steer : player.input.steer,
        fire: player.input.fire,
        scoped,
        shotFlash: enabled ? Math.max(0, 1 - (game.timeS - lastShotAt) / 0.18) : 0,
        arms: { left: { ...station.left }, right: { ...station.right } },
        missileAvailable: !!player.spec.gun?.shells.some(
          (shell) => shell.guided,
        ),
        missileSelected:
          !!player.spec.gun?.shells[player.combat.shellSlot ?? 0]?.guided,
        weapon:
          player.spec.gun?.shells[player.combat.shellSlot ?? 0]?.name ??
          "Cannon",
        repairRemaining: Math.max(0, kitReadyAt[0]! - game.timeS),
        target: sense.targetBearing !== null,
        sugar: sense.sugar,
        enabled,
        intent: game.result
          ? `Battle ${game.result}`
          : player.combat.destroyed
            ? "Fly tank destroyed. New specimen?"
            : enabled
              ? motor.intent
              : "Human at the controls",
        ended: !!game.result || player.combat.destroyed,
        enemies: game.tanks.filter(
          (t) => t.team !== player.team && t.combat && !t.combat.destroyed,
        ).length,
      });
    },
  };
  window.addEventListener("message", async (event: MessageEvent) => {
    if (
      event.origin !== location.origin ||
      event.source !== window.parent ||
      event.data?.source !== "fly-lab" ||
      event.data?.trialId !== trialId
    )
      return;
    switch (event.data.type) {
      case "start":
        if (started) return;
        started = true;
        try {
          await ports.start(
            typeof event.data.tankId === "string" ? event.data.tankId : "m1a1",
            typeof event.data.mapId === "string" ? event.data.mapId : "desert",
          );
          if (ports.game.phase !== "battle")
            throw new Error(
              "The arena could not finish loading. Please retry.",
            );
          cameraYaw = ports.game.player?.state?.yaw ?? 0;
          deploymentReady = true;
          send("started");
        } catch (error) {
          started = false;
          send("error", {
            message:
              error instanceof Error ? error.message : "Battle could not load",
          });
        }
        break;
      case "pause":
        runtime.paused = event.data.paused === true;
        break;
      case "sugar":
        sugarUntil = ports.game.timeS + 15;
        break;
      case "pilot":
        if (scoped) ports.releaseScope?.();
        scoped = false;
        enabled = event.data.enabled === true;
        document.documentElement.dataset.flyControl = enabled ? "auto" : "human";
        runtime.paused = false;
        ports.setFire?.(false);
        if (enabled) ports.releaseHumanControls?.();
        break;
    }
  });
  send("ready");
  return runtime;
}
