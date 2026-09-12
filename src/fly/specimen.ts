import * as THREE from "three";
import { CONTROL_POSITIONS } from "./actuators.ts";
import type { FlyStation } from "./actuators.ts";

export interface SpecimenSignals {
  look?: number;
  speed?: number;
  hp?: number;
  range?: number | null;
  reload?: number;
  active: boolean;
  paused: boolean;
  throttle: number;
  steer: number;
  fire: boolean;
  sugar: boolean;
  bearing: number;
  gaitLeft: number;
  gaitRight: number;
  arms: FlyStation;
}
export function createSpecimen(
  canvas: HTMLCanvasElement,
  signals: SpecimenSignals,
) {
  let surfaceVisible = true;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x101c18);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x101c18, 11, 22);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  const side = new THREE.Vector3(2.5, 2.2, 4.2),
    top = new THREE.Vector3(0.01, 8.4, 0.2);
  const cameraTarget = side.clone();
  let dirtyFrames = 24;
  camera.position.copy(side);
  camera.lookAt(0, 0.55, 0.55);
  scene.add(new THREE.HemisphereLight(0xfff8e4, 0x6c735c, 3));
  const sun = new THREE.DirectionalLight(0xfff4db, 4.2);
  sun.position.set(-3, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -4;
  sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 4;
  sun.shadow.camera.bottom = -4;
  sun.shadow.bias = -0.001;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 1.5);
  fill.position.set(4, 2, -4);
  scene.add(fill);
  const mat = (color: number, roughness = 0.65, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const chitin = mat(0x55412b, 0.44),
    abdomenMat = mat(0x917643, 0.58),
    stripe = mat(0x352d20),
    legMat = mat(0x6b522d, 0.5);
  const eyeMat = mat(0x9d271a, 0.38),
    black = mat(0x252b22, 0.6),
    ballMat = mat(0x40515f, 0.87);
  function ellipsoid(
    parent: THREE.Object3D,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    detail = 28,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, detail, 18),
      material,
    );
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function rod(
    parent: THREE.Object3D,
    a: THREE.Vector3,
    b: THREE.Vector3,
    radius: number,
    material: THREE.Material,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.65, radius, 1, 7),
      material,
    );
    parent.add(mesh);
    setRod(mesh, a, b);
    mesh.castShadow = true;
    return mesh;
  }
  const axis = new THREE.Vector3(0, 1, 0),
    scratch = new THREE.Vector3();
  function setRod(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
    scratch.copy(b).sub(a);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.y = scratch.length();
    mesh.quaternion.setFromUnitVectors(axis, scratch.normalize());
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    mat(0x101c18, 0.9),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.94;
  floor.receiveShadow = true;
  scene.add(floor);
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.27, 1.45, 0.2, 64),
    mat(0x24313d, 0.58, 0.4),
  );
  pedestal.position.y = -2.83;
  pedestal.receiveShadow = true;
  scene.add(pedestal);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.29, 0.028, 8, 96),
    black,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -2.67;
  scene.add(ring);
  const ball = new THREE.Group();
  ball.position.y = -1.24;
  scene.add(ball);
  ellipsoid(ball, ballMat, 0, 0, 0, 1.55, 1.55, 1.55, 48);
  const dots = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.023, 5, 4),
    mat(0x8092a1),
    280,
  );
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 280; i++) {
    const y = 1 - (i / 279) * 2,
      r = Math.sqrt(1 - y * y),
      phi = i * 2.39996323;
    matrix.makeTranslation(
      Math.cos(phi) * r * 1.553,
      y * 1.553,
      Math.sin(phi) * r * 1.553,
    );
    dots.setMatrixAt(i, matrix);
  }
  ball.add(dots);
  const fly = new THREE.Group();
  fly.position.set(0, 0.72, 0);
  scene.add(fly);
  ellipsoid(fly, chitin, 0, 0, 0, 0.32, 0.31, 0.49);
  const abdomen = ellipsoid(fly, abdomenMat, 0, -0.04, -0.65, 0.36, 0.29, 0.61);
  abdomen.rotation.x = 0.15;
  for (let i = 0; i < 5; i++) {
    const z = -0.34 - i * 0.19,
      w = 0.35 * Math.sqrt(Math.max(0.08, 1 - ((z + 0.63) / 0.64) ** 2));
    const band = ellipsoid(
      fly,
      stripe,
      0,
      -0.04,
      z,
      w,
      0.285 * (w / 0.36),
      0.052,
    );
    band.rotation.x = 0.15;
  }
  ellipsoid(fly, chitin, 0, 0.08, 0.52, 0.33, 0.26, 0.24);
  for (const sideSign of [-1, 1]) {
    ellipsoid(fly, eyeMat, sideSign * 0.243, 0.12, 0.59, 0.18, 0.235, 0.2);
    // Dense facets read as compound eyes, rather than smooth cartoon eyeballs.
    const facets = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.012, 5, 4),
      mat(0xb84528, 0.5),
      80,
    );
    for (let i = 0; i < 80; i++) {
      const y = 1 - (i / 79) * 2,
        r = Math.sqrt(1 - y * y),
        p = i * 2.399963;
      matrix.makeTranslation(
        sideSign * 0.243 + Math.cos(p) * r * 0.181,
        0.12 + y * 0.237,
        0.59 + Math.sin(p) * r * 0.202,
      );
      facets.setMatrixAt(i, matrix);
    }
    fly.add(facets);
    ellipsoid(fly, legMat, sideSign * 0.085, 0.11, 0.765, 0.045, 0.055, 0.09);
    rod(
      fly,
      new THREE.Vector3(sideSign * 0.085, 0.15, 0.77),
      new THREE.Vector3(sideSign * 0.19, 0.33, 0.89),
      0.007,
      black,
    );
    ellipsoid(fly, legMat, sideSign * 0.3, -0.02, -0.29, 0.045, 0.045, 0.06);
  }
  rod(
    fly,
    new THREE.Vector3(0, -0.02, 0.68),
    new THREE.Vector3(0, -0.18, 0.86),
    0.04,
    legMat,
  );
  // Fine thoracic bristles, authored deterministically.
  for (let i = 0; i < 58; i++) {
    const p = i * 2.3999,
      z = Math.sin(i * 1.9) * 0.37,
      x = Math.cos(p) * 0.27,
      y = Math.abs(Math.sin(p)) * 0.28;
    const a = new THREE.Vector3(x, y, z),
      b = new THREE.Vector3(x * 1.19, y + 0.09, z + 0.02);
    rod(fly, a, b, 0.0035, black);
  }
  const wings: THREE.Group[] = [];
  const wingMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9e5c7,
    transparent: true,
    opacity: 0.35,
    roughness: 0.25,
    metalness: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const veinMat = new THREE.LineBasicMaterial({
    color: 0x7a8065,
    transparent: true,
    opacity: 0.55,
  });
  for (const sign of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(sign * 0.21, 0.2, -0.06);
    wing.rotation.y = sign * 0.25;
    fly.add(wing);
    wings.push(wing);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(
      sign * 0.36,
      -0.12,
      sign * 0.92,
      -0.89,
      sign * 0.74,
      -1.43,
    );
    shape.bezierCurveTo(sign * 0.58, -1.74, sign * 0.19, -1.22, 0, 0);
    const surface = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), wingMat);
    surface.rotation.x = Math.PI / 2;
    wing.add(surface);
    const points = shape
      .getPoints(38)
      .map((p) => new THREE.Vector3(p.x, 0.004, p.y));
    wing.add(
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), veinMat),
    );
    for (let v = 1; v <= 4; v++) {
      const pts = [
        new THREE.Vector3(0, 0.007, 0),
        new THREE.Vector3(sign * (0.12 + v * 0.08), 0.009, -0.6),
        new THREE.Vector3(sign * (0.28 + v * 0.1), 0.007, -1.34 + v * 0.075),
      ];
      wing.add(
        new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), veinMat),
      );
    }
    for (let v = 0; v < 3; v++) {
      const z = -0.55 - v * 0.24;
      wing.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(sign * 0.15, 0.009, z),
            new THREE.Vector3(sign * 0.6, 0.009, z - 0.11),
          ]),
          veinMat,
        ),
      );
    }
  }
  const legs: {
    side: number;
    index: number;
    upper: THREE.Mesh;
    lower: THREE.Mesh;
    foot: THREE.Mesh;
    hip: THREE.Vector3;
    knee: THREE.Vector3;
    toe: THREE.Vector3;
    tip: THREE.Vector3;
  }[] = [];
  for (const sign of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const hip = new THREE.Vector3(sign * 0.23, -0.07, 0.32 - i * 0.32),
        knee = new THREE.Vector3(sign * 0.66, -0.22, 0.55 - i * 0.55),
        toe = new THREE.Vector3(sign * 0.89, -0.62, 0.8 - i * 0.72),
        tip = toe.clone().add(new THREE.Vector3(sign * 0.13, -0.03, 0.1));
      legs.push({
        side: sign,
        index: i,
        upper: rod(fly, hip, knee, 0.025, legMat),
        lower: rod(fly, knee, toe, 0.016, legMat),
        foot: rod(fly, toe, tip, 0.009, black),
        hip,
        knee,
        toe,
        tip,
      });
      ellipsoid(fly, chitin, hip.x, hip.y, hip.z, 0.04, 0.04, 0.04);
    }
  // A miniature tanker's helmet with headset, rim and microphone.
  const helmetMat = mat(0x3d4b32, 0.73);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.37, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    helmetMat,
  );
  helmet.position.set(0, 0.34, 0.5);
  helmet.scale.set(1, 0.7, 0.92);
  helmet.castShadow = true;
  fly.add(helmet);
  const brim = new THREE.Mesh(
    new THREE.TorusGeometry(0.367, 0.022, 8, 40),
    helmetMat,
  );
  brim.rotation.x = Math.PI / 2;
  brim.position.set(0, 0.34, 0.5);
  brim.scale.y = 0.92;
  fly.add(brim);
  for (const sign of [-1, 1])
    ellipsoid(fly, black, sign * 0.345, 0.12, 0.47, 0.055, 0.115, 0.11);
  rod(
    fly,
    new THREE.Vector3(0.35, 0.06, 0.47),
    new THREE.Vector3(0.24, -0.09, 0.83),
    0.012,
    black,
  );
  ellipsoid(fly, black, 0.24, -0.09, 0.83, 0.033, 0.025, 0.04);
  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.055, 0.012),
    mat(0xd4ab57),
  );
  badge.position.set(0, 0.45, 0.79);
  fly.add(badge);
  // The console and its actual actuator destinations share one coordinate table.
  const consoleGroup = new THREE.Group();
  scene.add(consoleGroup);
  const consoleBase = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.22, 1.35),
    mat(0x394437, 0.72, 0.3),
  );
  consoleBase.position.set(0, 0.04, 1.12);
  consoleBase.castShadow = true;
  consoleBase.receiveShadow = true;
  consoleGroup.add(consoleBase);
  for (const x of [-1.15, 1.15])
    rod(
      scene,
      new THREE.Vector3(x, -2.6, 0.8),
      new THREE.Vector3(x, 0.05, 0.8),
      0.035,
      black,
    );
  const buttons = new Map<
    string,
    THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  >();
  function controlLabel(text: string, x: number, z: number) {
    const label = document.createElement("canvas");
    label.width = 256;
    label.height = 64;
    const ctx = label.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = "#b6cbd9";
    ctx.font = "bold 27px Monument, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, 128, 42);
    const texture = new THREE.CanvasTexture(label);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.09), material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(x, 0.157, z);
    consoleGroup.add(plane);
  }
  for (const key of ["fire", "missile", "repair", "aim", "look"] as const) {
    const p = CONTROL_POSITIONS[key];
    const color =
      key === "fire"
        ? 0xc75438
        : key === "missile"
          ? 0xc59136
          : key === "repair"
            ? 0x5d9576
            : 0x436780;
    const button = new THREE.Mesh(
      new THREE.BoxGeometry(
        key === "aim" ? 0.48 : 0.23,
        0.07,
        key === "aim" ? 0.33 : 0.2,
      ),
      mat(color, 0.45, 0.25),
    );
    button.position.set(p[0], p[1] - 0.02, p[2]);
    button.castShadow = true;
    consoleGroup.add(button);
    buttons.set(key, button);
    controlLabel(key.toUpperCase(), p[0], p[2] + 0.16);
  }
  const stick = rod(
    consoleGroup,
    new THREE.Vector3(-1, 0.23, 0.68),
    new THREE.Vector3(-1, 0.38, 0.68),
    0.02,
    black,
  );
  ellipsoid(consoleGroup, black, -1, 0.38, 0.68, 0.055, 0.045, 0.055);
  // Armored cockpit: raised instrument binnacle, fasteners, wheel and live scope.
  const steel = mat(0x4d5743, 0.73, 0.28),
    rubber = mat(0x101817, 0.86),
    brass = mat(0xc5a565, 0.48, 0.35);
  function box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material = steel,
  ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    consoleGroup.add(m);
    return m;
  }
  box(2.75, 0.22, 0.42, 0, 0.27, 1.64);
  for (const sign of [-1, 1]) {
    const cheek = box(0.12, 0.38, 1.36, sign * 1.42, 0.2, 1.12);
    cheek.rotation.z = sign * -0.12;
    box(0.18, 0.035, 1.45, sign * 1.42, 0.4, 1.12, rubber);
    for (let i = 0; i < 7; i++) {
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.015, 6),
        brass,
      );
      bolt.position.set(sign * 1.42, 0.425, 0.5 + i * 0.2);
      consoleGroup.add(bolt);
    }
    rod(
      consoleGroup,
      new THREE.Vector3(sign * 1.18, 0.24, 1.42),
      new THREE.Vector3(sign * 1.18, 0.42, 1.42),
      0.018,
      brass,
    );
    for (let i = 0; i < 4; i++)
      box(0.035, 0.015, 0.21, sign * 0.96 + i * 0.07, 0.392, 1.65, rubber);
  }
  for (const z of [0.55, 1.74])
    for (const x of [-1.25, -0.6, 0, 0.6, 1.25]) {
      const screw = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.014, 6),
        brass,
      );
      screw.position.set(x, z > 1.7 ? 0.391 : 0.16, z);
      consoleGroup.add(screw);
    }
  // Wheel local XY plane is tilted toward the fly. Middle legs grip its rim.
  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(0, 0.39, 1.13);
  steeringWheel.rotation.x = -0.6;
  consoleGroup.add(steeringWheel);
  const wheelRotor = new THREE.Group();
  steeringWheel.add(wheelRotor);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.038, 10, 48),
    rubber,
  );
  wheelRotor.add(rim);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    rod(
      wheelRotor,
      new THREE.Vector3(),
      new THREE.Vector3(Math.cos(a) * 0.31, Math.sin(a) * 0.31, 0),
      0.025,
      steel,
    );
  }
  ellipsoid(wheelRotor, brass, 0, 0, 0, 0.078, 0.078, 0.046);
  const centerStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.065, 0.065),
    brass,
  );
  centerStripe.position.y = 0.34;
  wheelRotor.add(centerStripe);
  rod(
    consoleGroup,
    new THREE.Vector3(0, 0.1, 1.33),
    steeringWheel.position,
    0.055,
    steel,
  );
  for (const sign of [-1, 1]) {
    const guard = box(0.035, 0.09, 0.32, 0.65 + sign * 0.15, 0.24, 1.3, brass);
    guard.rotation.z = sign * 0.12;
  }
  const displayCanvas = document.createElement("canvas");
  displayCanvas.width = 768;
  displayCanvas.height = 256;
  const displayCtx = displayCanvas.getContext("2d")!;
  const displayTexture = new THREE.CanvasTexture(displayCanvas);
  displayTexture.colorSpace = THREE.SRGBColorSpace;
  box(1.65, 0.045, 0.4, 0, 0.398, 1.64, rubber);
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 0.34),
    new THREE.MeshBasicMaterial({ map: displayTexture }),
  );
  display.rotation.x = -Math.PI / 2;
  display.position.set(0, 0.424, 1.64);
  consoleGroup.add(display);
  let lastDisplay = -1;
  function updateDisplay(now: number) {
    if (now - lastDisplay < 100) return;
    lastDisplay = now;
    const c = displayCtx;
    c.fillStyle = "#071811";
    c.fillRect(0, 0, 768, 256);
    c.strokeStyle = "#315340";
    c.lineWidth = 2;
    for (let x = 0; x < 768; x += 32) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 256);
      c.stroke();
    }
    for (let y = 0; y < 256; y += 32) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(768, y);
      c.stroke();
    }
    c.fillStyle = "#a2cf9b";
    c.font = "bold 24px Monument, Arial, sans-serif";
    c.fillText("COMMANDER  /  FLY-01", 20, 31);
    for (const [x, value, caption] of [
      [103, Math.abs(signals.speed ?? 0) / 60, "KM/H"],
      [312, signals.hp ?? 1, "ARMOR"],
    ] as const) {
      c.strokeStyle = "#70946b";
      c.lineWidth = 5;
      c.beginPath();
      c.arc(x, 144, 68, Math.PI * 0.7, Math.PI * 2.3);
      c.stroke();
      const a = Math.PI * 0.7 + Math.min(1, value) * Math.PI * 1.6;
      c.strokeStyle = "#e7b65f";
      c.beginPath();
      c.moveTo(x, 144);
      c.lineTo(x + Math.cos(a) * 58, 144 + Math.sin(a) * 58);
      c.stroke();
      c.fillStyle = "#b9dab1";
      c.font = "20px Monument, Arial, sans-serif";
      c.fillText(caption, x - 30, 236);
    }
    c.strokeStyle = "#71946d";
    c.lineWidth = 2;
    for (const r of [28, 57, 86]) {
      c.beginPath();
      c.arc(574, 140, r, 0, Math.PI * 2);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(486, 140);
    c.lineTo(662, 140);
    c.moveTo(574, 52);
    c.lineTo(574, 228);
    c.stroke();
    if (signals.range != null) {
      const r = Math.min(80, signals.range * 0.25);
      c.fillStyle = "#f3c678";
      c.fillRect(
        571 + Math.sin(signals.bearing) * r,
        137 - Math.cos(signals.bearing) * r,
        7,
        7,
      );
    }
    c.font = "18px Monument, Arial, sans-serif";
    c.fillStyle = "#b9dab1";
    c.fillText(signals.active ? "TRACK" : "STBY", 696, 73);
    c.fillText((signals.reload ?? 0) > 0 ? "LOAD" : "READY", 690, 135);
    displayTexture.needsUpdate = true;
  }
  const wheelGrip = new THREE.Vector3();
  let drag = false,
    px = 0,
    py = 0,
    azimuth = Math.atan2(side.x, side.z),
    elevation = 0.39,
    distance = side.length();
  const updateOrbit = () => {
    dirtyFrames = 24;
    cameraTarget.set(
      Math.sin(azimuth) * Math.cos(elevation) * distance,
      Math.sin(elevation) * distance,
      Math.cos(azimuth) * Math.cos(elevation) * distance,
    );
  };
  const down = (e: PointerEvent) => {
    drag = true;
    px = e.clientX;
    py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    azimuth -= (e.clientX - px) * 0.009;
    elevation = THREE.MathUtils.clamp(
      elevation + (e.clientY - py) * 0.007,
      0.12,
      1.45,
    );
    px = e.clientX;
    py = e.clientY;
    updateOrbit();
  };
  const up = () => {
    drag = false;
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    distance = THREE.MathUtils.clamp(distance + e.deltaY * 0.005, 4.8, 11);
    updateOrbit();
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  let resizeFrame = 0;
  const resize = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      surfaceVisible = w > 0 && h > 0;
      if (!surfaceVisible) return;
      dirtyFrames = 24;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = camera.aspect > 2.3 ? 26 : 34;
      camera.updateProjectionMatrix();
    });
  });
  resize.observe(canvas);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let smoothThrottle = 0,
    smoothSteer = 0;
  const reach = new THREE.Vector3();
  let last = 0,
    phase = 0,
    frame = 0,
    wasActive = false,
    wasPaused = false;
  function animate(now: number) {
    frame = requestAnimationFrame(animate);
    if (
      document.hidden ||
      !surfaceVisible ||
      now - last < (reduced ? 100 : 1000 / 30)
    )
      return;
    if (signals.active !== wasActive || signals.paused !== wasPaused)
      dirtyFrames = 24;
    wasActive = signals.active;
    wasPaused = signals.paused;
    if ((!signals.active || signals.paused) && dirtyFrames <= 0) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    dirtyFrames = Math.max(0, dirtyFrames - 1);
    const walking = signals.active && !signals.paused && !reduced;
    smoothThrottle +=
      (signals.throttle - smoothThrottle) * (1 - Math.exp(-dt * 24));
    smoothSteer += (signals.steer - smoothSteer) * (1 - Math.exp(-dt * 24));
    const pace = walking
      ? Math.max(Math.abs(smoothThrottle), Math.abs(smoothSteer) * 0.65)
      : 0;
    phase += dt * (pace * 19 + (walking ? 0.5 : 0));
    if (walking) {
      ball.rotation.x -= signals.throttle * dt * 0.8;
      ball.rotation.z += signals.steer * dt * 0.45;
    }
    fly.position.y = 0.72 + (walking ? Math.sin(phase * 2) * 0.009 : 0);
    fly.rotation.y = smoothSteer * 0.14;
    helmet.rotation.z = walking ? Math.sin(phase) * pace * 0.025 : 0;
    wheelRotor.rotation.z = -smoothSteer * 1.15;
    steeringWheel.updateWorldMatrix(true, true);
    fly.updateWorldMatrix(true, false);
    updateDisplay(now);
    for (const l of legs) {
      const step = phase + l.index * Math.PI + (l.side === 1 ? Math.PI : 0);
      const stride =
          Math.sin(step) * pace * 0.23 * (smoothThrottle < 0 ? -1 : 1),
        lift = Math.max(0, Math.cos(step)) * pace * 0.13;
      l.knee.set(
        l.side * (0.65 + lift * 0.2),
        -0.2 + lift * 0.3,
        0.55 - l.index * 0.55 + stride * 0.5,
      );
      l.toe.set(l.side * 0.87, -0.62 + lift, 0.8 - l.index * 0.72 + stride);
      l.toe.y =
        -1.24 +
        Math.sqrt(Math.max(0.1, 1.55 ** 2 - l.toe.x ** 2 - l.toe.z ** 2)) -
        0.72 +
        lift;
      l.tip.copy(l.toe);
      l.tip.x += l.side * 0.12;
      l.tip.z += 0.09;
      l.tip.y -= 0.035;
      if (l.index === 0 && signals.active) {
        const arm = l.side < 0 ? signals.arms.left : signals.arms.right;
        if (arm.key !== "rest") {
          const p = CONTROL_POSITIONS[arm.key];
          reach.set(p[0], p[1] - 0.72 + (arm.contact ? -0.04 : 0.12), p[2]);
          l.tip.lerp(reach, Math.min(1, 0.5 + arm.travel * 0.5));
          l.toe.copy(l.tip);
          l.toe.z -= 0.07;
          l.toe.y += 0.04;
          l.knee.set(l.side * 0.48, -0.05, 0.65);
        }
      }
      if (l.index === 1) {
        wheelGrip.set(l.side * 0.32, 0, 0);
        wheelRotor.localToWorld(wheelGrip);
        fly.worldToLocal(wheelGrip);
        l.tip.copy(wheelGrip);
        l.toe.copy(l.tip);
        l.toe.z -= 0.05;
        l.toe.y += 0.03;
        l.knee.set(l.side * 0.53, -0.02, 0.35);
      }
      setRod(l.upper, l.hip, l.knee);
      setRod(l.lower, l.knee, l.toe);
      setRod(l.foot, l.toe, l.tip);
    }
    wings.forEach((wing, i) => {
      wing.rotation.z =
        (i === 0 ? -1 : 1) *
        (walking && signals.sugar ? 0.11 + Math.sin(now * 0.09) * 0.1 : 0.025);
    });
    for (const [key, button] of buttons) {
      const arm =
        key === "aim" || key === "look"
          ? signals.arms.left
          : signals.arms.right;
      const pressed =
        signals.active && !signals.paused && arm.key === key && arm.contact;
      button.position.y =
        CONTROL_POSITIONS[key as keyof typeof CONTROL_POSITIONS][1] -
        0.02 -
        (pressed ? 0.035 : 0);
      button.material.emissive.copy(button.material.color);
      button.material.emissiveIntensity = pressed ? 0.8 : 0;
    }
    stick.rotation.z = (signals.look ?? 0) * 0.4;
    camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 12));
    camera.lookAt(0, 0.55, 0.55);
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(animate);
  return {
    view(mode: string) {
      dirtyFrames = 24;
      cameraTarget.copy(mode === "top" ? top : side);
    },
    dispose() {
      cancelAnimationFrame(frame);
      resize.disconnect();
      cancelAnimationFrame(resizeFrame);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material];
          materials.forEach((m) => {
            if ("map" in m && m.map instanceof THREE.Texture) m.map.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
    },
  };
}
