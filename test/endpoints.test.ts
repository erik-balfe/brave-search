import { beforeEach, describe, expect, test } from "bun:test";

import { BraveSearch, BraveSearchError } from "../src/braveSearch";
import { validateLlmContextOptions, validatePlaceSearchOptions } from "../src/validate";

interface Recorded {
  path: string;
  query: Record<string, string>;
}

const recorded: Recorded[] = [];
let server: ReturnType<typeof Bun.serve>;
let baseUrl = "";
let nextBody: unknown = {};

beforeToday();

function beforeToday() {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      const query: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        query[key] = value;
      });
      recorded.push({ path: url.pathname, query });
      return new Response(JSON.stringify(nextBody), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  baseUrl = `http://127.0.0.1:${server.port}`;
}

beforeEach(() => {
  recorded.length = 0;
  nextBody = {};
});

describe("videoSearch", () => {
  test("hits the videos endpoint and passes options through", async () => {
    const client = new BraveSearch("key", { baseUrl });
    await client.videoSearch("cosmic desktop", { count: 3, freshness: "pw" });

    expect(recorded[0]?.path).toBe("/videos/search");
    expect(recorded[0]?.query["q"]).toBe("cosmic desktop");
    expect(recorded[0]?.query["count"]).toBe("3");
    expect(recorded[0]?.query["freshness"]).toBe("pw");
  });
});

describe("placeSearch", () => {
  test("hits the place_search endpoint with a location anchor", async () => {
    const client = new BraveSearch("key", { baseUrl });
    await client.placeSearch({ q: "coffee", location: "tbilisi" });

    expect(recorded[0]?.path).toBe("/local/place_search");
    expect(recorded[0]?.query["q"]).toBe("coffee");
    expect(recorded[0]?.query["location"]).toBe("tbilisi");
  });

  test("passes coordinates and radius as numbers", async () => {
    const client = new BraveSearch("key", { baseUrl });
    await client.placeSearch({ q: "sushi", latitude: 41.6938, longitude: 44.8015, radius: 500 });

    const q = recorded[0]?.query ?? {};
    expect(q["latitude"]).toBe("41.6938");
    expect(q["longitude"]).toBe("44.8015");
    expect(q["radius"]).toBe("500");
  });

  test("explore mode works without a query", async () => {
    const client = new BraveSearch("key", { baseUrl });
    await client.placeSearch({ latitude: 41.6938, longitude: 44.8015 });

    expect(recorded[0]?.path).toBe("/local/place_search");
    expect(recorded[0]?.query["q"]).toBeUndefined();
  });

  test("rejects an anchor-less call before the network", () => {
    const client = new BraveSearch("key", { baseUrl });
    expect(() => client.placeSearch({ q: "coffee" })).toThrow(/needs a location or latitude\+longitude/);
    expect(recorded.length).toBe(0);
  });

  test("rejects latitude without longitude", () => {
    expect(() => validatePlaceSearchOptions({ q: "x", latitude: 41.6 })).toThrow(/together/);
  });

  test("rejects out of range coordinates and radius", () => {
    expect(() => validatePlaceSearchOptions({ latitude: 91, longitude: 0 })).toThrow(/latitude/);
    expect(() => validatePlaceSearchOptions({ latitude: 0, longitude: 181 })).toThrow(/longitude/);
    expect(() => validatePlaceSearchOptions({ q: "x", location: "y", radius: 0 })).toThrow(/radius/);
  });
});

describe("llmContext", () => {
  test("hits the llm context endpoint with the token budget", async () => {
    nextBody = { grounding: { generic: [], sources: [] } };
    const client = new BraveSearch("key", { baseUrl });
    await client.llmContext("what is the tallest mountain", {
      maximum_number_of_tokens: 8000,
      context_threshold_mode: "strict",
    });

    expect(recorded[0]?.path).toBe("/llm/context");
    expect(recorded[0]?.query["maximum_number_of_tokens"]).toBe("8000");
    expect(recorded[0]?.query["context_threshold_mode"]).toBe("strict");
  });

  test("clamps the token budget and rejects an unknown threshold mode", () => {
    expect(() => validateLlmContextOptions({ maximum_number_of_tokens: 100 })).toThrow(/between/);
    expect(() => validateLlmContextOptions({ maximum_number_of_tokens: 100_000 })).toThrow(/between/);
    expect(() => validateLlmContextOptions({ context_threshold_mode: "greedy" })).toThrow(/strict/);
  });

  test("surfaces a plan rejection as a BraveSearchError with the server detail", async () => {
    const client = new BraveSearch("key", { baseUrl: "http://127.0.0.1:1" });
    const error = (await client.llmContext("q").catch((e: unknown) => e)) as BraveSearchError;
    expect(error).toBeInstanceOf(BraveSearchError);
  });
});

describe("deprecation surface", () => {
  test("summarizer methods still exist and work", async () => {
    nextBody = { type: "summarizer", status: "complete", summary: [] };
    const client = new BraveSearch("key", { baseUrl });
    const res = await client.summarizerSearch("key-1", { inline_references: true });

    expect(res.status).toBe("complete");
    expect(recorded[0]?.path).toBe("/summarizer/search");
    expect(recorded[0]?.query["inline_references"]).toBe("true");
  });
});

describe("coverage of every documented endpoint", () => {
  test("imageSearch hits the images endpoint", async () => {
    const client = new BraveSearch("key", { baseUrl });
    await client.imageSearch("bridge", { count: 2 });
    expect(recorded[0]?.path).toBe("/images/search");
    expect(recorded[0]?.query["count"]).toBe("2");
  });

  test("newsSearch hits the news endpoint", async () => {
    const client = new BraveSearch("key", { baseUrl });
    await client.newsSearch("elections", { freshness: "pd" });
    expect(recorded[0]?.path).toBe("/news/search");
    expect(recorded[0]?.query["freshness"]).toBe("pd");
  });

  test("localDescriptionsSearch hits the descriptions endpoint", async () => {
    const client = new BraveSearch("key", { baseUrl });
    await client.localDescriptionsSearch(["id-1", "id-2"]);
    expect(recorded[0]?.path).toBe("/local/descriptions");
    expect(recorded[0]?.query["ids"]).toBe("id-1,id-2");
  });

  test("localPoiSearch joins ids and rejects blank entries", async () => {
    const client = new BraveSearch("key", { baseUrl });
    await client.localPoiSearch(["a", "b"]);
    expect(recorded[0]?.query["ids"]).toBe("a,b");

    expect(() => client.localPoiSearch(["a", " "])).toThrow(/non-empty strings/);
    expect(() => client.localPoiSearch([])).toThrow(/non-empty array/);
  });

  test("summarizerSearch rejects an empty key", () => {
    const client = new BraveSearch("key", { baseUrl });
    expect(() => client.summarizerSearch("  ")).toThrow(/summarizer key is required/);
  });

  test("a per-call baseUrl overrides the constructor one", async () => {
    const client = new BraveSearch("key", { baseUrl: "http://127.0.0.1:1" });
    await client.webSearch("q", {}, { baseUrl });
    expect(recorded[0]?.path).toBe("/web/search");
  });

  test("a timeout is forwarded and produces a network error when it fires", async () => {
    const slow = Bun.serve({
      port: 0,
      async fetch() {
        await Bun.sleep(300);
        return new Response("{}", { status: 200 });
      },
    });

    try {
      const client = new BraveSearch("key", { baseUrl: `http://127.0.0.1:${slow.port}` });
      const error = (await client
        .webSearch("q", {}, { timeout: 30 })
        .catch((e: unknown) => e)) as BraveSearchError;

      expect(error).toBeInstanceOf(BraveSearchError);
      expect(error.message).toContain("Network error");
    } finally {
      slow.stop(true);
    }
  });
});
