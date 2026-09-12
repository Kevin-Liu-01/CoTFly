# CoTFly

A separate `/fly` page pairs an original procedural fruit fly and miniature armored cockpit with the actual Claude of Tanks solo game in a same-origin iframe. The intended host is `fly.kevinliu.studio`.

## Run and publish

Install with `npm ci`, run `npx vite --host 127.0.0.1 --port 5193`, and open `/fly`. `npm run build` includes `fly.html`. The standalone CoTFly Vercel configuration rewrites `/` to `/fly.html` on every deployment; the iframe explicitly uses `/index.html`. The production domain is `fly.kevinliu.studio`.

## Cockpit and game controls

The fly wears an olive tanker helmet with earphones and a microphone. Its middle legs grip the rotating steering wheel; the rear legs move the ball. Forelegs reach aim, look, fire, missile-selection and repair controls, with a 90 ms contact delay before activation. The cockpit includes armored sides, bolts, guarded switches and a live instrument display showing speed, armor, reload and visible-target bearing/range.

Select Abrams, Leopard 2A6, T-90A, Bradley, BMP-2 or Sheridan before deployment. A selection during battle applies on New fly. Missile-equipped vehicles use their actual guided ammunition, switch to cannon when appropriate, and handle missile-only vehicles. Normal game actions own kit cooldowns, ammunition, firing, aiming, movement, damage and outcomes. The fly prioritizes fire extinguishing, damaged modules and injured crew when their kits are available. The adapter listens for canonical consumable-use receipts.

Pause freezes simulation advancement. Sugar stimulates the neural model and reduces engagement distance for 15 simulation seconds. Take control releases commands to normal human input; Fly control restores autonomy. New fly creates a fresh round and brain state. Orbit/Top and drag/zoom control the specimen view. The compound-eye overlay is decorative; actual sensing uses spotted targets with clear world sightlines and three obstacle feelers.

## Neural simulation and provenance

`connectome.ts` runs 124 identified MaleCNS cells (75 mAL and 49 P1-related pC1) connected by 1,106 measured direct anatomical edges exported in Fruitless's reduced circuit. The original body IDs, types and synapse counts are retained. At 1 ms substeps, leaky integrate-and-fire neurons integrate voltage, reset after crossing threshold, observe a refractory period, and send inhibition through measured edges. No recorded spike playback is used.

Assumed dynamics: 20 ms membrane constant; −65 mV rest/reset; −50 mV threshold; 3 ms refractory period; 12 ms inhibitory decay. Counts are normalized by the mean selected incoming total. GABA annotation motivates the inhibitory sign; it is a model assumption, not a measured physiological sign table. Threat and sugar encoding, physiological constants and motor mappings are authored game adaptations. This is not a reproduction of Fruitless's courtship experiment or its separate 166,606-neuron whole-CNS simulation.

The P1-related population's smoothed firing rate modulates driving gain in `controller.ts`. An authored 24-channel recurrent rate network in `brain.ts` maps battle senses into bounded motor commands; deterministic collision recovery and turret interlocks constrain them. This preserves a causal connection from measured-circuit activity to gameplay without claiming tank behavior is biological.

`brainView.ts` displays the selected cells' actual soma coordinates and decimated sampled neurites in a rotatable Three.js cluster. Dim, filtered background soma points provide anatomical context only; they are not simulated. Cell selection exposes body ID, type, membrane voltage, smoothed Hz, cumulative spikes and measured connection count. The six-second raster records increases in live cumulative spike counts, one row per simulated cell, at 30 Hz telemetry cadence. Multiple spikes in a bin share one raster mark. Colors and afterglow aid visibility.

Data from [Fruitless](https://github.com/nicodunks/fruitless) and [MaleCNS](https://male-cns.janelia.org/download/) is CC BY 4.0. Exact upstream revision, credits and modifications are in `src/fly/data/NOTICE.md`. No upstream fly meshes or code were copied. Other inspirations: [flybody](https://github.com/TuragaLab/flybody), [MuJoCo Menagerie](https://github.com/google-deepmind/mujoco_menagerie), [NeuroMechFly](https://github.com/NeLy-EPFL/flygym), and [Nature's fly locomotion paper](https://www.nature.com/articles/s41586-025-09029-4).

## Boundaries and verification

The lab and arena validate message origin and source. Fly modules load only for the lab or embedded `?fly-agent=1` solo game. Normal multiplayer is unaffected. Hidden pages pause; human takeover clears virtual firing. No fleet geometry, armor profiles or combat rules change.

Focused checks are registered in the core suite: `controller.selftest.mjs`, `connectome.selftest.mjs`, `runtime.selftest.mjs`. They cover deterministic spiking, frame partition invariance, inhibitory-edge ablation, sugar responses, spotting, turret alignment, physical contact delays, kit cooldowns, depleted missiles, missile-only vehicles, pause and human ownership. Existing `playerBattleActions.selftest.mjs` checks canonical kit/ammo actions. Run `npm run typecheck` and `npm run build` as integration checks.

The earlier full `npm test` run was stopped during its extensive fleet-geometry pretest sweep; no full-suite pass is claimed. Browser verification covers desktop/mobile alignment, a real selected-vehicle deployment, live shots, spike telemetry, inspector selection, pause/resume, sugar, takeover, and specimen views.

## Verification receipt — 2026-09-12

Type checks, the public production build, all three fly tests, canonical player battle actions, battle frame runtime and frame scheduler checks passed. Agent-browser verified 1440 × 1100 and 390 × 844 layouts without horizontal overflow. Live Sheridan guided fire scored a 1,000-damage penetrating hit; Bradley used TOW ammunition. Live telemetry showed cumulative neuron spikes, sugar-driven P1 output and a 41.5 Hz selected pC1 cell. Pause preserved the timer, membrane readout and raster exactly. Human takeover bypassed the brain and cleared all pressed keys. Both specimen views and cell selection worked. A ResizeObserver warning found during viewport changes was fixed by deferring canvas resizing to animation frames; repeated desktop/mobile resizing then produced no captured errors. The production preview remains available on port 5194.

## Console layout and render budget

The presentation uses a viewport-sized instrument casing, a slim control rail, two left monitors (pilot and neurons), a large battlefield display, and four aligned telemetry instruments. Perspective applies to the decorative casing so text and input coordinates remain sharp and flat. Static CSS borders, gradients and shadows provide depth; there are no animated filters or pointer-driven page transforms.

At widths up to 900 px, Battle / Pilot / Neural switches select a full-height display while retaining vehicle controls and telemetry. This avoids squeezing all three monitors onto a phone or requiring a long page. Desktop expansion temporarily gives the battlefield the full main area.

All 124 neurite clouds now share one point draw with a dynamic color buffer; context, soma, links and selection marker remain separate (five brain-scene draw calls total). Connection counts are cached. Brain rendering remains demand-driven. The specimen caps active rendering at 30 fps (10 fps with reduced motion); it settles camera/control changes and stops drawing while idle or paused. Both auxiliary renderers skip hidden tab surfaces. The tank simulation's fixed-step timing is unchanged.

Console verification: 1366 × 768 and 1440 × 900 desktop layouts and the 390 × 844 phone layout fit without document scrolling. A live Bradley battle continued while the phone displayed the neural tab; the hidden specimen produced no draw calls. The visible brain issued 120 draws over a 1.2-second sample (five draws per rendered update). After pause settled, auxiliary WebGL draw calls were zero and both the timer and spike raster were unchanged. No browser errors were captured during these checks. Taking human control switches the phone display back to Battle.

The neuron inspector defaults to automatic activity tracking. Its selector lists up to eight currently active cells ranked by smoothed firing rate (at least 1 Hz), with an explicit selection retained while it remains active. Automatic tracking uses 20% hysteresis to reduce flicker; a quiet selected cell returns to automatic tracking. Rankings refresh at most twice per second while the selected cell is active, and option lists remain stable while the selector has focus. No activity is fabricated before deployment: the inspector says Awaiting spikes.
