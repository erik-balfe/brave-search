# Brave Search API Wrapper

[![npm](https://img.shields.io/npm/v/brave-search.svg)](https://www.npmjs.com/package/brave-search)
[![JSR](https://jsr.io/badges/@tyr/brave-search)](https://jsr.io/@tyr/brave-search)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](LICENSE)

A typed wrapper for the Brave Search API. ESM and CJS, zero runtime dependencies.

## What Brave ships in 2026, and which method to use

Brave split its API into four products with different jobs. Picking the wrong one is
the usual reason an integration feels slow or expensive:

| You want | Endpoint | Method | Plan |
|---|---|---|---|
| Ranked links and snippets for a human | `/web/search` | `webSearch()` | Search |
| **Grounding context for a model** | `/llm/context` | `llmContext()` | Search + LLM Context |
| A finished answer with citations | `/chat/completions` (`model: "brave"`) | *not in this package* | Answers |
| News, images, videos | `/news/search`, `/images/search`, `/videos/search` | `newsSearch()`, `imageSearch()`, `videoSearch()` | Search |
| Businesses, landmarks, "near me" | `/local/place_search` | `placeSearch()` | Search |
| AI summary of a web query | `/summarizer/search` | `getSummarizedAnswer()` | **deprecated** |

If you are feeding a model, `llmContext()` is what Brave recommends: extracted,
relevance-scored passages and a token budget, instead of snippets you then have to fetch
and parse yourself. `webSearch()` stays the right call when a human reads the output, or
when you need the raw result shapes.

The Answers product is a separate plan and a separate response contract, so it is
deliberately not part of this package.

## Installation

```shell
npm install brave-search      # npm
bun add brave-search          # bun
npx jsr add @tyr/brave-search # jsr
```

```typescript
import { BraveSearch, SafeSearchLevel } from "brave-search";
// or from JSR: import { BraveSearch } from "@tyr/brave-search";
```

Get an API key at the [Brave Search API dashboard](https://api.search.brave.com/app/keys), then:

```typescript
const braveSearch = new BraveSearch(process.env.BRAVE_API_KEY!);
```

The constructor rejects an empty key, a negative `pollInterval`, and `maxPollAttempts < 1` immediately, so a misconfiguration fails at startup rather than on the first request.

## Web search

```typescript
const results = await braveSearch.webSearch("how many stars are in our galaxy", {
  count: 5,                       // 1..20
  offset: 0,                      // 0..9
  safesearch: SafeSearchLevel.Off,
  search_lang: "en",
  ui_lang: "en-US",
  country: "US",
  text_decorations: false,
  extra_snippets: true,
});
console.log(results.web?.results);
```

Options are validated before the request is made: `count` outside 1..20, `offset` outside 0..9, an unknown key, a bad `safesearch`/`units` value, or a malformed `freshness` throws a `BraveSearchError` without touching the network. This is what stops a typo from becoming a 422 from Brave in production.

## Grounding a model

```typescript
const context = await braveSearch.llmContext("what is the tallest mountain in the solar system", {
  maximum_number_of_tokens: 8000,        // 512 .. 32768
  context_threshold_mode: "balanced",    // strict | balanced | lenient
  freshness: "pm",
});

for (const source of context.grounding.sources ?? []) {
  console.log(source.url, source.age);
}
```

Requires a plan with LLM Context. A Search-only key answers with HTTP 400 and
`OPTION_NOT_IN_PLAN`, which arrives as a `BraveSearchError`, so a feature-detect is one
`try` away.

## Places

`placeSearch()` is the entry point for anything local since 2026: businesses, landmarks,
"near me".

```typescript
const nearby = await braveSearch.placeSearch({
  q: "coffee",
  latitude: 41.6938,
  longitude: 44.8015,
  radius: 1000,          // meters
  count: 10,
});

const inCity = await braveSearch.placeSearch({ q: "sushi", location: "tbilisi" });

// Explore mode: what is around here, no query
const around = await braveSearch.placeSearch({ latitude: 41.6938, longitude: 44.8015 });
```

Every result carries an `id`, which the detail endpoints accept:

```typescript
const id = nearby.results[0]?.id as string;
const poi = await braveSearch.localPoiSearch([id]);
const described = await braveSearch.localDescriptionsSearch([id]);
```

A call with `q` but no anchor is rejected client-side: Brave needs coordinates or a
location name to centre the search on.

## News, images, videos

```typescript
await braveSearch.newsSearch("Ghibli ChatGPT", { count: 5, freshness: "pw" });
await braveSearch.imageSearch("Golden Gate Bridge", { count: 5 });
await braveSearch.videoSearch("cosmic desktop tour", { count: 5 });
```

## AI summaries (deprecated upstream)

Brave deprecated the Summarizer API in favour of Answers. These methods still answer
today and are kept for existing callers, but new work should use `llmContext()` or the
Answers endpoint.

```typescript
const { webSearch, summary } = braveSearch.getSummarizedAnswer(
  "how many stars are in our galaxy",
  { count: 5 },
  { inline_references: true }, // keep source markers in the text
);

const results = await webSearch;   // arrives first
const answer = await summary;      // polled until ready, or throws
```

`summary` resolves to `undefined` when Brave does not offer a summary for the query. It throws when generation fails or when polling runs out of attempts.

Polling is configurable, and the summary of an earlier search can be fetched later without polling:

```typescript
const braveSearch = new BraveSearch(key, { pollInterval: 1000, maxPollAttempts: 30 });
const later = await braveSearch.summarizerSearch(storedKey, { entity_info: true });
```

## Cancellation and timeouts

Every method takes an optional third argument with `signal`, `timeout`, and `baseUrl`:

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 3000);

await braveSearch.webSearch("query", { count: 5 }, {
  signal: controller.signal,
  timeout: 5000,
});
```

An abort during summary polling stops the loop immediately instead of waiting out the interval.

## Errors

Every failure is a `BraveSearchError` with a `status` (undefined for network failures) and the parsed `responseData`:

```typescript
import { BraveSearchError } from "brave-search";

try {
  await braveSearch.webSearch("query");
} catch (error) {
  if (error instanceof BraveSearchError) {
    if (error.status === 429) {
      // back off and retry
    }
    console.error(error.message, error.status, error.responseData);
  }
}
```

`401` → authentication, `403` → plan does not allow the endpoint, `422` → invalid parameters, `429` → rate limit, `5xx` → Brave-side failure.

## Options reference

`webSearch()`, `newsSearch()`, `imageSearch()`, `videoSearch()`:

| Option | Notes |
|---|---|
| `count` | 1..20, results per page |
| `offset` | 0..9, pages to skip |
| `safesearch` | `off`, `moderate`, `strict` |
| `freshness` | `pd`, `pw`, `pm`, `py`, `YYYY-MM-DDtoYYYY-MM-DD`, or `YYYY-MM-DD` |
| `units` | `metric`, `imperial` |
| `result_filter` | comma-separated result types |
| `goggles_id` | custom re-ranking |
| `summary` | enables the summarizer key in the response |

`placeSearch()`: `q`, `location`, `latitude` + `longitude` (both or neither), `radius`
(1..100000 m), `count` (1..20), `units`, `safesearch`, `spellcheck`, `freshness`.

`llmContext()`: `maximum_number_of_tokens` (512..32768), `context_threshold_mode`
(`strict`/`balanced`/`lenient`), `count` (1..50), locale and freshness filters.

Full parameter semantics live in the [Brave Search API documentation](https://api.search.brave.com/app/documentation/web-search/).

## Notes

- The deprecated summary path needs a plan that still offers Summarizer.
- LLM Context needs a plan that includes it; a Search-only key gets `OPTION_NOT_IN_PLAN`.
- If you want a ready-made agent tool rather than a library, Brave publishes [`@brave/brave-search-mcp-server`](https://www.npmjs.com/package/@brave/brave-search-mcp-server). This package is the wrapper you call from your own code.
- Not affiliated with Brave Software.

## Development

Bun 1.4.x runs everything: install, type check, tests, build, version bump.

```shell
bun install
bun check               # type check (bun's built-in checker)
bun test                # 64 unit tests, no network
bun test:coverage       # same with a coverage table
bun run build           # ESM + CJS + .d.ts into dist/
```

Contract tests hit the live API and are skipped without a key:

```shell
BRAVE_API_KEY=... bun test test/contract.test.ts
```

They assert the real payload shapes and that every documented option is accepted by the
server, so a silent API change fails a test instead of shipping a wrong type. On a
Search-only plan the LLM Context check accepts a plan rejection and asserts it arrives as
a `BraveSearchError`.

Publishing runs on a `v*` tag: CI checks bun's type checker, the test suite, the build and
`bun audit`, then publishes to npm and JSR. A bump rewrites `package.json` and `deno.json`
together, so the two registries cannot drift:

```shell
bun run release:patch   # or release:minor / release:major
git tag v$(bun -e 'console.log(JSON.parse(await Bun.file("package.json").text()).version)')
git push --tags
```

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
