import { normalizeSearchQuery } from '../searchQuery.js';

const connectionError = 'Could not connect to Last.fm. Check your connection and try again.';

function isArtist(artist) {
  const playcount = artist?.playcount;
  return typeof artist?.name === 'string' && artist.name.trim().length > 0 &&
    (typeof playcount === 'number' || (typeof playcount === 'string' && /^\d+$/.test(playcount))) &&
    Number.isSafeInteger(Number(playcount)) && Number(playcount) >= 0;
}

export function createLastFmClient({
  apiKey,
  endpoint = 'https://ws.audioscrobbler.com/2.0/',
  fetchImpl = fetch,
}) {
  return {
    async getTopArtists(query, { signal } = {}) {
      const { username, timePeriod, artistCount } = normalizeSearchQuery(query);
      const url = new URL(endpoint);
      const parameters = {
        method: 'user.gettopartists',
        user: username,
        period: timePeriod,
        limit: artistCount,
        api_key: apiKey,
        format: 'json',
      };
      for (const [name, value] of Object.entries(parameters)) {
        url.searchParams.set(name, value);
      }
      let response;
      try {
        response = await fetchImpl(url.toString(), { signal });
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        throw new Error(connectionError, { cause: error });
      }

      const httpError = `Last.fm request failed (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}). Please try again.`;
      let data;
      try {
        data = await response.json();
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        const message = !response.ok ? httpError : error instanceof SyntaxError
          ? 'Last.fm returned an unreadable response. Please try again.' : connectionError;
        throw new Error(message, { cause: error });
      }

      if (data?.error != null) {
        const message = typeof data.message === 'string' ? data.message.trim() : '';
        const code = typeof data.error === 'number' || typeof data.error === 'string' ? data.error : null;
        throw new Error(message ? `Last.fm: ${message}` : code !== null
          ? `Last.fm returned API error ${code}. Please try again.`
          : 'Last.fm could not complete the request. Please try again.');
      }
      if (!response.ok) throw new Error(httpError);

      const artists = data?.topartists?.artist;
      if (!Array.isArray(artists) || !artists.every(isArtist)) {
        throw new Error('Last.fm returned an unexpected artist list. Please try again.');
      }
      return artists;
    },
  };
}
