// GA4 for fly.kevinliu.studio. The measurement ID is public by design: every page view sends it.
const GA_MEASUREMENT_ID = 'G-CK8E45VTBS';
const PRODUCTION_HOST = 'fly.kevinliu.studio';

// Consent Mode v2: analytics cookies stay off (cookieless pings) in the EEA, the UK and Switzerland.
const NO_COOKIE_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT',
  'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'GB',
];

/** Origin and path only: inherited invite links carry a room code and the host's player name in the query. */
const withoutQuery = (href: string): string => {
  try {
    const url = new URL(href);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
};

// Production host only: previews, localhost, e2e runs and self-hosted builds never send hits. The async
// gtag.js loads once and adds no custom events or per-frame work; enhanced measurement counts page views.
if (import.meta.env.VITE_SELF_HOSTED !== '1' && location.hostname === PRODUCTION_HOST) {
  const page = window as Window & { dataLayer?: unknown[] };
  const dataLayer = (page.dataLayer ||= []);
  // gtag.js only reads Arguments objects off the dataLayer, so push `arguments`, never an array; the rest
  // parameter exists for the type checker alone.
  const gtag = function gtag(..._args: unknown[]) {
    dataLayer.push(arguments);
  };
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied',
    region: NO_COOKIE_REGIONS,
  });
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted',
  });
  gtag('js', new Date());
  const referrer = withoutQuery(document.referrer);
  gtag('config', GA_MEASUREMENT_ID, {
    page_location: withoutQuery(location.href),
    ...(referrer ? { page_referrer: referrer } : {}),
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.append(script);
}
