# Page Pulse

A small tool that audits any URL: HTTP status, response time, page title,
meta description, H1 count, images missing `alt` text, and an approximate
word count.

## Setup

Requires Node.js 18+.

```bash
npm install
npm start          # starts the server on http://localhost:3000
```

Open `http://localhost:3000` in a browser, paste a URL, click **Audit**.

Run the tests:

```bash
npm test
```

## API contract

### `GET /api/audit?url=<encoded URL>`

**Success (HTML page), `200`:**

```json
{
  "url": "https://example.com/",
  "httpStatus": 200,
  "responseTimeMs": 184,
  "contentType": "text/html; charset=UTF-8",
  "parsed": true,
  "title": "Example Domain",
  "metaDescription": null,
  "h1Count": 1,
  "imagesTotalCount": 0,
  "imagesMissingAltCount": 0,
  "wordCount": 28
}
```

**Success (reachable, non-HTML response — e.g. an image or JSON API), `200`:**

```json
{
  "url": "https://example.com/logo.png",
  "httpStatus": 200,
  "responseTimeMs": 90,
  "contentType": "image/png",
  "parsed": false,
  "note": "Response was not HTML, so page content could not be analyzed."
}
```

**Client error — bad input, `400`:**

```json
{ "error": "That does not look like a valid URL." }
```

**Upstream error — target unreachable, `502`:**

```json
{ "error": "Could not resolve host for https://this-domain-does-not-exist-xyz.com/", "responseTimeMs": 12 }
```

**Timeout, `504`:**

```json
{ "error": "Request to https://example.com/ timed out after 8000ms.", "responseTimeMs": 8001 }
```

Note that a target site returning its own error (e.g. a `404` or `500` page)
is **not** treated as a Page Pulse error — it's a successful audit that
reports what the target actually returned. `httpStatus` in the JSON reflects
the *target's* status code, not Page Pulse's own (Page Pulse's HTTP status
is always `200` in that case, since Page Pulse itself succeeded at auditing).

## Design decisions

**1. Parsing logic is a pure function, separate from network code.**
`lib/parser.js` exports `parseHtml(html)`, which takes a string and returns
a plain object — no `fetch`, no `axios`, no server. `server.js` is the only
place that touches the network. This means the parsing logic (the part with
actual "business logic" worth testing — title/meta/H1/alt-text/word-count
extraction) can be unit tested with plain HTML fixtures, instantly, with no
network flakiness. It also means a parsing bug and a network bug can never
be confused with each other when a test fails.

**2. "Reachable but not HTML" is a third outcome, not an error.**
A URL can be: (a) unreachable/invalid, (b) reachable and HTML (parseable),
or (c) reachable but not HTML — an image, a PDF, a JSON API, etc. Early on
it was tempting to lump (c) in with errors, but that's misleading: the URL
works fine, there's just nothing to analyze. So `parsed: false` with a
`note` field only. The frontend distinguishes this from a real failure
so users aren't told a working link is "broken."

**3. The target's HTTP status is surfaced, not swallowed.**
By default, `axios` throws on 4xx/5xx responses, which would make a page
returning its own `404` look identical to a DNS failure or a timeout. Page
Pulse sets `validateStatus: () => true` so it can inspect *any* response
from the target itself and report the real status code in `httpStatus`,
while reserving Page Pulse's own `4xx`/`5xx` responses for genuine Page
Pulse-side problems (bad input, timeout, connection failure). This keeps
"the audited site is broken" cleanly distinguishable from "auditing itself
failed."

## Known limitations

- Word count is approximate: it counts all visible text (nav, footer,
  boilerplate included), not just "article" content — that distinction
  would require heuristics (e.g. Readability-style content extraction)
  that were out of scope here.
- JavaScript-rendered (client-side SPA) pages will show whatever HTML the
  server returns before JS runs, since there's no headless browser here.
- No caching/rate limiting — this is a single-purpose audit tool, not a
  production crawler.
