import { createConnectome, stepConnectome } from "./connectome.ts";
import type { ConnectomeState } from "./connectome.ts";
import { createBrain, stepBrain } from "./brain.ts";
import type { NeuralState } from "./brain.ts";
export interface FlySense {
  time: number;
  yaw: number;
  speed: number;
  targetBearing: number | null;
  targetDistance: number;
  blocked: boolean;
  sugar: boolean;
  obstacleLeft?: number;
  obstacleRight?: number;
}
export interface FlyMotor {
  throttle: number;
  steer: number;
  fire: boolean;
  intent: string;
  gaitLeft?: number;
  gaitRight?: number;
}
export interface FlyController {
  brain: NeuralState;
  connectome: ConnectomeState;
  sensors: Float64Array;
  stuckFor: number;
  reverseUntil: number;
  escapeSign: number;
}
export const wrapAngle = (angle: number): number =>
  Math.atan2(Math.sin(angle), Math.cos(angle));
const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
export function createFlyController(): FlyController {
  return {
    brain: createBrain(),
    connectome: createConnectome(),
    sensors: new Float64Array(8),
    stuckFor: 0,
    reverseUntil: 0,
    escapeSign: 1,
  };
}
/** Neural outputs own the motors; collision and firing interlocks remain deterministic. */
export function thinkFly(
  s: FlySense,
  out: FlyMotor,
  controller: FlyController,
  dt = 1 / 60,
): FlyMotor {
  const hasTarget = s.targetBearing !== null;
  const error = hasTarget
    ? wrapAngle(s.targetBearing! - s.yaw)
    : Math.sin(s.time * 0.19) * 0.2;
  const close = hasTarget && s.targetDistance < (s.sugar ? 70 : 125);
  controller.stuckFor =
    !close && Math.abs(s.speed) < 0.45 && s.time > 2
      ? controller.stuckFor + dt
      : 0;
  if (
    (s.blocked || controller.stuckFor > 0.65) &&
    s.time >= controller.reverseUntil
  ) {
    controller.reverseUntil = s.time + 1.15;
    controller.escapeSign =
      (s.obstacleLeft ?? 0) > (s.obstacleRight ?? 0) ? 1 : -1;
    controller.stuckFor = 0;
  }
  const reversing = s.time < controller.reverseUntil;
  const x = controller.sensors;
  x[0] = clamp(-error / 1.2, 0, 1);
  x[1] = clamp(error / 1.2, 0, 1);
  x[2] = close ? 1 : 0;
  x[3] = s.obstacleLeft ?? 0;
  x[4] = s.obstacleRight ?? 0;
  x[5] = reversing ? 1 : 0;
  x[6] = s.sugar ? 1 : 0;
  x[7] = hasTarget && Math.abs(error) < 0.65 && !s.blocked ? 1 : 0;
  stepConnectome(
    controller.connectome,
    Math.max(x[3]!, x[4]!, x[5]!),
    x[6]!,
    dt,
  );
  stepBrain(controller.brain, x, dt);
  const n = controller.brain.activity;
  out.throttle =
    clamp(n[16]! - n[19]! * 0.82) *
    (0.78 + 0.22 * controller.connectome.output);
  out.steer = clamp((n[18]! - n[17]!) * 2.4);
  out.fire = hasTarget && !reversing && n[20]! > 0.35;
  // Safety interlocks stop approaching a wall immediately, before rates settle.
  if (reversing) {
    out.throttle = -0.8;
    out.steer = controller.escapeSign * 0.85;
    out.fire = false;
  } else if (close) {
    out.throttle = 0;
  }
  // Pivot first when a target is behind the hull, rather than driving past it.
  else if (hasTarget && Math.abs(error) > 1.1) out.throttle *= 0.15;
  out.gaitLeft = clamp(n[22]!, 0, 1);
  out.gaitRight = clamp(n[23]!, 0, 1);
  out.intent = reversing
    ? "Avoiding obstacle"
    : hasTarget
      ? close
        ? "Holding firing position"
        : "Tracking target"
      : "Scanning for targets";
  return out;
}
