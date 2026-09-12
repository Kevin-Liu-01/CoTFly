import catalog from './data/trialCatalog.json';
export interface TrialItem { id: string; name: string; detail: string; image: string; icon: string }
export interface TrialSelection { tank: TrialItem; map: TrialItem }
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export function createTrialSetup(onLaunch: (selection: TrialSelection) => void) {
  let tank = catalog.tanks.find(t => t.id === 'm1a1')!, map = catalog.maps.find(m => m.id === 'desert')!;
  let kind: 'tank' | 'map' = 'tank';
  const dialog = $<HTMLDialogElement>('trial-setup');
  const menu = $('trial-dropdown'), list = $('trial-options'), search = $<HTMLInputElement>('trial-search');
  const closeMenu = (focus = true) => {
    menu.hidden = true;
    $('choose-tank').setAttribute('aria-expanded', 'false');
    $('choose-map').setAttribute('aria-expanded', 'false');
    if (focus) $('choose-' + kind).focus();
  };
  const sync = () => {
    for (const [key, item] of [['tank', tank], ['map', map]] as const) {
      $<HTMLImageElement>('trial-' + key + '-image').src = item.image;
      $('trial-' + key + '-name').textContent = item.name;
      $('trial-' + key + '-detail').textContent = item.detail;
      $('choose-' + key).setAttribute('aria-label', `Choose ${key}: ${item.name}`);
    }
    $('trial-summary').textContent = `${tank.name} · ${map.name}`;
    $<HTMLImageElement>('idle-tank').src = tank.image;
    $<HTMLImageElement>('idle-map').src = map.image;
    $('idle-tank-name').textContent = tank.name;
    $('idle-map-name').textContent = map.name;
  };
  const render = () => {
    const query = search.value.trim().toLowerCase();
    const items = (kind === 'tank' ? catalog.tanks : catalog.maps).filter(item => `${item.name} ${item.detail}`.toLowerCase().includes(query));
    list.replaceChildren();
    $('trial-option-count').textContent = `${items.length} ${kind === 'tank' ? 'vehicles' : 'battlefields'}`;
    for (const item of items) {
      const option = document.createElement('button');
      option.type = 'button'; option.className = 'trial-option'; option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(item.id === (kind === 'tank' ? tank : map).id));
      option.tabIndex = item.id === (kind === 'tank' ? tank : map).id || item === items[0] ? 0 : -1;
      const img = document.createElement('img'); img.src = kind === 'map' ? item.icon : item.image; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      const copy = document.createElement('span'), name = document.createElement('b'), detail = document.createElement('small');
      name.textContent = item.name; detail.textContent = item.detail; copy.append(name, detail);
      const check = document.createElement('span'); check.className = 'option-check'; check.textContent = '✓'; check.setAttribute('aria-hidden','true');
      option.append(img, copy, check);
      option.addEventListener('click', () => { if (kind === 'tank') tank = item; else map = item; sync(); closeMenu(); });
      list.append(option);
    }
    $('trial-empty').hidden = items.length > 0;
  };
  for (const key of ['tank', 'map'] as const) $('choose-' + key).addEventListener('click', () => {
    if (!menu.hidden && kind === key) { closeMenu(); return; }
    closeMenu(false); kind = key;
    menu.hidden = false; search.value = '';
    search.placeholder = key === 'tank' ? 'Search vehicles, nations, missiles…' : 'Search battlefields…';
    search.setAttribute('aria-label', `Search ${key === 'tank' ? 'vehicles' : 'battlefields'}`);
    list.setAttribute('aria-label', key === 'tank' ? 'Vehicles' : 'Battlefields');
    $('choose-' + key).setAttribute('aria-expanded', 'true');
    render(); search.focus();
  });
  search.addEventListener('input', render);
  menu.addEventListener('keydown', event => {
    const options = Array.from(list.querySelectorAll<HTMLButtonElement>('button'));
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = Math.min(options.length - 1, index + 1);
    if (event.key === 'ArrowUp') next = index <= 0 ? 0 : index - 1;
    if (event.key === 'Home' && event.target !== search) next = 0;
    if (event.key === 'End' && event.target !== search) next = options.length - 1;
    if (next !== null) { event.preventDefault(); options[next]?.focus(); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(); }
  });
  $('trial-menu-close').addEventListener('click', () => closeMenu());
  $('trial-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => closeMenu(false));
  $('trial-launch').addEventListener('click', () => { dialog.close(); onLaunch({tank, map}); });
  sync();
  return { open() { closeMenu(false); dialog.showModal(); }, selection: () => ({tank, map}) };
}
