// Copyright (C) 2024 Erik Balfe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import axios from "axios";

import {
  validateLlmContextOptions,
  validatePlaceSearchOptions,
  validateSearchOptions,
  validateSummarizerOptions,
} from "./validate";

const DEFAULT_POLLING_INTERVAL = 500;
const DEFAULT_MAX_POLL_ATTEMPTS = 20;

import type {
  BraveSearchOptions,
  ImageSearchApiResponse,
  ImageSearchOptions,
  LocalDescriptionsSearchApiResponse,
  LocalPoiSearchApiResponse,
  NewsSearchApiResponse,
  NewsSearchOptions,
  PollingOptions,
  SummarizerOptions,
  SummarizerSearchApiResponse,
  WebSearchApiResponse,
} from "./types";

import type {
  LlmContextApiResponse,
  LlmContextOptions,
  PlaceSearchApiResponse,
  PlaceSearchOptions,
  VideoSearchApiResponse,
  VideoSearchOptions,
} from "./types-2026";

/**
 * An error class specific to BraveSearch API interactions.
 * It includes additional information about the response data that caused the error.
 */
export class BraveSearchError extends Error {
  /** HTTP status of the failed request, when there was one. */
  public readonly status: number | undefined;
  /** Parsed body of the failed response, when there was one. */
  public readonly responseData: unknown;

  constructor(message: string, responseData?: unknown, status?: number) {
    super(message);
    this.name = "BraveSearchError";
    this.responseData = responseData;
    this.status = status;
  }
}

/** Per-request controls that are not search parameters. */
export interface RequestOptions {
  /** Abort the request. */
  signal?: AbortSignal;
  /** Override the API base URL, e.g. for a proxy or a test server. */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. */
  timeout?: number;
}

interface RequestParams {
  [key: string]: string | number | boolean | undefined;
}


/**
 * The main class for interacting with the Brave Search API, holding API key for all the requests made with it.
 * It provides methods for web search, image search, local POI search, and summarization.
 */
export class BraveSearch {
  private apiKey: string;
  private baseUrl = "https://api.search.brave.com/res/v1";
  private pollInterval: number;
  private maxPollAttempts: number;

  /**
   * Initializes a new instance of the BraveSearch class.
   * @param apiKey The API key for accessing the Brave Search API.
   * @param options
   */
  constructor(apiKey: string, options: PollingOptions = {}) {
    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      throw new BraveSearchError("A non-empty Brave Search API key is required");
    }
    if (options.pollInterval !== undefined && options.pollInterval < 0) {
      throw new BraveSearchError("pollInterval must not be negative");
    }
    if (options.maxPollAttempts !== undefined && options.maxPollAttempts < 1) {
      throw new BraveSearchError("maxPollAttempts must be at least 1");
    }

    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.search.brave.com/res/v1").replace(/\/+$/, "");
    this.pollInterval = options.pollInterval ?? DEFAULT_POLLING_INTERVAL;
    this.maxPollAttempts = options.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;
  }

  /**
   * Performs a web search using the provided query and options.
   * @param query The search query string.
   * @param options Optional settings to configure the search behavior.
   * @param request Optional request controls (signal, timeout, baseUrl).
   * @returns A promise that resolves to the search results.
   */
  webSearch(
    query: string,
    options: BraveSearchOptions = {},
    request: RequestOptions = {},
  ): Promise<WebSearchApiResponse> {
    return this.request<WebSearchApiResponse>(
      "/web/search",
      { q: query, ...validateSearchOptions(options) },
      request,
    );
  }

  /**
   * Performs an image search using the provided query and options.
   * @param query The search query string.
   * @param options Optional settings to configure the search behavior.
   * @param request Optional request controls (signal, timeout, baseUrl).
   * @returns A promise that resolves to the image search results.
   */
  imageSearch(
    query: string,
    options: ImageSearchOptions = {},
    request: RequestOptions = {},
  ): Promise<ImageSearchApiResponse> {
    return this.request<ImageSearchApiResponse>(
      "/images/search",
      { q: query, ...validateSearchOptions(options) },
      request,
    );
  }

  /**
   * Performs a news search using the provided query and options.
   * @param query The search query string.
   * @param options Optional settings to configure the search behavior.
   * @param request Optional request controls (signal, timeout, baseUrl).
   * @returns A promise that resolves to the news search results.
   */
  newsSearch(
    query: string,
    options: NewsSearchOptions = {},
    request: RequestOptions = {},
  ): Promise<NewsSearchApiResponse> {
    return this.request<NewsSearchApiResponse>(
      "/news/search",
      { q: query, ...validateSearchOptions(options) },
      request,
    );
  }

  /**
   * Performs a video search.
   * @param query The search query string.
   * @param options Optional settings to configure the search behavior.
   * @param request Optional request controls (signal, timeout, baseUrl).
   */
  videoSearch(
    query: string,
    options: VideoSearchOptions = {},
    request: RequestOptions = {},
  ): Promise<VideoSearchApiResponse> {
    return this.request<VideoSearchApiResponse>(
      "/videos/search",
      { q: query, ...validateSearchOptions({ ...options }) },
      request,
    );
  }

  /**
   * Searches places in the physical world: businesses, landmarks, buildings.
   *
   * This is the entry point for local results since 2026. Anchor it with
   * `latitude`/`longitude` and a `radius`, or with a freeform `location` name.
   * Omit `q` for Explore mode: a snapshot of what is around the anchor.
   *
   * Every result carries an `id` that `localPoiSearch` and
   * `localDescriptionsSearch` accept for detail and AI-written descriptions.
   *
   * @param options Query, anchor and filters.
   * @param request Optional request controls (signal, timeout, baseUrl).
   */
  placeSearch(
    options: PlaceSearchOptions = {},
    request: RequestOptions = {},
  ): Promise<PlaceSearchApiResponse> {
    return this.request<PlaceSearchApiResponse>(
      "/local/place_search",
      validatePlaceSearchOptions(options),
      request,
    );
  }

  /**
   * Retrieves pre-extracted, relevance-scored page content shaped for a model,
   * instead of result snippets meant for a human. This is what Brave recommends
   * for grounding an LLM.
   *
   * Requires a plan that includes LLM Context; a Search-only key answers with
   * HTTP 400 and code `OPTION_NOT_IN_PLAN`, surfaced as a BraveSearchError.
   *
   * @param query The search query string.
   * @param options Token budget, threshold mode and locale filters.
   * @param request Optional request controls (signal, timeout, baseUrl).
   */
  llmContext(
    query: string,
    options: LlmContextOptions = {},
    request: RequestOptions = {},
  ): Promise<LlmContextApiResponse> {
    return this.request<LlmContextApiResponse>(
      "/llm/context",
      { q: query, ...validateLlmContextOptions(options) },
      request,
    );
  }

  /**
   * Executes a web search for the provided query and polls for a summary
   * if the query is eligible for a summary and a summarizer key is present.
   *
   * @deprecated Brave deprecated the Summarizer API in favour of Answers
   * (`/res/v1/chat/completions`, `model: "brave"`), which returns a finished
   * answer with citations in one call. The summarizer still answers today, but
   * new integrations should use Answers. Kept for existing callers; expect this
   * path to disappear from the API before long.
   *
   * @param query The search query string.
   * @param options Optional settings to configure the search behavior.
   * @param summarizerOptions Optional settings specific to summarization.
   * @returns An object containing promises for the web search results and the summarized answer.
   */
  getSummarizedAnswer(
    query: string,
    options: Omit<BraveSearchOptions, "summary"> = {},
    summarizerOptions: SummarizerOptions = {},
    request: RequestOptions = {},
  ): {
    summary: Promise<SummarizerSearchApiResponse | undefined>;
    webSearch: Promise<WebSearchApiResponse>;
  } {
    const webSearch = this.webSearch(query, { ...options, summary: true }, request);

    const summary = webSearch.then(async (response) => {
      const summarizerKey = response.summarizer?.key;
      if (!summarizerKey) {
        return undefined;
      }
      return this.pollForSummary(summarizerKey, summarizerOptions, request);
    });

    return { webSearch, summary };
  }

  /**
   * Searches for local points of interest using the provided IDs.
   * @param ids The IDs of the local points of interest.
   * @param request Optional request controls (signal, timeout, baseUrl).
   * @returns A promise that resolves to the search results.
   */
  localPoiSearch(ids: string[], request: RequestOptions = {}): Promise<LocalPoiSearchApiResponse> {
    return this.request<LocalPoiSearchApiResponse>(
      "/local/pois",
      { ids: validateIds(ids) },
      request,
    );
  }

  /**
   * Retrieves descriptions for local points of interest using the provided IDs.
   * @param ids The IDs of the local points of interest.
   * @param request Optional request controls (signal, timeout, baseUrl).
   * @returns A promise that resolves to the search results.
   */
  localDescriptionsSearch(
    ids: string[],
    request: RequestOptions = {},
  ): Promise<LocalDescriptionsSearchApiResponse> {
    return this.request<LocalDescriptionsSearchApiResponse>(
      "/local/descriptions",
      { ids: validateIds(ids) },
      request,
    );
  }

  /**
   * Polls for a summary response after a web search request. This method is suggested by the Brave Search API documentation
   * as the way to retrieve a summary after initiating a web search.
   *
   * @param key The key identifying the summary request.
   * @param options Optional settings specific to summarization.
   * @param signal Optional AbortSignal to cancel the request.
   * @returns A promise that resolves to the summary response if available, or undefined if the summary is not ready.
   * @throws {BraveSearchError} If the summary generation fails or if the summary is not available after maximum polling attempts.
   *
   * **Polling Behavior:**
   * - The method will make up to 20 attempts to fetch the summary by default.
   * - Each attempt is spaced 500ms apart.
   * - If the summary is not ready after 20 attempts, a BraveSearchError is thrown.
   *
   * **Configuration:**
   * - The number of attempts and the interval between attempts can be configured through the class constructor options.
   */
  private async pollForSummary(
    key: string,
    options: SummarizerOptions,
    request: RequestOptions,
  ): Promise<SummarizerSearchApiResponse | undefined> {
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
      const summaryResponse = await this.summarizerSearch(key, options, request);

      if (summaryResponse.status === "complete" && summaryResponse.summary) {
        return summaryResponse;
      } else if (summaryResponse.status === "failed") {
        throw new BraveSearchError("Summary generation failed");
      }

      await sleep(this.pollInterval, request.signal);
    }

    throw new BraveSearchError("Summary not available after maximum polling attempts");
  }

  /**
   * Fetches an existing AI summary by its key, without polling.
   *
   * @deprecated Part of the deprecated Summarizer API. Use Answers
   * (`/res/v1/chat/completions`, `model: "brave"`) for new work.
   *
   * @param key The summarizer key returned by a web search.
   * @param options Optional settings specific to summarization.
   * @param request Optional request controls (signal, timeout, baseUrl).
   */
  summarizerSearch(
    key: string,
    options: SummarizerOptions = {},
    request: RequestOptions = {},
  ): Promise<SummarizerSearchApiResponse> {
    if (typeof key !== "string" || key.trim() === "") {
      throw new BraveSearchError("A summarizer key is required");
    }
    return this.request<SummarizerSearchApiResponse>(
      "/summarizer/search",
      { key, ...validateSummarizerOptions(options) },
      request,
    );
  }

  /** Single place that talks to the network. Every public method delegates here. */
  private async request<T>(
    path: string,
    params: RequestParams,
    request: RequestOptions,
  ): Promise<T> {
    const baseUrl = request.baseUrl ? request.baseUrl.replace(/\/+$/, "") : this.baseUrl;

    try {
      const response = await axios.get<T>(`${baseUrl}${path}`, {
        params: stripUndefined(params),
        headers: this.headers(),
        ...(request.signal !== undefined ? { signal: request.signal } : {}),
        ...(request.timeout !== undefined ? { timeout: request.timeout } : {}),
      });
      return response.data;
    } catch (error) {
      throw toBraveSearchError(error);
    }
  }

  private headers(): Record<string, string> {
    return {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": this.apiKey,
    };
  }
}

/** Human-readable names for the statuses people actually hit. */
const STATUS_HINTS: Record<number, string> = {
  401: "Authentication error",
  403: "Plan does not allow this endpoint",
  404: "Not found",
  422: "Invalid parameters",
  429: "Rate limit exceeded",
  500: "Brave Search server error",
  502: "Brave Search server error",
  503: "Brave Search server error",
};

function toBraveSearchError(error: unknown): BraveSearchError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data: unknown = error.response?.data;

    if (status === undefined) {
      return new BraveSearchError(`Network error: ${error.message}`);
    }

    let serverMessage = error.message;
    if (data !== null && typeof data === "object" && "message" in data) {
      serverMessage = String((data as { message: unknown }).message);
    }

    const hint = STATUS_HINTS[status] ?? "API error";
    return new BraveSearchError(`${hint} (${status}): ${serverMessage}`, data, status);
  }

  if (error instanceof BraveSearchError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new BraveSearchError(`Unexpected error: ${message}`);
}

function validateIds(ids: string[]): string {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new BraveSearchError("ids must be a non-empty array");
  }
  const cleaned = ids.map((id) => (typeof id === "string" ? id.trim() : ""));
  if (cleaned.some((id) => id === "")) {
    throw new BraveSearchError("ids must contain non-empty strings");
  }
  return cleaned.join(",");
}

/** Drops `undefined` so axios does not serialize an empty parameter. */
function stripUndefined(params: RequestParams): RequestParams {
  const result: RequestParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/** Sleeps, and rejects immediately when the signal is aborted. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new BraveSearchError("Request aborted"));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    if (signal?.aborted === true) {
      clearTimeout(timer);
      reject(new BraveSearchError("Request aborted"));
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

