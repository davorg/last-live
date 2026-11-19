import { normalizeSearchQuery } from '../searchQuery.js';

export function createLastFmClient({
  apiKey,
  endpoint = 'https://ws.audioscrobbler.com/2.0/',
  fetchImpl = fetch,
}) {
  return {
    async getTopArtists(query) {
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
      const response = await fetchImpl(url.toString());

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.topartists || !data.topartists.artist) {
        throw new Error('Invalid data format received from API');
      }

      return data.topartists.artist;
    },
  };
}
