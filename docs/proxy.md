# Last.fm proxy integration

The production endpoint is `https://proxy.davecross.co.uk/lastfm/`, selected
using the repository Actions variable `VITE_LASTFM_API_URL`. Rebuild from `main`
after changing it. The proxy is maintained in
[davorg/api-proxy](https://github.com/davorg/api-proxy).

## Contract

Last Live sends a GET request without a body, custom headers or credentials:

| Parameter | Value |
| --- | --- |
| `method` | `user.gettopartists` |
| `user` | Nonempty username, with surrounding whitespace removed |
| `period` | `7day`, `1month`, `3month`, `6month`, `12month` or `overall` |
| `limit` | Integer from 1 to 1000; default 5 |
| `format` | `json` |

Values are URL-encoded. The frontend omits `api_key`; the proxy supplies its
server-side key when calling the fixed Last.fm upstream. Proxy builds exclude
the frontend key even if a previous direct key remains in the build environment.

The intended contract passes Last.fm's response body and HTTP status through,
including failures. Success uses `topartists.artist`, an array of artist objects
with `name` and `playcount`; an empty array is an empty chart. API errors retain
Last.fm's numeric `error` and descriptive `message`. The frontend continues to
expect Last.fm responses.

Cross-origin responses must allow `https://davorg.dev` through CORS. Wildcard
CORS is sufficient for the app's requests without credentials, but is not
authentication or protection against non-browser clients.

## Verification and remaining work

On 23 November 2026, the documented request for `davorg`, `7day` and five artists
returned HTTP 200, a valid five-artist JSON chart and
`Access-Control-Allow-Origin: *`. The production URL variable was set to the
endpoint above and the existing 1.1.0 app was rebuilt.

A real Chromium search from the deployed app returned five artists with no
`api_key` in the request. The deployed JavaScript selected the proxy endpoint
and did not contain the previous key held in the local configuration. Checks,
the production build and Pages deployment all passed.

An unknown-user request exposed a proxy bug: Last.fm's HTTP 404 was replaced
with HTTP 502 and `{"error":"Upstream API returned HTTP 404"}`. The proxy
must preserve the upstream status and body; no frontend workaround is included.
A missing-user request returned HTTP 400 with
`{"error":"Missing 'user' parameter"}` and wildcard CORS.

Inspection of the separate proxy checkout's `APIProxy/apis.yml` and
`APIProxy/lib/APIProxy.pm` also found:

- A fixed Last.fm upstream and server-side key injection. Only the configured
  five parameters are forwarded; client-supplied `api_key` is ignored.
- A 300-second memory cache per worker, without sharing across workers or
  persistence after restarts. HTTP-success bodies are cached, including any
  API error that Last.fm delivers with HTTP 200.
- A 30-second upstream timeout and a five-redirect limit.
- Required parameters checked for non-whitespace values, but no restriction on
  Last.fm method, period, count range or JSON format.
- No application authentication or rate limiter. Upstream HTTP 429 is currently
  wrapped as 502, losing the original body and rate-limit headers.

These source findings do not establish the deployed revision or prove live
cache hits/expiration. Identical repeated bodies alone cannot prove a cache hit;
the observed response has no cache-hit/age header.

Issue [#17](https://github.com/davorg/last-live/issues/17) remains open for error
pass-through, server-side restrictions, request limits/throttling, deployed cache
verification and a live empty-chart check. The existing offline tests cover
empty charts, numeric API errors, mocked HTTP 429 and retry without generating
live traffic to exhaust a rate limit.

After migration, replace the key previously published in direct browser builds,
update the proxy's server-side secret and retire the old key. Excluding it from
new frontend bundles does not revoke previous copies. Key rotation remains an
owner operation; this integration does not modify proxy secrets.
