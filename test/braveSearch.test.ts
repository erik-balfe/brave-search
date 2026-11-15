import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { BraveSearch, BraveSearchError } from "../src/braveSearch";
import { validateSearchOptions, validateSummarizerOptions } from "../src/validate";
import { SafeSearchLevel } from "../src/types";

/** A throwaway HTTP server that records the last request it received. */
interface Recorded {
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
}

const recorded: Recorded[] = [];
let server: ReturnType<typeof Bun.serve>;
let baseUrl = "";

/** Response queue: each request shifts one entry. */
let queue: Array<{ status: number; body: unknown }> = [];

function nextResponse(): { status: number; body: unknown } {
  return queue.shift() ?? { status: 200, body: { type: "search", query: { original: "x" } } };
}

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      const query: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        query[key] = value;
      });
      const headers: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        headers[key] = value;
      });
      recorded.push({ path: url.pathname, query, headers });

      const { status, body } = nextResponse();
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    },
  });
  baseUrl = `http://127.0.0.1:${server.port}`;
});

afterAll(() => {
  server.stop(true);
});

describe("constructor", () => {
  test("rejects an empty API key", () => {
    expect(() => new BraveSearch("")).toThrow(BraveSearchError);
    expect(() => new BraveSearch("   ")).toThrow(BraveSearchError);
  });

  test("rejects negative polling values", () => {
    expect(() => new BraveSearch("key", { pollInterval: -1 })).toThrow(BraveSearchError);
    expect(() => new BraveSearch("key", { maxPollAttempts: 0 })).toThrow(BraveSearchError);
  });

  test("accepts a custom base url and trims the trailing slash", async () => {
    recorded.length = 0;
    const client = new BraveSearch("key", { baseUrl: `${baseUrl}/` });
    await client.webSearch("hello");
    expect(recorded[0]?.path).toBe("/web/search");
  });
});

describe("webSearch", () => {
  test("sends the query, headers and validated options", async () => {
    recorded.length = 0;
    const client = new BraveSearch("secret-key", { baseUrl });
    await client.webSearch("galaxy stars", { count: 5, safesearch: SafeSearchLevel.Off, extra_snippets: true });

    const req = recorded[0];
    expect(req?.path).toBe("/web/search");
    expect(req?.query["q"]).toBe("galaxy stars");
    expect(req?.query["count"]).toBe("5");
    expect(req?.query["safesearch"]).toBe("off");
    expect(req?.query["extra_snippets"]).toBe("true");
    expect(req?.headers["x-subscription-token"]).toBe("secret-key");
  });

  test("drops undefined options instead of serializing them", async () => {
    recorded.length = 0;
    const client = new BraveSearch("key", { baseUrl });
    await client.webSearch("q", { country: "US" });

    expect(recorded[0]?.query["count"]).toBeUndefined();
    expect(Object.keys(recorded[0]?.query ?? {})).not.toContain("count");
    expect(recorded[0]?.query["country"]).toBe("US");
  });
});

describe("validation", () => {
  test("rejects count above the documented maximum before any request", () => {
    const client = new BraveSearch("key", { baseUrl });
    recorded.length = 0;
    expect(() => client.webSearch("q", { count: 500 })).toThrow(BraveSearchError);
    expect(recorded.length).toBe(0);
  });

  test("rejects a non-integer offset", () => {
    expect(() => validateSearchOptions({ offset: 1.5 })).toThrow(BraveSearchError);
  });

  test("rejects an unknown option key", () => {
    expect(() => validateSearchOptions({ contry: "US" })).toThrow(/unknown search option/);
  });

  test("accepts freshness shortcuts and date ranges only", () => {
    expect(validateSearchOptions({ freshness: "pw" })).toEqual({ freshness: "pw" });
    expect(validateSearchOptions({ freshness: "2024-01-01to2024-12-31" })).toEqual({
      freshness: "2024-01-01to2024-12-31",
    });
    expect(() => validateSearchOptions({ freshness: "last week" })).toThrow(BraveSearchError);
  });

  test("accepts inline_references for the summarizer", () => {
    expect(validateSummarizerOptions({ inline_references: true })).toEqual({
      inline_references: true,
    });
    expect(() => validateSummarizerOptions({ nope: true })).toThrow(BraveSearchError);
  });
});

describe("errors", () => {
  test("maps 429 to a rate-limit message and keeps the status", async () => {
    queue = [{ status: 429, body: { message: "Too many requests" } }];
    const client = new BraveSearch("key", { baseUrl });
    const error = await client.webSearch("q").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BraveSearchError);
    const braveError = error as BraveSearchError;
    expect(braveError.status).toBe(429);
    expect(braveError.message).toContain("Rate limit exceeded");
    expect(braveError.message).toContain("Too many requests");
    expect(braveError.responseData).toEqual({ message: "Too many requests" });
  });

  test("maps 401 to an authentication message", async () => {
    queue = [{ status: 401, body: { message: "Invalid token" } }];
    const client = new BraveSearch("key", { baseUrl });
    const error = (await client.webSearch("q").catch((e: unknown) => e)) as BraveSearchError;

    expect(error.status).toBe(401);
    expect(error.message).toContain("Authentication error");
  });

  test("maps a network failure without a response to a network message", async () => {
    const client = new BraveSearch("key", { baseUrl: "http://127.0.0.1:1" });
    const error = (await client.webSearch("q").catch((e: unknown) => e)) as BraveSearchError;

    expect(error).toBeInstanceOf(BraveSearchError);
    expect(error.status).toBeUndefined();
    expect(error.message).toContain("Network error");
  });

  test("rejects localPoiSearch with empty ids without touching the network", () => {
    recorded.length = 0;
    const client = new BraveSearch("key", { baseUrl });
    expect(() => client.localPoiSearch([])).toThrow(BraveSearchError);
    expect(recorded.length).toBe(0);
  });
});

describe("summaries", () => {
  test("polls until the summary is complete", async () => {
    queue = [
      { status: 200, body: { type: "search", query: { original: "q" }, summarizer: { key: "k1" } } },
      { status: 200, body: { status: "pending" } },
      { status: 200, body: { status: "complete", summary: [{ type: "token", data: "ok" }] } },
    ];
    const client = new BraveSearch("key", { baseUrl, pollInterval: 0, maxPollAttempts: 5 });
    const { summary } = client.getSummarizedAnswer("q");
    const result = await summary;

    expect(result?.status).toBe("complete");
  });

  test("asks for a summary in the original web search", async () => {
    recorded.length = 0;
    queue = [{ status: 200, body: { type: "search", query: { original: "q" } } }];
    const client = new BraveSearch("key", { baseUrl });
    const { webSearch, summary } = client.getSummarizedAnswer("q");

    await webSearch;
    expect(await summary).toBeUndefined();
    expect(recorded[0]?.query["summary"]).toBe("true");
  });

  test("throws when the summary fails", async () => {
    queue = [
      { status: 200, body: { type: "search", query: { original: "q" }, summarizer: { key: "k" } } },
      { status: 200, body: { status: "failed" } },
    ];
    const client = new BraveSearch("key", { baseUrl, pollInterval: 0 });
    const { summary } = client.getSummarizedAnswer("q");

    await expect(summary).rejects.toThrow(/Summary generation failed/);
  });

  test("gives up after maxPollAttempts", async () => {
    queue = [
      { status: 200, body: { type: "search", query: { original: "q" }, summarizer: { key: "k" } } },
      { status: 200, body: { status: "pending" } },
      { status: 200, body: { status: "pending" } },
    ];
    const client = new BraveSearch("key", { baseUrl, pollInterval: 0, maxPollAttempts: 2 });
    const { summary } = client.getSummarizedAnswer("q");

    await expect(summary).rejects.toThrow(/maximum polling attempts/);
  });

  test("passes inline_references through to the summarizer endpoint", async () => {
    recorded.length = 0;
    queue = [
      { status: 200, body: { type: "search", query: { original: "q" }, summarizer: { key: "k" } } },
      { status: 200, body: { status: "complete", summary: [] } },
    ];
    const client = new BraveSearch("key", { baseUrl, pollInterval: 0 });
    const { summary } = client.getSummarizedAnswer("q", {}, { inline_references: true });
    await summary;

    const summarizerCall = recorded.find((r) => r.path === "/summarizer/search");
    expect(summarizerCall?.query["inline_references"]).toBe("true");
  });
});

describe("abort", () => {
  test("stops polling when the signal aborts", async () => {
    queue = [
      { status: 200, body: { type: "search", query: { original: "q" }, summarizer: { key: "k" } } },
      { status: 200, body: { status: "pending" } },
      { status: 200, body: { status: "pending" } },
      { status: 200, body: { status: "pending" } },
    ];
    const controller = new AbortController();
    const client = new BraveSearch("key", { baseUrl, pollInterval: 50, maxPollAttempts: 50 });
    const { summary } = client.getSummarizedAnswer("q", {}, {}, { signal: controller.signal });

    setTimeout(() => controller.abort(), 20);
    await expect(summary).rejects.toThrow(/aborted/);
  });
});
