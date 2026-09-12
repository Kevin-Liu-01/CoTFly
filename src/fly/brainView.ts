import * as THREE from "three";
import anatomy from "./data/anatomy.json" with { type: "json" };
import { CELLS, CONNECTIONS } from "./connectome.ts";
export interface BrainTelemetry {
  voltage: number[];
  rates: number[];
  spikes: number[];
  output: number;
}
export function createBrainView(
  canvas: HTMLCanvasElement,
  historyCanvas: HTMLCanvasElement,
) {
  const $ = (id: string) => document.getElementById(id)!;
  let surfaceVisible = true;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene(),
    group = new THREE.Group();
  scene.add(group);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
  camera.position.set(0, 0.1, 5.8);
  const transform = (p: number[]) =>
    new THREE.Vector3(
      (p[0]! - 52000) / 18000,
      -(p[2]! - 26500) / 18000,
      (p[1]! - 28000) / 18000,
    );
  const positions = CELLS.map((n) => transform(n.position));
  function points(pts: THREE.Vector3[], material: THREE.PointsMaterial) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mesh = new THREE.Points(geo, material);
    group.add(mesh);
    return mesh;
  }
  points(
    anatomy.context.map(transform),
    new THREE.PointsMaterial({
      color: "#557b8b",
      size: 0.011,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  // All neurites share one point draw; each contiguous range belongs to a cell.
  const fiberOffsets = new Uint32Array(CELLS.length + 1);
  const fiberPoints: THREE.Vector3[] = [];
  for (let i = 0; i < CELLS.length; i++) {
    fiberOffsets[i] = fiberPoints.length;
    for (const p of anatomy.neurites[i]!) fiberPoints.push(transform(p));
  }
  fiberOffsets[CELLS.length] = fiberPoints.length;
  const fiberColors = new Float32Array(fiberPoints.length * 3);
  const fibers = points(
    fiberPoints,
    new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.012,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  fibers.geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(fiberColors, 3).setUsage(THREE.DynamicDrawUsage),
  );
  const connectionCounts = new Uint16Array(CELLS.length);
  for (const e of CONNECTIONS) {
    connectionCounts[e.from]++;
    connectionCounts[e.to]++;
  }
  const soma = points(
    positions,
    new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.047,
      transparent: true,
      depthWrite: false,
    }),
  );
  const colors = new Float32Array(CELLS.length * 3);
  soma.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const linkPositions: number[] = [];
  for (const e of CONNECTIONS)
    linkPositions.push(
      ...positions[e.from]!.toArray(),
      ...positions[e.to]!.toArray(),
    );
  const links = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(linkPositions, 3),
    ),
    new THREE.LineBasicMaterial({
      color: "#9cb4d0",
      transparent: true,
      opacity: 0.028,
      depthWrite: false,
    }),
  );
  group.add(links);
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 12, 8),
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    }),
  );
  group.add(marker);
  let followActivity = true,
    lastRank = -1;
  const ranked = Array.from({ length: CELLS.length }, (_, i) => i);
  let selected = 0,
    dirty = true,
    lastTime = -1;
  let data: BrainTelemetry = {
    voltage: Array(CELLS.length).fill(-65),
    rates: [],
    spikes: [],
    output: 0,
  };
  const previous = new Uint32Array(CELLS.length),
    bursts = new Float32Array(CELLS.length);
  const picker = $("cell-select") as unknown as HTMLSelectElement;
  function inspect() {
    const cell = CELLS[selected]!;
    const active = (data.rates[selected] ?? 0) >= 1;
    marker.visible = active;
    $("neuron-name").textContent = active ? cell.instance : "Awaiting spikes";
    $("neuron-group").textContent = active
      ? cell.group === "mAL"
        ? "mAL · INHIBITORY"
        : "pC1 · P1-RELATED"
      : "NO ACTIVE CELLS";
    $("neuron-index").textContent = active ? `BODY ${cell.id}` : "—";
    $("neuron-value").textContent = (data.rates[selected] ?? 0).toFixed(1);
    $("neuron-bar").style.width =
      `${Math.min(100, (data.rates[selected] ?? 0) * 2)}%`;
    $("neuron-description").textContent = active
      ? `${(data.voltage[selected] ?? -65).toFixed(1)} mV · ${data.spikes[selected] ?? 0} spikes · ${connectionCounts[selected]} links`
      : "Live firing cells will appear here.";
    $("brain-output").textContent = `${Math.round(data.output * 100)}%`;
    marker.position.copy(positions[selected]!);
    picker.value = followActivity ? "auto" : String(selected);
    dirty = true;
  }
  const autoOption = document.createElement("option");
  autoOption.value = "auto";
  autoOption.textContent = "AUTO · Most active";
  picker.append(autoOption);
  function refreshActive(time: number, force = false) {
    const silent = (data.rates[selected] ?? 0) < 1;
    if (!force && !silent && time - lastRank < 0.5) return;
    ranked.sort((a, b) => (data.rates[b] ?? 0) - (data.rates[a] ?? 0) || a - b);
    const strongest = ranked[0]!;
    if (silent) followActivity = true;
    // Hysteresis keeps the inspector readable while following genuine activity.
    if (
      followActivity &&
      (silent ||
        (data.rates[strongest] ?? 0) > (data.rates[selected] ?? 0) * 1.2)
    )
      selected = strongest;
    if (!force && document.activeElement === picker) return;
    lastRank = time;
    const active = ranked.filter((i) => (data.rates[i] ?? 0) >= 1).slice(0, 8);
    if (!followActivity && !active.includes(selected)) active.push(selected);
    const options = active.map((i) => {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = `${CELLS[i]!.instance} · ${(data.rates[i] ?? 0).toFixed(0)} Hz`;
      return option;
    });
    autoOption.textContent = active.length
      ? "AUTO · Most active"
      : "Waiting for activity";
    picker.replaceChildren(autoOption, ...options);
    picker.value = followActivity ? "auto" : String(selected);
  }
  const select = () => {
    followActivity = picker.value === "auto";
    if (!followActivity) selected = Number(picker.value);
    refreshActive(lastRank, true);
    inspect();
  };
  picker.addEventListener("change", select);
  historyCanvas.width = 180;
  historyCanvas.height = CELLS.length;
  const ctx = historyCanvas.getContext("2d")!;
  let drag = false,
    moved = false,
    x = 0,
    y = 0;
  const ray = new THREE.Raycaster();
  ray.params.Points!.threshold = 0.065;
  const pointer = new THREE.Vector2();
  const down = (e: PointerEvent) => {
    drag = true;
    moved = false;
    x = e.clientX;
    y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - x,
      dy = e.clientY - y;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    group.rotation.y += dx * 0.006;
    group.rotation.x = THREE.MathUtils.clamp(
      group.rotation.x + dy * 0.006,
      -1.2,
      1.2,
    );
    x = e.clientX;
    y = e.clientY;
    dirty = true;
  };
  const up = (e: PointerEvent) => {
    if (!moved) {
      const r = canvas.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObject(soma)[0];
      if (hit?.index !== undefined) {
        selected = hit.index;
        followActivity = false;
        refreshActive(lastRank, true);
        inspect();
      }
    }
    drag = false;
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    camera.position.z = THREE.MathUtils.clamp(
      camera.position.z + e.deltaY * 0.003,
      3.2,
      9,
    );
    dirty = true;
  };
  const key = (e: KeyboardEvent) => {
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      group.rotation.y +=
        e.key === "ArrowLeft" ? -0.12 : e.key === "ArrowRight" ? 0.12 : 0;
      group.rotation.x +=
        e.key === "ArrowUp" ? -0.12 : e.key === "ArrowDown" ? 0.12 : 0;
      dirty = true;
    }
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("keydown", key);
  let resizeFrame = 0;
  const resize = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      surfaceVisible = w > 0 && h > 0;
      if (!surfaceVisible) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = Math.max(5.8, 5.8 / camera.aspect);
      camera.updateProjectionMatrix();
      dirty = true;
    });
  });
  resize.observe(canvas);
  let frame = 0;
  function render() {
    frame = requestAnimationFrame(render);
    if (!dirty || document.hidden || !surfaceVisible) return;
    renderer.render(scene, camera);
    dirty = false;
  }
  render();
  const color = new THREE.Color();
  const api = {
    update(next: BrainTelemetry, time: number) {
      data = next;
      refreshActive(time);
      for (let i = 0; i < CELLS.length; i++) {
        const spike = (data.spikes[i] ?? 0) > previous[i]!;
        bursts[i] = spike ? 1 : bursts[i]! * 0.72;
        color
          .set(CELLS[i]!.group === "mAL" ? "#9c9bff" : "#ffbf59")
          .multiplyScalar(0.38 + bursts[i]! * 0.9);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        const brightness = 0.1 + bursts[i]! * 0.55;
        for (let j = fiberOffsets[i]!; j < fiberOffsets[i + 1]!; j++) {
          fiberColors[j * 3] = color.r * brightness;
          fiberColors[j * 3 + 1] = color.g * brightness;
          fiberColors[j * 3 + 2] = color.b * brightness;
        }
      }
      soma.geometry.getAttribute("color").needsUpdate = true;
      fibers.geometry.getAttribute("color").needsUpdate = true;
      const bin = Math.floor(time * 30);
      if (bin > lastTime) {
        const shift = Math.min(180, bin - lastTime);
        ctx.drawImage(historyCanvas, -shift, 0);
        ctx.fillStyle = "#0b131c";
        ctx.fillRect(180 - shift, 0, shift, CELLS.length);
        for (let i = 0; i < CELLS.length; i++)
          if ((data.spikes[i] ?? 0) > previous[i]!) {
            ctx.fillStyle = CELLS[i]!.group === "mAL" ? "#aaa4ff" : "#f6b44d";
            ctx.fillRect(179, i, 1, 1);
          }
        for (let i = 0; i < CELLS.length; i++)
          previous[i] = data.spikes[i] ?? 0;
        lastTime = bin;
      }
      inspect();
    },
    reset() {
      followActivity = true;
      lastRank = -1;
      previous.fill(0);
      bursts.fill(0);
      lastTime = -1;
      ctx.clearRect(0, 0, 180, CELLS.length);
      api.update(
        {
          voltage: Array(CELLS.length).fill(-65),
          rates: [],
          spikes: [],
          output: 0,
        },
        0,
      );
    },
    dispose() {
      cancelAnimationFrame(frame);
      resize.disconnect();
      cancelAnimationFrame(resizeFrame);
      picker.removeEventListener("change", select);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("keydown", key);
      scene.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Points ||
          o instanceof THREE.LineSegments
        ) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
    },
  };
  api.reset();
  return api;
}
