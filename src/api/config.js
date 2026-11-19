export const DEFAULT_LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

// Shared by development and production builds so deployment checks use the
// same defaults and direct/proxy distinction as the configuration we publish.
export function resolveLastFmConfig({ apiURL, apiKey } = {}) {
  let url;
  try {
    url = new URL(apiURL?.trim() || DEFAULT_LASTFM_API_URL);
  } catch {
    throw new Error('VITE_LASTFM_API_URL must be an absolute HTTP or HTTPS URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('VITE_LASTFM_API_URL must be an absolute HTTP or HTTPS URL.');
  }
  if (url.username || url.password || url.hash || url.searchParams.has('api_key')) {
    throw new Error('VITE_LASTFM_API_URL must not contain credentials, a fragment or an api_key parameter.');
  }

  const direct = url.hostname === 'ws.audioscrobbler.com';
  const key = apiKey?.trim() || '';
  if (direct && !key) {
    throw new Error('Set VITE_LASTFM_API_KEY for direct Last.fm requests, or set VITE_LASTFM_API_URL to a proxy.');
  }
  return { endpoint: url.toString(), apiKey: direct ? key : '' };
}
