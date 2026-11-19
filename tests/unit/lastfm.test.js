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

for (const apiKey of [undefined, '', '   ']) {
  test(`omits api_key for a proxy when its configured key is ${JSON.stringify(apiKey)}`, async () => {
    let requestedURL;
    const client = createLastFmClient({
      apiKey,
      endpoint: 'https://proxy.example/lastfm?api_key=old&api_key=older&route=artists',
      fetchImpl: async url => {
        requestedURL = new URL(url);
        return Response.json({ topartists: { artist: [] } });
      },
    });
    const username = ' Björk &limit=999+%?#=yes ';
    await client.getTopArtists({ ...query, username });
    assert.deepEqual(Object.fromEntries(requestedURL.searchParams), {
      route: 'artists', method: 'user.gettopartists', user: username.trim(),
      period: '12month', limit: '2', format: 'json',
    });
    assert.equal(requestedURL.searchParams.has('api_key'), false);
  });
}

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
  await assert.rejects(() => client.getTopArtists(query), {
    message: 'Last.fm request failed (HTTP 403 Forbidden). Please try again.',
  });
});

for (const [description, payload] of [
  ['a missing chart', {}],
  ['a chart without artists', { topartists: {} }],
  ['a null body', null],
  ['a non-array artist list', { topartists: { artist: {} } }],
  ['a null artist', { topartists: { artist: [null] } }],
  ['an artist without a name', { topartists: { artist: [{ playcount: '100' }] } }],
  ['an artist with a blank name', { topartists: { artist: [{ name: ' ', playcount: '100' }] } }],
  ['an artist with an invalid playcount', { topartists: { artist: [{ name: 'Pulp', playcount: 'oops' }] } }],
  ['an artist with a negative playcount', { topartists: { artist: [{ name: 'Pulp', playcount: '-1' }] } }],
  ['an artist with a missing playcount', { topartists: { artist: [{ name: 'Pulp' }] } }],
]) {
  test(`rejects ${description}`, async () => {
    const client = clientWithResponse(Response.json(payload));
    await assert.rejects(() => client.getTopArtists(query), {
      message: 'Last.fm returned an unexpected artist list. Please try again.',
    });
  });
}

test('explains network failures without losing the underlying error', async () => {
  const error = new TypeError('Failed to fetch');
  const client = createLastFmClient({ apiKey: 'test-key', fetchImpl: async () => { throw error; } });
  await assert.rejects(() => client.getTopArtists(query), failure => {
    assert.equal(failure.message, 'Could not connect to Last.fm. Check your connection and try again.');
    assert.equal(failure.cause, error);
    return true;
  });
});

test('explains unreadable JSON responses', async () => {
  const client = clientWithResponse(new Response('not JSON'));
  await assert.rejects(() => client.getTopArtists(query), {
    message: 'Last.fm returned an unreadable response. Please try again.',
  });
});

for (const status of [200, 403, 429, 503]) {
  test(`preserves an API error message with HTTP status ${status}`, async () => {
    const client = clientWithResponse(Response.json({ error: 10, message: ' Invalid API key ' }, { status }));
    await assert.rejects(() => client.getTopArtists(query), { message: 'Last.fm: Invalid API key' });
  });
}

test('falls back to the API error code when its message is missing', async () => {
  const client = clientWithResponse(Response.json({ error: 29, message: '   ' }));
  await assert.rejects(() => client.getTopArtists(query), {
    message: 'Last.fm returned API error 29. Please try again.',
  });
});

test('reports an HTTP failure when JSON has no API error', async () => {
  const client = clientWithResponse(Response.json({ topartists: { artist: artists } }, { status: 503 }));
  await assert.rejects(() => client.getTopArtists(query), /HTTP 503/);
});

test('accepts numeric and zero playcounts', async () => {
  const result = [{ name: 'Pulp', playcount: 0 }, { name: 'Radiohead', playcount: '0' }];
  const client = clientWithResponse(Response.json({ topartists: { artist: result } }));
  assert.deepEqual(await client.getTopArtists(query), result);
});

test('passes cancellation to fetch and preserves its AbortError', async () => {
  const controller = new AbortController();
  const client = createLastFmClient({
    apiKey: 'test-key',
    fetchImpl: async (url, { signal }) => {
      assert.equal(signal, controller.signal);
      controller.abort();
      signal.throwIfAborted();
    },
  });
  await assert.rejects(() => client.getTopArtists(query, { signal: controller.signal }),
    error => error === controller.signal.reason);
});

test('preserves cancellation while reading the response body', async () => {
  const error = new DOMException('Aborted', 'AbortError');
  const client = clientWithResponse({ ok: true, status: 200, json: async () => { throw error; } });
  await assert.rejects(() => client.getTopArtists(query), failure => failure === error);
});

test('explains a connection failure while reading the response body', async () => {
  const client = clientWithResponse({ ok: true, status: 200, json: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(() => client.getTopArtists(query), {
    message: 'Could not connect to Last.fm. Check your connection and try again.',
  });
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
