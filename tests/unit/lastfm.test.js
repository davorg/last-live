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
