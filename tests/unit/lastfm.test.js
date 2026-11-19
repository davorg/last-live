import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLastFmClient } from '../../src/api/lastfm.js';

const query = { username: 'test-listener', timePeriod: '12month', artistCount: 2 };
const artists = [{ name: 'Radiohead', playcount: '1200' }, { name: 'Pulp', playcount: '800' }];

function clientWithResponse(response) {
  return createLastFmClient({ apiKey: 'test-key', fetchImpl: async () => response });
}

test('requests the selected chart and returns its artists', async () => {
  let requestedURL;
  const client = createLastFmClient({
    apiKey: 'test-key',
    fetchImpl: async url => {
      requestedURL = new URL(url);
      return Response.json({ topartists: { artist: artists } });
    },
  });

  assert.deepEqual(await client.getTopArtists(query), artists);
  assert.equal(requestedURL.origin + requestedURL.pathname, 'https://ws.audioscrobbler.com/2.0/');
  assert.deepEqual(Object.fromEntries(requestedURL.searchParams), {
    method: 'user.gettopartists', user: 'test-listener', period: '12month',
    limit: '2', api_key: 'test-key', format: 'json',
  });
});

test('uses the endpoint supplied by the caller', async () => {
  let requestedURL;
  const client = createLastFmClient({
    apiKey: 'test-key',
    endpoint: 'https://proxy.example/lastfm',
    fetchImpl: async url => {
      requestedURL = new URL(url);
      return Response.json({ topartists: { artist: [] } });
    },
  });

  await client.getTopArtists(query);
  assert.equal(requestedURL.origin + requestedURL.pathname, 'https://proxy.example/lastfm');
});

for (const [label, endpoint] of [
  ['direct', 'https://ws.audioscrobbler.com/2.0/'],
  ['custom', 'https://proxy.example/lastfm?token=keep&limit=999&limit=888&format=xml&user=old'],
]) {
  test(`encodes username data safely for the ${label} endpoint`, async () => {
    let requestedURL;
    const username = '  Björk &limit=999+%?#=yes  ';
    const client = createLastFmClient({
      apiKey: 'test-key',
      endpoint,
      fetchImpl: async url => {
        requestedURL = new URL(url);
        return Response.json({ topartists: { artist: [] } });
      },
    });
    await client.getTopArtists({ ...query, username });
    assert.deepEqual(requestedURL.searchParams.getAll('user'), [username.trim()]);
    assert.deepEqual(requestedURL.searchParams.getAll('limit'), ['2']);
    assert.deepEqual(requestedURL.searchParams.getAll('api_key'), ['test-key']);
    assert.deepEqual(requestedURL.searchParams.getAll('method'), ['user.gettopartists']);
    assert.deepEqual(requestedURL.searchParams.getAll('format'), ['json']);
    assert.equal(requestedURL.hash, '');
    if (label === 'custom') assert.equal(requestedURL.searchParams.get('token'), 'keep');
  });
}

test('accepts a successful empty chart', async () => {
  const client = clientWithResponse(Response.json({ topartists: { artist: [] } }));
  assert.deepEqual(await client.getTopArtists(query), []);
});

test('reports an HTTP failure even when the response is not JSON', async () => {
  const client = clientWithResponse(new Response('<h1>Forbidden</h1>', {
    status: 403, statusText: 'Forbidden',
  }));
  await assert.rejects(() => client.getTopArtists(query), { message: 'Error: 403 Forbidden' });
});

for (const [description, payload] of [
  ['a missing chart', {}],
  ['a chart without artists', { topartists: {} }],
  ['an API error payload', { error: 10, message: 'Invalid API key' }],
]) {
  test(`rejects ${description}`, async () => {
    const client = clientWithResponse(Response.json(payload));
    await assert.rejects(() => client.getTopArtists(query), { message: 'Invalid data format received from API' });
  });
}

test('propagates network failures for the request hook to present', async () => {
  const error = new TypeError('Failed to fetch');
  const client = createLastFmClient({ apiKey: 'test-key', fetchImpl: async () => { throw error; } });
  await assert.rejects(() => client.getTopArtists(query), failure => failure === error);
});

test('propagates unreadable JSON responses', async () => {
  const client = clientWithResponse(new Response('not JSON'));
  await assert.rejects(() => client.getTopArtists(query), SyntaxError);
});

for (const [description, username] of [
  ['empty', ''], ['whitespace', ' \t\n '], ['null', null], ['numeric', 42],
]) {
  test(`rejects ${description} username input before fetching`, async () => {
    let requests = 0;
    const client = createLastFmClient({
      apiKey: 'test-key',
      fetchImpl: async () => { requests++; return Response.json({ topartists: { artist: [] } }); },
    });
    await assert.rejects(() => client.getTopArtists({ ...query, username }), { message: 'Enter your Last.fm username.' });
    assert.equal(requests, 0);
  });
}

for (const [description, artistCount] of [
  ['empty', ''], ['zero', 0], ['negative', -1], ['fractional', 1.5],
  ['above the app limit', 1001], ['nonnumeric', 'not-a-number'],
  ['null', null], ['boolean', true], ['array', [1]],
]) {
  test(`rejects an artist count that is ${description} before fetching`, async () => {
    let requests = 0;
    const client = createLastFmClient({
      apiKey: 'test-key',
      fetchImpl: async () => { requests++; return Response.json({ topartists: { artist: [] } }); },
    });
    await assert.rejects(() => client.getTopArtists({ ...query, artistCount }), {
      message: 'Enter a whole number of artists between 1 and 1000.',
    });
    assert.equal(requests, 0);
  });
}

for (const artistCount of [1, '1000']) {
  test(`accepts the artist-count boundary ${artistCount}`, async () => {
    let requestedURL;
    const client = createLastFmClient({
      apiKey: 'test-key',
      fetchImpl: async url => {
        requestedURL = new URL(url);
        return Response.json({ topartists: { artist: [] } });
      },
    });
    await client.getTopArtists({ ...query, artistCount });
    assert.equal(requestedURL.searchParams.get('limit'), String(artistCount));
  });
}

test('normalises username whitespace and numeric count strings', async () => {
  let requestedURL;
  const client = createLastFmClient({
    apiKey: 'test-key',
    fetchImpl: async url => {
      requestedURL = new URL(url);
      return Response.json({ topartists: { artist: [] } });
    },
  });
  await client.getTopArtists({ ...query, username: '  test-listener  ', artistCount: '0002' });
  assert.equal(requestedURL.searchParams.get('user'), 'test-listener');
  assert.equal(requestedURL.searchParams.get('limit'), '2');
});
