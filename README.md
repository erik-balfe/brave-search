# Brave Search API Library

A TypeScript library for interacting with the Brave Search API, providing easy
access to web search, local POI search, and automatic summarization features.

## Installation

Install the package using npm:

```shell
npm install brave-search
```

## Getting Started

1. Obtain a Brave Search API key from
   [Brave Search API Dashboard](https://api.search.brave.com/app/keys).

2. Install the package:
   ```bash
   npm install brave-search
   ```

3. Import and initialize the `BraveSearch` class:
   ```typescript
   import { BraveSearch } from "brave-search";

   const BRAVE_API_KEY = "your-api-key-here";
   const braveSearch = new BraveSearch(BRAVE_API_KEY);
   ```

## Usage

### Web Search

Perform a web search:

```typescript
const webSearchResults = await braveSearch.webSearch("TypeScript tutorial", {
  count: 5,
  safesearch: "off",
  search_lang: "en",
  country: "US",
  text_decorations: false,
});
console.log(webSearchResults);
```

### Summarized Search

Get a summarized answer for a query (requires "Data for AI pro" plan):

```typescript
const { summary, webSearchResponse } = await braveSearch.getSummarizedAnswer(
  "What is TypeScript?",
  {
    count: 5,
    safesearch: "off",
    search_lang: "en",
    country: "US",
    text_decorations: false,
    freshness: "pw",
    spellcheck: false,
    extra_snippets: true,
    summary: true,
  },
);
console.log(summary);
console.log(webSearchResponse);
```

### Local POI Search

Search for local points of interest:

```typescript
const poiResults = await braveSearch.localPoiSearch("poi_id1", "poi_id2");
console.log(poiResults);
```

### Local Descriptions Search

Get descriptions for local points of interest:

```typescript
const descriptionResults = await braveSearch.localDescriptionsSearch(
  "poi_id1",
  "poi_id2",
);
console.log(descriptionResults);
```

### Search Options

The library supports various search options as defined in the Brave Search API
documentation. Here are some of the available options:

```typescript
interface BraveSearchOptions {
  country?: string;
  search_lang?: string;
  ui_lang?: string;
  safesearch?: "off" | "moderate" | "strict";
  freshness?: "pd" | "pw" | "pm" | "py" | string;
  text_decorations?: boolean;
  spellcheck?: boolean;
  goggles_id?: string;
  units?: "metric" | "imperial";
  extra_snippets?: boolean;
  count?: number;
  result_filter?: ResultFilterType;
  summary?: boolean;
}
```

For a complete list of options and their descriptions, please refer to the
[Brave Search API Documentation](https://api.search.brave.com/app/documentation/web-search/).

## Important Notes

- The `summary` option and `getSummarizedAnswer` method are only available with
  the Brave "Data for AI pro" plan.
- For detailed information about API usage, rate limits, and pricing, please
  visit the [Brave Search API Terms](https://brave.com/search/api/).

## API Reference

For detailed API reference, please refer to the
[Brave Search API Documentation](https://api.search.brave.com/app/documentation/web-search/).

## Features

- Web search
- Automatic summarization with polling
- Local POI search
- Local descriptions search
- Error handling for API requests

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the GNU General Public License v3.0 - see the
[LICENSE](LICENSE) file for details.

## Disclaimer

This library is not officially associated with Brave Software. It is a
third-party implementation of the Brave Search API.
