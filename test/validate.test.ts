import { describe, expect, test } from "bun:test";

import { BraveSearch, BraveSearchError } from "../src/braveSearch";
import {
  validateLlmContextOptions,
  validatePlaceSearchOptions,
  validateSearchOptions,
  validateSummarizerOptions,
} from "../src/validate";

/** Edge cases and error branches that the flow tests do not reach. */

describe("search options", () => {
  test("rejects a negative or zero count", () => {
    expect(() => validateSearchOptions({ count: 0 })).toThrow(/between 1 and 20/);
    expect(() => validateSearchOptions({ count: -3 })).toThrow(/between 1 and 20/);
  });

  test("rejects a non-integer count", () => {
    expect(() => validateSearchOptions({ count: 2.5 })).toThrow(/integer/);
  });

  test("rejects a negative offset and an offset above 9", () => {
    expect(() => validateSearchOptions({ offset: -1 })).toThrow(/between 0 and 9/);
    expect(() => validateSearchOptions({ offset: 10 })).toThrow(/between 0 and 9/);
  });

  test("rejects non-string country and non-boolean flags", () => {
    expect(() => validateSearchOptions({ country: 42 })).toThrow(/country must be a string/);
    expect(() => validateSearchOptions({ spellcheck: "yes" })).toThrow(/must be a boolean/);
  });

  test("rejects an unknown safesearch level and an unknown unit system", () => {
    expect(() => validateSearchOptions({ safesearch: "high" })).toThrow(/safesearch must be one of/);
    expect(() => validateSearchOptions({ units: "kelvin" })).toThrow(/units must be one of/);
  });

  test("accepts a single start date and rejects a malformed range", () => {
    expect(validateSearchOptions({ freshness: "2024-05-01" })).toEqual({ freshness: "2024-05-01" });
    expect(() => validateSearchOptions({ freshness: "2024-05-01..2024-06-01" })).toThrow(/freshness must be/);
    expect(() => validateSearchOptions({ freshness: "2024-5-1" })).toThrow(/freshness must be/);
  });

  test("skips undefined fields instead of rejecting them", () => {
    expect(validateSearchOptions({ count: undefined, country: "GE" })).toEqual({ country: "GE" });
  });

  test("passes textual options through untouched", () => {
    expect(
      validateSearchOptions({
        country: "GE",
        search_lang: "ru",
        ui_lang: "ru-RU",
        goggles_id: "https://example.com/goggles",
        result_filter: "web,news",
      }),
    ).toEqual({
      country: "GE",
      search_lang: "ru",
      ui_lang: "ru-RU",
      goggles_id: "https://example.com/goggles",
      result_filter: "web,news",
    });
  });
});

describe("summarizer options", () => {
  test("accepts both documented flags and rejects a non-boolean", () => {
    expect(validateSummarizerOptions({ entity_info: true, inline_references: false })).toEqual({
      entity_info: true,
      inline_references: false,
    });
    expect(() => validateSummarizerOptions({ entity_info: 1 })).toThrow(/must be a boolean/);
  });
});

describe("place options", () => {
  test("accepts a location anchor with filters", () => {
    expect(
      validatePlaceSearchOptions({ q: "pharmacy", location: "batumi", count: 5, units: "metric" }),
    ).toEqual({ q: "pharmacy", location: "batumi", count: 5, units: "metric" });
  });

  test("rejects a non-number latitude", () => {
    expect(() => validatePlaceSearchOptions({ latitude: "41.6", longitude: 44.8 })).toThrow(/latitude/);
  });

  test("rejects unknown keys and bad radii", () => {
    expect(() => validatePlaceSearchOptions({ location: "x", near: "y" })).toThrow(/unknown place/);
    expect(() => validatePlaceSearchOptions({ location: "x", radius: 200_000 })).toThrow(/radius/);
    expect(() => validatePlaceSearchOptions({ location: "x", count: 21 })).toThrow(/count/);
  });

  test("rejects a bad safesearch or units value", () => {
    expect(() => validatePlaceSearchOptions({ location: "x", safesearch: "nope" })).toThrow(/safesearch/);
    expect(() => validatePlaceSearchOptions({ location: "x", units: "kelvin" })).toThrow(/units/);
  });

  test("rejects a non-boolean spellcheck and a malformed freshness", () => {
    expect(() => validatePlaceSearchOptions({ location: "x", spellcheck: "true" })).toThrow(/boolean/);
    expect(() => validatePlaceSearchOptions({ location: "x", freshness: "yesterday" })).toThrow(/freshness/);
  });

  test("rejects an empty location string", () => {
    expect(() => validatePlaceSearchOptions({ location: "" })).toThrow(/must not be empty/);
  });
});

describe("llm context options", () => {
  test("accepts a full option set", () => {
    expect(
      validateLlmContextOptions({
        country: "GE",
        search_lang: "en",
        ui_lang: "en-US",
        count: 10,
        maximum_number_of_tokens: 4096,
        context_threshold_mode: "lenient",
        safesearch: "moderate",
        freshness: "pw",
        spellcheck: true,
      }),
    ).toEqual({
      country: "GE",
      search_lang: "en",
      ui_lang: "en-US",
      count: 10,
      maximum_number_of_tokens: 4096,
      context_threshold_mode: "lenient",
      safesearch: "moderate",
      freshness: "pw",
      spellcheck: true,
    });
  });

  test("rejects bad counts, locales, flags and unknown keys", () => {
    expect(() => validateLlmContextOptions({ count: 51 })).toThrow(/count/);
    expect(() => validateLlmContextOptions({ country: 7 })).toThrow(/country/);
    expect(() => validateLlmContextOptions({ spellcheck: "off" })).toThrow(/boolean/);
    expect(() => validateLlmContextOptions({ bogus: 1 })).toThrow(/unknown llm context/);
    expect(() => validateLlmContextOptions({ safesearch: "x" })).toThrow(/safesearch/);
    expect(() => validateLlmContextOptions({ freshness: "soon" })).toThrow(/freshness/);
  });
});

describe("error mapping", () => {
  test("keeps Brave's error payload and adds a hint per status", async () => {
    const statuses: Array<[number, string]> = [
      [403, "Plan does not allow"],
      [404, "Not found"],
      [422, "Invalid parameters"],
      [500, "Brave Search server error"],
      [418, "API error"],
    ];

    for (const [status, hint] of statuses) {
      const server = Bun.serve({
        port: 0,
        fetch: () =>
          new Response(JSON.stringify({ error: { detail: "boom", code: "X" } }), {
            status,
            headers: { "content-type": "application/json" },
          }),
      });

      try {
        const client = new BraveSearch("key", { baseUrl: `http://127.0.0.1:${server.port}` });
        const error = (await client.webSearch("q").catch((e: unknown) => e)) as BraveSearchError;
        expect(error).toBeInstanceOf(BraveSearchError);
        expect(error.status).toBe(status);
        expect(error.message).toContain(hint);
      } finally {
        server.stop(true);
      }
    }
  });

  test("surfaces a plain-text error body without crashing", async () => {
    const server = Bun.serve({
      port: 0,
      fetch: () => new Response("bad gateway", { status: 502 }),
    });

    try {
      const client = new BraveSearch("key", { baseUrl: `http://127.0.0.1:${server.port}` });
      const error = (await client.webSearch("q").catch((e: unknown) => e)) as BraveSearchError;
      expect(error.status).toBe(502);
      expect(error.responseData).toBe("bad gateway");
    } finally {
      server.stop(true);
    }
  });
});

describe("remaining branches", () => {
  test("web options accept the boolean flags and skip undefined", () => {
    expect(
      validateSearchOptions({ text_decorations: false, spellcheck: true, extra_snippets: true, summary: true }),
    ).toEqual({ text_decorations: false, spellcheck: true, extra_snippets: true, summary: true });
    expect(validateSearchOptions({ offset: undefined, units: undefined })).toEqual({});
  });

  test("place options skip undefined and cover safesearch/units/freshness", () => {
    expect(validatePlaceSearchOptions({ location: "x", count: undefined })).toEqual({ location: "x" });
    expect(
      validatePlaceSearchOptions({ location: "x", safesearch: "off", units: "imperial", freshness: "pw" }),
    ).toEqual({ location: "x", safesearch: "off", units: "imperial", freshness: "pw" });
  });

  test("llm context options skip undefined", () => {
    expect(validateLlmContextOptions({ count: undefined })).toEqual({});
  });

  test("place options skip undefined values", () => {
    expect(validatePlaceSearchOptions({ location: "x", radius: undefined, spellcheck: undefined })).toEqual({
      location: "x",
    });
  });

  test("empty option objects pass through all three validators", () => {
    expect(validateSearchOptions({})).toEqual({});
    expect(validateLlmContextOptions({})).toEqual({});
    expect(validateSummarizerOptions({})).toEqual({});
  });

  test("non-string ids are rejected", () => {
    const client = new BraveSearch("key", { baseUrl: "http://127.0.0.1:1" });
    // @ts-expect-error deliberately wrong runtime input
    expect(() => client.localPoiSearch([42])).toThrow(/non-empty strings/);
  });
});

describe("abort before the first poll", () => {
  test("an already-aborted signal rejects the summary without a request", async () => {
    const server = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(
          JSON.stringify({ type: "search", query: { original: "q" }, summarizer: { key: "k" } }),
          { headers: { "content-type": "application/json" } },
        ),
    });

    try {
      const client = new BraveSearch("key", {
        baseUrl: `http://127.0.0.1:${server.port}`,
        pollInterval: 1000,
      });
      const controller = new AbortController();
      controller.abort();

      const { summary } = client.getSummarizedAnswer("q", {}, {}, { signal: controller.signal });
      // axios rejects the already-aborted request itself, before polling starts.
      await expect(summary).rejects.toThrow(/canceled|aborted/);
    } finally {
      server.stop(true);
    }
  });
});
