export function createLastFmClient({
  apiKey,
  endpoint = 'https://ws.audioscrobbler.com/2.0/',
  fetchImpl = fetch,
}) {
  return {
    async getTopArtists({ username, timePeriod, artistCount }) {
      const response = await fetchImpl(
        `${endpoint}?method=user.gettopartists&user=${username}&period=${timePeriod}&limit=${artistCount}&api_key=${apiKey}&format=json`
      );

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
