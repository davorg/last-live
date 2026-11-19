import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_LASTFM_API_URL, resolveLastFmConfig } from '../../src/api/config.js';

const execFileAsync = promisify(execFile);

for (const apiURL of [undefined, '', '   ', DEFAULT_LASTFM_API_URL]) {
  test(`defaults to direct Last.fm with URL ${JSON.stringify(apiURL)}`, () => {
    assert.deepEqual(resolveLastFmConfig({ apiURL, apiKey: ' test-key ' }), {
      endpoint: DEFAULT_LASTFM_API_URL, apiKey: 'test-key',
    });
    assert.throws(() => resolveLastFmConfig({ apiURL, apiKey: ' ' }), /Set VITE_LASTFM_API_KEY/);
  });
}

test('normalises a proxy URL and removes a leftover frontend key', () => {
  assert.deepEqual(resolveLastFmConfig({ apiURL: ' https://proxy.example/lastfm?route=artists ', apiKey: 'old-key' }), {
    endpoint: 'https://proxy.example/lastfm?route=artists', apiKey: '',
  });
});

test('allows a proxy without a frontend key, including a local HTTP proxy', () => {
  assert.deepEqual(resolveLastFmConfig({ apiURL: 'http://localhost:8080/lastfm' }), {
    endpoint: 'http://localhost:8080/lastfm', apiKey: '',
  });
});

test('requires a key for explicit upstream URLs too', () => {
  assert.throws(() => resolveLastFmConfig({ apiURL: 'https://WS.AUDIOSCROBBLER.COM:443/2.0/?route=artists' }),
    /Set VITE_LASTFM_API_KEY/);
});

for (const apiURL of ['proxy.example/lastfm', '/lastfm', '://bad', 'ftp://proxy.example/lastfm']) {
  test(`rejects an invalid endpoint ${apiURL}`, () => {
    assert.throws(() => resolveLastFmConfig({ apiURL }), /absolute HTTP or HTTPS URL/);
  });
}

for (const apiURL of [
  'https://user:password@proxy.example/lastfm',
  'https://proxy.example/lastfm#artists',
  'https://proxy.example/lastfm?api_key=old-key',
]) {
  test('rejects credentials, fragments and API keys in an endpoint URL', () => {
    assert.throws(() => resolveLastFmConfig({ apiURL }), /must not contain credentials, a fragment or an api_key/);
  });
}

test('a production proxy bundle excludes an API key left in the build environment', async t => {
  const output = await mkdtemp(join(tmpdir(), 'last-live-proxy-build-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const marker = 'last-live-leftover-key-must-not-be-published';
  await execFileAsync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', output], {
    env: { ...process.env, VITE_LASTFM_API_URL: 'https://proxy.example/lastfm', VITE_LASTFM_API_KEY: marker },
  });
  const files = await readdir(output, { recursive: true });
  const contents = await Promise.all(files.filter(file => /\.(js|html|css|map)$/.test(file))
    .map(file => readFile(join(output, file), 'utf8')));
  const bundle = contents.join('\n');
  assert.ok(bundle.includes('https://proxy.example/lastfm'), 'configured proxy URL must reach the app');
  assert.ok(!bundle.includes(marker), 'a leftover key must not appear anywhere in the proxy artifact');
});

test('the production build rejects direct mode without a key', async () => {
  await assert.rejects(() => execFileAsync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
    env: { ...process.env, VITE_LASTFM_API_URL: '', VITE_LASTFM_API_KEY: '' },
  }), error => {
    assert.match(error.stderr, /Set VITE_LASTFM_API_KEY/);
    return true;
  });
});
