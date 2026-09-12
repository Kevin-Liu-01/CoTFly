const CACHE_TTL = 60 * 60 * 1000;
const compactCount = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const exactCount = new Intl.NumberFormat('en');
interface StarCache { count: number; checkedAt: number }
const validCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Public metadata only: two requests on entry, no game-loop polling or tokens. */
export function mountRepositoryStars(): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('.repo-button[data-repo]')) {
    void loadStars(link);
  }
}

async function loadStars(link: HTMLAnchorElement): Promise<void> {
  const repo = link.dataset.repo;
  if (repo !== 'CoTFly' && repo !== 'claude-of-tanks') return;
  const name = link.dataset.repoName ?? repo;
  const badge = link.querySelector<HTMLElement>('[data-star-count]');
  if (!badge) return;
  const key = `cotfly:github-stars:v1:${repo}`;
  let cached: StarCache | null = null;
  const show = (count: number, saved: boolean) => {
    badge.textContent = compactCount.format(count);
    const stars = `${exactCount.format(count)} ${count === 1 ? 'star' : 'stars'}`;
    link.title = `${name} · ${stars}${saved ? ' (last checked)' : ''} · View on GitHub`;
    link.setAttribute('aria-label', `${name} on GitHub, ${stars}${saved ? ', last checked count' : ''} (opens in a new tab)`);
  };
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (value && validCount(value.count) && Number.isFinite(value.checkedAt) && value.checkedAt <= Date.now()) {
      cached = value;
      show(value.count, true);
    }
  } catch { /* Storage can be unavailable in private or embedded browsers. */ }
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL) return;
  try {
    const response = await fetch(`https://api.github.com/repos/Kevin-Liu-01/${repo}`, {
      headers: { Accept: 'application/vnd.github+json' },
      credentials: 'omit',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Repository metadata unavailable');
    const data = await response.json();
    if (!validCount(data.stargazers_count)) throw new Error('Invalid star count');
    show(data.stargazers_count, false);
    try {
      localStorage.setItem(key, JSON.stringify({ count: data.stargazers_count, checkedAt: Date.now() }));
    } catch { /* A successful count remains visible without persistent storage. */ }
  } catch {
    // Keep the last real count during an outage; never turn an error into zero.
    if (!cached) {
      badge.textContent = '—';
      link.title = `${name} · Star count unavailable · View on GitHub`;
      link.setAttribute('aria-label', `${name} on GitHub, star count unavailable (opens in a new tab)`);
    }
  }
}
