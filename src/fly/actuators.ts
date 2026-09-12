/** Embodied control timing: a foreleg must reach a key before its command activates. */
export type FlyKey = "rest" | "aim" | "look" | "fire" | "repair" | "missile";
export interface FlyArm {
  key: FlyKey;
  travel: number;
  contact: boolean;
  pressed: boolean;
}
export interface FlyStation {
  left: FlyArm;
  right: FlyArm;
}
export const CONTROL_POSITIONS: Record<
  FlyKey,
  readonly [number, number, number]
> = {
  rest: [0, 0, 0],
  aim: [-0.62, 0.2, 1.2],
  look: [-1, 0.25, 0.68],
  fire: [0.65, 0.2, 1.3],
  repair: [0.95, 0.2, 0.6],
  missile: [1.1, 0.2, 1.05],
};
export function createStation(): FlyStation {
  const arm = (): FlyArm => ({
    key: "rest",
    travel: 0,
    contact: false,
    pressed: false,
  });
  return { left: arm(), right: arm() };
}
export function stepArm(arm: FlyArm, key: FlyKey, dt: number): void {
  if (arm.key !== key) {
    arm.key = key;
    arm.travel = 0;
    arm.contact = false;
  }
  const wasContact = arm.contact;
  arm.travel = Math.min(1, arm.travel + Math.max(0, dt) / 0.09);
  arm.contact = key !== "rest" && arm.travel >= 1;
  arm.pressed = arm.contact && !wasContact;
}
