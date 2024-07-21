# Brave Search API Wrapper

A fully typed Brave Search API wrapper, providing easy access to web search, local POI search, and automatic polling for AI-generated web search summary feature.

## Installation

### Using npm

Install the package using npm:

```shell
npm install brave-search
```

### Using jsr registry

If you prefer to use the jsr registry, you can add the package using the following commands:

```shell
npx jsr add @tyr/brave-search
```

## Importing the Package

### Using npm

Import the package in your project:

```typescript
import { BraveSearch } from "brave-search";
```

### Using jsr registry

If you are using the jsr registry, import the package as follows:

```typescript
import { BraveSearch } from "@tyr/brave-search/";
```

## Getting Started

1. Obtain a Brave Search API key from [Brave Search API Dashboard](https://api.search.brave.com/app/keys).

2. Install the package using one of the methods above.

3. Initialize the `BraveSearch` class:
   ```typescript
   const BRAVE_API_KEY = "your-api-key-here";
   const braveSearch = new BraveSearch(BRAVE_API_KEY);
   ```

## Usage

### Web Search

Perform a web search using the `webSearch` method. Your IDE will provide type hints for the parameters and return types.

```typescript
const webSearchResults = await braveSearch.webSearch("How many stars there are in our galaxy?", {
  count: 5,
  safesearch: "off",
  search_lang: "en",
  country: "US",
  text_decorations: false,
});
console.log(webSearchResults);
```

### Summarized Search

Get a summarized answer for a query using the `getSummarizedAnswer` method. This method returns an object containing `summary` and `webSearch` promises.

```typescript
const { summary, webSearch } = braveSearch.getSummarizedAnswer("How many stars there are in our galaxy?", {
  count: 5, // Number of search results to return
  safesearch: "off", // Optional: Filter for adult content (default is "moderate")
  search_lang: "en", // Optional: Language of the search results (default is "en")
  country: "US", // Optional: Country for the search results (default is "us")
  text_decorations: false, // Optional: Whether to include text decorations (default is true)
  spellcheck: false, // Optional: Whether to enable spellcheck (default is true)
  extra_snippets: true, // Optional: Whether to include extra snippets (default is false)
});

// Wait for the web search results (almost immediately)
const webSearchResponse = await webSearch;
console.log("Web Search Response:", JSON.stringify(webSearchResponse, null, 2));

// Wait for the summarized answer (can take up to couple of seconds)
const summarizedAnswer = await summary;
console.log("Summarized Answer:", JSON.stringify(summarizedAnswer, null, 2));
```

### Local POI Search

Search for local points of interest using the `localPoiSearch` method.

```typescript
const poiResults = await braveSearch.localPoiSearch(["poi_id1", "poi_id2"]);
console.log(poiResults);
```

### Local Descriptions Search

Get descriptions for local points of interest using the `localDescriptionsSearch` method.

```typescript
const descriptionResults = await braveSearch.localDescriptionsSearch(["poi_id1", "poi_id2"]);
console.log(descriptionResults);
```

## Search Options

The library supports various search options as defined in the Brave Search API documentation. For a complete list of options and their descriptions, please refer to the [Brave Search API Documentation](https://api.search.brave.com/app/documentation/web-search/).

### Polling Options

The `BraveSearch` class supports configurable polling options for summarization. You can customize the polling interval and the maximum number of polling attempts by passing a `PollingOptions` object to the constructor.

```typescript
const braveSearch = new BraveSearch(BRAVE_API_KEY, {
  pollInterval: 1000, // (default is 500ms)
  maxPollAttempts: 30, // (default is 20)
});
```

## Important Notes

- The `summary` option and `getSummarizedAnswer` method are only available with the Brave "Data for AI pro" plan.
- For detailed information about API usage, rate limits, and pricing, please visit the [Brave Search API Terms](https://brave.com/search/api/).

## API Reference

For detailed API reference, please refer to the [Brave Search API Documentation](https://api.search.brave.com/app/documentation/web-search/).

## Features

- Web search
- Automatic summarization with polling
- Local POI search
- Local descriptions search
- Error handling for API requests

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This library is not officially associated with Brave Software. It is a third-party implementation of the Brave Search API.
