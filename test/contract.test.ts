import { describe, expect, test } from "bun:test";

import { BraveSearch } from "../src/braveSearch";
import { BraveSearchError } from "../src/braveSearch";

/**
 * Contract tests against the real Brave Search API.
 *
 * They require BRAVE_API_KEY and are skipped otherwise, so CI without a key
 * stays green. They exist to prove the types match the live payloads: if Brave
 * changes a shape, these fail instead of leaving a typed promise unverified.
 *
 *   BRAVE_API_KEY=... bun test test/contract.test.ts
 */
const KEY = process.env["BRAVE_API_KEY"] ?? "";
const run = KEY === "" ? test.skip : test;

const client = () => new BraveSearch(KEY, { baseUrl: "https://api.search.brave.com/res/v1" });

/** Fails with the API's own error detail instead of a mystery assertion. */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof BraveSearchError && error.status === 400) {
      const detail = (error.responseData as { error?: { detail?: string } } | undefined)?.error?.detail;
      throw new Error(`Brave rejected the request: ${detail ?? error.message}`);
    }
    throw error;
  }
}

describe("contract: web search", () => {
  run("returns a typed envelope with query and web results", async () => {
    const res = await call(() => client().webSearch("tallest mountain in the solar system", { count: 3 }));

    expect(res.type).toBe("search");
    expect(typeof res.query.original).toBe("string");
    expect(Array.isArray(res.web?.results)).toBe(true);

    const first = res.web?.results?.[0];
    expect(typeof first?.title).toBe("string");
    expect(typeof first?.url).toBe("string");
    expect(first?.url?.startsWith("http")).toBe(true);
    expect(typeof first?.description).toBe("string");
  });

  run("honours count and freshness without the server rejecting them", async () => {
    const res = await call(() => client().webSearch("ai news", { count: 5, freshness: "pw" }));
    expect((res.web?.results ?? []).length).toBeLessThanOrEqual(5);
  });

  run("returns extra snippets when asked", async () => {
    const res = await call(() => client().webSearch("rust programming language", { count: 3, extra_snippets: true }));
    const withSnippets = (res.web?.results ?? []).filter((r) => Array.isArray(r.extra_snippets));
    expect(withSnippets.length).toBeGreaterThan(0);
  });
});

describe("contract: other result types", () => {
  run("news search returns news_result items", async () => {
    const res = await call(() => client().newsSearch("technology", { count: 3 }));
    expect(res.type).toBe("news");
    expect(res.type).toBe("news");
    expect(typeof res.results?.[0]?.age).toBe("string");
  });

  run("image search returns image_result items with properties", async () => {
    const res = await call(() => client().imageSearch("golden gate bridge", { count: 3 }));
    expect(res.type).toBe("images");
    const first = res.results?.[0];
    expect(first?.type).toBe("image_result");
    expect(first?.properties).toBeDefined();
  });

  run("video search returns video_result items with a video block", async () => {
    const res = await call(() => client().videoSearch("cosmic desktop tour", { count: 3 }));
    expect(res.type).toBe("videos");
    expect(res.results?.[0]?.type).toBe("video_result");
    expect(res.results?.[0]?.video).toBeDefined();
  });
});

describe("contract: places", () => {
  run("place search by location name returns location_result items", async () => {
    const res = await call(() => client().placeSearch({ q: "sushi", location: "tbilisi" }));
    expect(res.type).toBe("locations");
    const first = res.results?.[0];
    expect(first?.type).toBe("location_result");
    expect(typeof first?.title).toBe("string");
    expect(first?.coordinates?.length).toBe(2);
  });

  run("place search by coordinates with a radius works", async () => {
    const res = await call(() =>
      client().placeSearch({ q: "coffee", latitude: 41.6938, longitude: 44.8015, radius: 1000 }),
    );
    expect(res.results?.length).toBeGreaterThan(0);
  });

  run("poi lookup by id returns the same place type as place search", async () => {
    const found = await call(() => client().placeSearch({ q: "sushi", location: "tbilisi" }));
    const id = found.results?.[0]?.id;
    expect(typeof id).toBe("string");

    const poi = await call(() => client().localPoiSearch([id as string]));
    expect(poi.type).toBe("local_pois");
    expect(poi.results?.[0]?.title).toBe(found.results?.[0]?.title);
  });
});

describe("contract: summarizer (deprecated, still live)", () => {
  run("web search with summary returns a summarizer key that resolves", async () => {
    const res = await call(() => client().webSearch("tallest mountain in solar system", { summary: true, count: 3 }));
    const key = res.summarizer?.key;
    expect(typeof key).toBe("string");

    const summary = await call(() => client().summarizerSearch(key as string, { inline_references: true }));
    expect(["complete", "pending"]).toContain(summary.status);

    if (summary.status === "complete") {
      expect(Array.isArray(summary.summary)).toBe(true);
      const parts = (summary.summary ?? []) as Array<{ type: string }>;
      const inlineRefs = parts.filter((part) => part.type === "inline_reference");
      expect(inlineRefs.length).toBeGreaterThan(0);
    }
  });
});

describe("contract: plan-gated endpoints", () => {
  run("llm/context either works or reports OPTION_NOT_IN_PLAN, never a crash", async () => {
    try {
      const res = await call(() => client().llmContext("what is the tallest mountain in the solar system"));
      expect(typeof res.grounding).toBe("object");
    } catch (error) {
      const braveError = error as BraveSearchError;
      // 400 with OPTION_NOT_IN_PLAN is a valid outcome for a Search-only key.
      // The helper rewraps plan rejections, so inspect the message and payload.
      expect(braveError.message).toContain("not included in the plan");
      expect(braveError.status === 400 || braveError.status === undefined).toBe(true);
    }
  });
});
