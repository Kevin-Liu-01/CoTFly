import { createTrialSetup } from './trialSetup.ts';
import type { TrialSelection } from './trialSetup.ts';
import { createSpecimen } from "./specimen.ts";
import type { SpecimenSignals } from "./specimen.ts";
import { createStation } from "./actuators.ts";
import { createBrainView } from "./brainView.ts";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const signals: SpecimenSignals = {
  active: false,
  paused: false,
  throttle: 0,
  steer: 0,
  fire: false,
  sugar: false,
  bearing: 0,
  gaitLeft: 0,
  gaitRight: 0,
  arms: createStation(),
};
const brain = createBrainView(
  document.getElementById("brain-network") as HTMLCanvasElement,
  $<HTMLCanvasElement>("brain-history"),
);
let specimen: ReturnType<typeof createSpecimen> | null = null;
try {
  specimen = createSpecimen($<HTMLCanvasElement>("specimen"), signals);
} catch {
  $("specimen-status").textContent = "3D UNAVAILABLE";
}
const game = $<HTMLIFrameElement>("game");
let running = false,
  human = false,
  generation = 1,
  hasTelemetry = false,
  errorTimer = 0;
const history: number[] = [];
let trial: TrialSelection;
let loadingProgress = 0;
let trialPending = false;
const setup = createTrialSetup(selection => { trial = selection; launch(); });
trial = setup.selection();
function progress(fraction: number, message?: string) {
  loadingProgress = Math.max(loadingProgress, Math.min(1, fraction));
  const percent = Math.round(loadingProgress * 100);
  $("trial-progress").setAttribute("aria-valuenow", String(percent));
  $("trial-progress-fill").style.transform = `scaleX(${loadingProgress})`;
  $("loading-percent").textContent = `${percent}%`;
  if (message) $("loading-text").textContent = message;
  for (const [id, threshold] of [["runtime", 0], ["world", .24], ["pilot", .68]] as const)
    $("load-stage-" + id).classList.toggle("current", loadingProgress >= threshold);
}
const command = (type: string, payload: object = {}) =>
  game.contentWindow?.postMessage(
    { source: "fly-lab", trialId: String(generation), type, ...payload },
    location.origin,
  );
const label = (id: string, text: string) => {
  $(id).querySelector("span")!.textContent = text;
  $(id).setAttribute("aria-label", text);
  $(id).title = text;
};
function showPanel(panel: string) {
  document.body.dataset.panel = panel;
  for (const tab of document.querySelectorAll<HTMLButtonElement>(
    ".panel-switch [data-panel]",
  ))
    tab.setAttribute("aria-pressed", String(tab.dataset.panel === panel));
}
function status(text: string) {
  $("session-state").textContent = text;
}
function buttons(disabled: boolean) {
  for (const id of ["pause", "sugar", "takeover", "restart"])
    $<HTMLButtonElement>(id).disabled = disabled;
}
function resetTelemetry() {
  signals.active = false;
  signals.paused = false;
  signals.sugar = false;
  signals.fire = false;
  signals.shotFlash = 0;
  $("pulse").classList.remove("active");
  signals.throttle = 0;
  signals.steer = 0;
  signals.arms = createStation();
  brain.reset();
  history.length = 0;
  for (const [id, text] of Object.entries({
    timer: "00:00",
    speed: "0.0",
    health: "—",
    "health-unit": "HP",
    reload: "Standby",
    "fire-state": "Awaiting deployment",
    "target-range": "—",
    "target-state": "No visual contact",
    throttle: "0%",
    steer: "0%",
    intent: "Awaiting deployment",
    "repair-status": "Ready",
    "missile-status": "—",
  }))
    $(id).textContent = text;
  for (const id of ["throttle-bar", "steer-bar", "health-bar"])
    $(id).style.width = "0%";
  $("speed-trace").setAttribute("d", "M0 34H180");
  $("sugar-pop").classList.remove("show");
}
function launch() {
  clearTimeout(errorTimer);
  trialPending = true;
  loadingProgress = 0;
  progress(0, "Connecting battle systems…");
  $("loading-title").textContent = trial.tank.name;
  $("loading-map-name").textContent = trial.map.name;
  $<HTMLImageElement>("loading-map").src = trial.map.image;
  $<HTMLImageElement>("loading-tank").src = trial.tank.image;
  $("tank-label").textContent = `${trial.tank.name} · ${trial.map.name}`;
  $<HTMLButtonElement>("configure-trial").disabled = true;
  showPanel("battle");
  running = false;
  human = false;
  hasTelemetry = false;
  resetTelemetry();
  label("takeover", "Take control");
  label("pause", "Pause");
  $("arena-idle").hidden = true;
  $("loading").hidden = false;
  $("retry").hidden = true;
  game.hidden = false;
  game.style.visibility = "hidden";
  $("arena-tag").hidden = true;
  $("loading-text").textContent = "Connecting battle systems…";
  $("arena-status").textContent = "LOADING";
  $("brain-status").textContent = "STANDBY";
  $("specimen-status").textContent = "PREPARING";
  status("PREPARING BATTLE");
  buttons(true);
  game.src = `/game.html?fly-agent=1&trial=${++generation}`;
  $("specimen-id").textContent = String(generation - 1).padStart(3, "0");
  errorTimer = window.setTimeout(() => {
    if (!hasTelemetry) {
      $("loading-text").textContent =
        "Loading is taking longer than expected. Retry deployment below.";
      $("retry").hidden = false;
    }
  }, 90000);
}
$("wake").addEventListener("click", () => setup.open());
$("configure-trial").addEventListener("click", () => setup.open());
function cancelTrial() {
  running = false;
  hasTelemetry = false;
  resetTelemetry();
  buttons(true);
  clearTimeout(errorTimer);
  trialPending = false;
  game.src = "about:blank";
  game.hidden = true;
  $("loading").hidden = true;
  $("arena-idle").hidden = false;
  $<HTMLButtonElement>("configure-trial").disabled = false;
  for (const id of ["arena-status", "brain-status", "specimen-status"]) $(id).textContent = "STANDBY";
  status("READY TO DEPLOY");
}
$("cancel-trial").addEventListener("click", cancelTrial);
$("retry").addEventListener("click", launch);
$("restart").addEventListener("click", () => {
  launch();
});
$("pause").addEventListener("click", () => {
  signals.paused = !signals.paused;
  command("pause", { paused: signals.paused });
  label("pause", signals.paused ? "Resume" : "Pause");
  $("pause")
    .querySelector("use")!
    .setAttribute("href", signals.paused ? "#i-play" : "#i-pause");
  status(signals.paused ? "PAUSED" : human ? "HUMAN CONTROL" : "FLY CONTROL");
  for (const id of ["specimen-status", "arena-status", "brain-status"])
    $(id).textContent = signals.paused ? "PAUSED" : human ? "HUMAN" : "LIVE";
});
$("sugar").addEventListener("click", () => {
  command("sugar");
});
$("takeover").addEventListener("click", () => {
  human = !human;
  signals.paused = false;
  command("pilot", { enabled: !human });
  label("takeover", human ? "Fly control" : "Take control");
  label("pause", "Pause");
  status(human ? "HUMAN CONTROL" : "FLY CONTROL");
  $("brain-status").textContent = human ? "BYPASSED" : "LIVE";
  $("specimen-status").textContent = human ? "OBSERVER" : "ACTIVE";
  $("arena-status").textContent = "LIVE";
  $("arena-tag").lastChild!.textContent = human
    ? " HUMAN CONTROL"
    : " FLY CONTROL";
  $<HTMLButtonElement>("sugar").disabled = human;
  if (human) {
    showPanel("battle");
    $("intent").textContent = "WASD move · Mouse aim · Click fire";
    game.focus();
  }
});
$("vision").addEventListener("click", () => {
  $("eye-grid").hidden = !$("eye-grid").hidden;
  $("vision").setAttribute("aria-pressed", String(!$("eye-grid").hidden));
});
$("expand").addEventListener("click", () => {
  const expanded = document.body.classList.toggle("expanded");
  $("expand").setAttribute("aria-pressed", String(expanded));
  $("expand").setAttribute(
    "aria-label",
    expanded ? "Restore battlefield" : "Expand battlefield",
  );
  window.dispatchEvent(new Event("resize"));
});
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-view]",
))
  button.addEventListener("click", () => {
    specimen?.view(button.dataset.view!);
    for (const b of document.querySelectorAll("[data-view]")) {
      b.classList.toggle("selected", b === button);
      b.setAttribute("aria-pressed", String(b === button));
    }
  });
const about = $<HTMLDialogElement>("about");
for (const id of ["about-open", "sources-open"])
  $(id).addEventListener("click", () => about.showModal());
$("about-close").addEventListener("click", () => about.close());
about.addEventListener("click", (e) => {
  if (e.target === about) {
    const r = about.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      about.close();
  }
});
window.addEventListener("message", (event) => {
  if (
    event.origin !== location.origin ||
    event.source !== game.contentWindow ||
    event.data?.source !== "fly-arena"
  )
    return;
  const d = event.data;
  if (d.trialId !== String(generation)) return;
  if (d.type === "return") { cancelTrial(); setup.open(); return; }
  if (d.type === "ready") {
    if (!trialPending) return;
    command("start", { tankId: trial.tank.id, mapId: trial.map.id });
    progress(.24, "Preparing the selected battlefield…");
    return;
  }
  if (d.type === "progress" && trialPending) {
    progress(typeof d.fraction === "number" ? d.fraction : loadingProgress, d.label);
    return;
  }
  if (d.type === "error" && trialPending) {
    clearTimeout(errorTimer);
    $("loading-text").textContent = d.message;
    $("retry").hidden = false;
    status("DEPLOYMENT FAILED");
    return;
  }
  if (d.type !== "telemetry" || (!trialPending && !hasTelemetry)) return;
  if (!hasTelemetry) {
    hasTelemetry = true;
    trialPending = false;
    progress(1, "Trial active");
    game.style.visibility = "visible";
    $<HTMLButtonElement>("configure-trial").disabled = false;
    clearTimeout(errorTimer);
    running = true;
    signals.active = true;
    $("loading").hidden = true;
    $("arena-tag").hidden = false;
    buttons(false);
    status("FLY CONTROL");
    for (const id of ["arena-status", "brain-status", "specimen-status"]) {
      $(id).textContent = "LIVE";
      $(id).classList.add("live");
    }
    $("pulse").classList.add("active");
  }
  signals.throttle = d.throttle;
  signals.steer = d.steer;
  signals.fire = d.fire;
  signals.shotFlash = d.shotFlash ?? 0;
  signals.sugar = d.sugar;
  signals.bearing = d.bearing;
  signals.gaitLeft = d.gaitLeft;
  signals.gaitRight = d.gaitRight;
  signals.arms = human ? createStation() : (d.arms ?? createStation());
  signals.active = !human && !d.ended;
  signals.look = d.look ?? 0;
  signals.speed = d.speed;
  signals.hp = d.maxHp ? d.hp / d.maxHp : 1;
  signals.range = d.range;
  signals.reload = d.reload;
  if (d.connectome && !human && !d.ended) brain.update(d.connectome, d.time);
  $("timer").textContent =
    `${String(Math.floor(d.time / 60)).padStart(2, "0")}:${String(Math.floor(d.time % 60)).padStart(2, "0")}`;
  $("speed").textContent = Math.abs(d.speed).toFixed(1);
  $("health").textContent = String(Math.max(0, Math.round(d.hp)));
  $("health-unit").textContent = `/ ${d.maxHp}`;
  $("health-bar").style.width =
    `${Math.max(0, Math.min(100, (d.hp / d.maxHp) * 100))}%`;
  $("throttle-bar").style.width = `${Math.abs(d.throttle) * 100}%`;
  $("steer-bar").style.width = `${Math.abs(d.steer) * 100}%`;
  $("throttle").textContent = `${Math.round(d.throttle * 100)}%`;
  $("steer").textContent =
    Math.abs(d.steer) < 0.03
      ? "CENTER"
      : `${d.steer < 0 ? "L" : "R"} ${Math.round(Math.abs(d.steer) * 100)}%`;
  $("reload").textContent = d.reload > 0 ? `${d.reload.toFixed(1)} s` : "Ready";
  $("fire-state").textContent = d.weapon ?? (d.fire ? "Firing" : "Gun loaded");
  $("target-range").textContent =
    d.range === null ? "—" : String(Math.round(d.range));
  $("target-state").textContent = d.target
    ? "Visual contact"
    : `${d.enemies} enemies remaining`;
  $("tank-label").textContent = `${d.tank} · ${trial.map.name}`;
  $("repair-status").textContent =
    d.repairRemaining > 0 ? `${Math.ceil(d.repairRemaining)}s` : "Ready";
  $("missile-status").textContent = d.missileAvailable
    ? d.missileSelected
      ? "Selected"
      : "Available"
    : "Not equipped";
  if (!human) $("intent").textContent = d.intent;
  $("sugar-pop").classList.toggle("show", d.sugarRemaining > 0);
  $("sugar-pop").textContent = `SUGAR · ${Math.ceil(d.sugarRemaining)}s`;
  for (const key of ["aim", "look", "fire", "repair", "missile"]) {
    const a =
      key === "aim" || key === "look" ? signals.arms.left : signals.arms.right;
    document
      .querySelector(`[data-key="${key}"]`)
      ?.classList.toggle(
        "pressed",
        signals.active && a.key === key && a.contact,
      );
  }
  history.push(Math.min(60, Math.abs(d.speed)));
  if (history.length > 70) history.shift();
  $("speed-trace").setAttribute(
    "d",
    history
      .map((v, i) => `${i ? "L" : "M"}${(i * 180) / 69},${34 - v * 0.5}`)
      .join(" "),
  );
  if (d.ended) {
    signals.active = false;
    if (running) command("pause", { paused: true });
    running = false;
    status("ROUND COMPLETE");
    for (const id of ["arena-status", "brain-status", "specimen-status"])
      $(id).textContent = "COMPLETE";
    for (const id of ["pause", "sugar", "takeover"])
      $<HTMLButtonElement>(id).disabled = true;
    $("pulse").classList.remove("active");
  }
});
document.addEventListener("visibilitychange", () => {
  if (running) command("pause", { paused: document.hidden || signals.paused });
});
window.addEventListener("pagehide", () => {
  command("pause", { paused: true });
  specimen?.dispose();
  brain.dispose();
  clearTimeout(errorTimer);
});

for (const button of document.querySelectorAll<HTMLButtonElement>(
  ".panel-switch [data-panel]",
)) {
  button.addEventListener("click", () => {
    showPanel(button.dataset.panel!);
    document.body.classList.remove("expanded");
    $("expand").setAttribute("aria-pressed", "false");
    $("expand").setAttribute("aria-label", "Expand battlefield");
  });
}
