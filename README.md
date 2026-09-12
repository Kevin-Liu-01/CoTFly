# CoTFly

A fruit fly in a tiny tank helmet plays **Claude of Tanks**. Watch it steer, look around, aim, press fire, launch missiles and use repair kits from its miniature armored cockpit.

**[Play CoTFly](https://fly.kevinliu.studio/)**

The console combines a live 3D pilot, the actual tank battle, and an interactive neuron cluster. Pick an Abrams, Leopard, T-90A, Bradley, BMP-2 or Sheridan; deploy the fly, give it sugar, pause, or take control yourself. The layout fits desktop screens and switches between Battle, Pilot and Neural displays on phones.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open the printed local URL. `/` opens CoTFly; legacy `/fly` links redirect to `/`. The embedded game uses `/game.html?fly-agent=1&nosplash=1` on the same origin.

```sh
npm run test:fly
npm run typecheck
npm run build
npm run preview
```

Vercel automatically runs the fly tests, type checks and production build on Git pushes, then serves `dist`. The final build publishes the console as `index.html` and the embedded game as `game.html`; no environment variables are required for the autonomous solo experience. The inherited multiplayer services are optional and require their own configuration.

## What the brain simulates

The live leaky integrate-and-fire model contains **124 identified MaleCNS cells and 1,106 measured anatomical connections**, sourced from Fruitless's reduced circuit. The inspector follows active cells and displays live voltages, firing rates and spikes. Its population activity modulates an authored game controller.

The dynamics, sensory encoding and tank controls are game adaptations, not measured fly behavior or a reproduction of the full Fruitless whole-CNS experiment. Background anatomy points provide context and are not simulated neurons. See [implementation notes](docs/FLY-OF-TANKS.md) and the [data notice](src/fly/data/NOTICE.md).

## Credits and license

Created by Kevin B. Liu. Built from [Claude of Tanks](https://github.com/Kevin-Liu-01/claude-of-tanks), source snapshot `9cde7b8f0`, with the CoTFly pilot and console. The complete game source and assets remain here so battles run independently on this deployment.

Circuit data comes from [Fruitless](https://github.com/nicodunks/fruitless) and [MaleCNS](https://male-cns.janelia.org/), under CC BY 4.0; exact revision, attribution and modifications are recorded in [NOTICE.md](src/fly/data/NOTICE.md). Fly and cockpit geometry is original. Inspirations include [flybody](https://github.com/TuragaLab/flybody), [MuJoCo Menagerie](https://github.com/google-deepmind/mujoco_menagerie) and [NeuroMechFly](https://github.com/NeLy-EPFL/flygym).

General code is MIT; inherited game content has explicit exceptions. Read [LICENSE-POLICY.md](LICENSE-POLICY.md), [LICENSE](LICENSE), and [third-party attribution](docs/ATTRIBUTION.md) before reusing assets. Existing notices and reserved-content terms are preserved.
