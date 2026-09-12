import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import '../src/vehicles/fleetFactory.ts';
import { PRODUCTION_TANK_IDS, getSpec } from '../src/vehicles/specs.ts';
import { MAP_IDS, getMapName } from '../src/world/maps/catalog.ts';
const catalog = {
  tanks: PRODUCTION_TANK_IDS.map(id => {
    const spec = getSpec(id);
    return {id, name:spec.name, detail:`${spec.nation} · ${spec.gun.caliberMm} mm${spec.gun.shells.some(s => s.guided) ? ' · Missiles' : ''}`, image:`/icons/${id}_angle.webp`, icon:`/icons/${id}_side_silhouette.png`};
  }),
  maps: MAP_IDS.map(id => ({id, name:getMapName(id), detail:'Solo trial · Standard battle', image:`/maps/${id}.webp`, icon:`/maps/thumbs/${id}.webp`})),
};
for (const item of [...catalog.tanks, ...catalog.maps]) for (const asset of [item.image, item.icon]) {
  if (!existsSync(new URL(`../public${asset}`, import.meta.url))) throw new Error(`Missing trial preview: ${asset}`);
}
const file = new URL('../src/fly/data/trialCatalog.json', import.meta.url);
const output = JSON.stringify(catalog, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(file, 'utf8') !== output) throw new Error('Trial catalog is stale. Run node tools/cotfly-catalog.mjs');
} else writeFileSync(file, output);
console.log(`CoTFly catalog: ${catalog.tanks.length} tanks and ${catalog.maps.length} maps, all previews verified.`);
