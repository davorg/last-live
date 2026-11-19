export const MAX_ARTIST_COUNT = 1000;

export function normalizeSearchQuery({ username, timePeriod, artistCount }) {
  const trimmedUsername = typeof username === 'string' ? username.trim() : '';
  if (!trimmedUsername) {
    throw new Error('Enter your Last.fm username.');
  }

  const count = typeof artistCount === 'string' || typeof artistCount === 'number'
    ? Number(artistCount)
    : NaN;
  if (!Number.isInteger(count) || count < 1 || count > MAX_ARTIST_COUNT) {
    throw new Error(`Enter a whole number of artists between 1 and ${MAX_ARTIST_COUNT}.`);
  }

  return { username: trimmedUsername, timePeriod, artistCount: count };
}
