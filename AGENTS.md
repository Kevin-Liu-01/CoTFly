# CoTFly

Standalone neural fly pilot for Claude of Tanks. The console entry is `fly.html`; `src/fly/` owns the pilot, connectome, cockpit and UI. `src/main.ts` supplies the embedded game through a same-origin iframe. The root and `/fly` open the console; `/game.html` remains the game entry.

- Use Node.js 24. Run `npm run test:fly`, `npm run typecheck`, and `npm run build` for pilot integration changes.
- Keep simulation at 60 Hz and the connectome's deterministic 1 ms substeps. Preserve canonical game actions, spotting boundaries and iframe origin checks.
- Preserve batched brain rendering and demand-driven auxiliary rendering. Avoid per-frame allocations in established hot loops.
- The 124-cell reduced circuit is measured anatomy with authored dynamics and motor mappings. Do not describe it as a whole-brain simulation or measured tank behavior.
- Keep data provenance in `src/fly/data/NOTICE.md` and inherited game licenses in `LICENSE-POLICY.md`.
- Consult directory `SKILL.md` files before changing the inherited game. Do not broadly stage generated vehicle assets.
- Vercel project: `cotfly`, team `kl01s-projects`; production domain: `fly.kevinliu.studio`. Never modify the separate Claude of Tanks deployment for CoTFly work.
