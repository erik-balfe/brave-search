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

const DEFAULT_POLLING_TIMEOUT = 20000;

import {
  BraveSearchOptions,
  LocalDescriptionsOptions,
  LocalDescriptionsSearchApiResponse,
  LocalPoiOptions,
  LocalPoiSearchApiResponse,
  SummarizerOptions,
  SummarizerSearchApiResponse,
  WebSearchApiResponse,
} from "./types";

/**
 * An error class specific to BraveSearch API interactions.
 * It includes additional information about the response data that caused the error.
 */
class BraveSearchError extends Error {
  public responseData: any;

  /**
   * Initializes a new instance of the BraveSearchError class.
   * @param message The error message.
   * @param responseData The response data that caused the error.
   */
  constructor(message: string, responseData?: any) {
    super(message);
    this.name = "BraveSearchError";
    this.responseData = responseData;
  }
}

/**
 * The main class for interacting with the Brave Search API.
 * It provides methods for web search, local POI search, and summarization.
 */
class BraveSearch {
  private apiKey: string;
  private baseUrl = "https://api.search.brave.com/res/v1";
  private pollInterval = 500;
  private maxPollAttempts = DEFAULT_POLLING_TIMEOUT / this.pollInterval;

  /**
   * Initializes a new instance of the BraveSearch class.
   * @param apiKey The API key for accessing the Brave Search API.
   * @param options Optional settings to configure the search behavior.
   *  - maxPollAttempts: Maximum number of attempts to poll for a summary.
   *  - pollInterval: Interval in milliseconds between polling attempts.
   */
  constructor(apiKey: string, options?: { maxPollAttempts?: number; pollInterval?: number }) {
    this.apiKey = apiKey;
    if (options) {
      this.maxPollAttempts = options.maxPollAttempts ?? this.maxPollAttempts;
      this.pollInterval = options.pollInterval ?? this.pollInterval;
    }
  }

  /**
   * Performs a web search using the provided query and options.
   * @param query The search query string.
   * @param options Optional settings to configure the search behavior.
   * @returns A promise that resolves to the search results.
   */
  async webSearch(query: string, options: BraveSearchOptions = {}): Promise<WebSearchApiResponse> {
    const params = new URLSearchParams({
      q: query,
      ...this.formatOptions(options),
    });

    try {
      const response = await axios.get<WebSearchApiResponse>(
        `${this.baseUrl}/web/search?${params.toString()}`,
        {
          headers: this.getHeaders(),
        },
      );
      return response.data;
    } catch (error) {
      const handledError = this.handleApiError(error);
      throw handledError;
    }
  }

  /**
   * Executes a web search for the provided query and polls for a summary if available.
   * @param query The search query string.
   * @param options Optional settings to configure the search behavior.
   * @param summarizerOptions Optional settings specific to summarization.
   * @returns An object containing promises for the web search results and the summarized answer.
   */
  getSummarizedAnswer(
    query: string,
    options: Omit<BraveSearchOptions, "summary"> = {},
    summarizerOptions: SummarizerOptions = {},
  ): {
    summary: Promise<SummarizerSearchApiResponse | undefined>;
    webSearch: Promise<WebSearchApiResponse>;
  } {
    try {
      const webSearchResponse = this.webSearch(query, options);
      const summaryPromise = webSearchResponse.then(async (webSearchResponse) => {
        const summarizerKey = webSearchResponse.summarizer?.key;

        if (summarizerKey) {
          return await this.pollForSummary(summarizerKey, summarizerOptions);
        }

        return undefined;
      });

      return { webSearch: webSearchResponse, summary: summaryPromise };
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Searches for local points of interest using the provided IDs and options.
   * @param ids The IDs of the local points of interest.
   * @param options Optional settings to configure the search behavior.
   * @returns A promise that resolves to the search results.
   */
  async localPoiSearch(ids: string[], options: LocalPoiOptions = {}): Promise<LocalPoiSearchApiResponse> {
    const params = new URLSearchParams({
      ids: ids.join(","),
      ...this.formatOptions(options),
    });

    try {
      const response = await axios.get<LocalPoiSearchApiResponse>(
        `${this.baseUrl}/local/pois?${params.toString()}`,
        {
          headers: this.getHeaders(),
        },
      );
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Retrieves descriptions for local points of interest using the provided IDs and options.
   * @param ids The IDs of the local points of interest.
   * @param options Optional settings to configure the search behavior.
   * @returns A promise that resolves to the search results.
   */
  async localDescriptionsSearch(
    ids: string[],
    options: LocalDescriptionsOptions = {},
  ): Promise<LocalDescriptionsSearchApiResponse> {
    const params = new URLSearchParams({
      ids: ids.join(","),
      ...this.formatOptions(options),
    });

    try {
      const response = await axios.get<LocalDescriptionsSearchApiResponse>(
        `${this.baseUrl}/local/descriptions?${params.toString()}`,
        {
          headers: this.getHeaders(),
        },
      );
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  private async pollForSummary(
    key: string,
    options: SummarizerOptions,
  ): Promise<SummarizerSearchApiResponse | undefined> {
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
      const summaryResponse = await this.summarizerSearch(key, options);

      if (summaryResponse.status === "complete" && summaryResponse.summary) {
        return summaryResponse;
      } else if (summaryResponse.status === "failed") {
        throw new BraveSearchError("Summary generation failed");
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
    }

    throw new BraveSearchError("Summary not available after maximum polling attempts");
  }

  private async summarizerSearch(
    key: string,
    options: SummarizerOptions,
  ): Promise<SummarizerSearchApiResponse> {
    const params = new URLSearchParams({
      key,
      ...this.formatOptions(options),
    });

    try {
      const response = await axios.get<SummarizerSearchApiResponse>(
        `${this.baseUrl}/summarizer/search?${params.toString()}`,
        {
          headers: this.getHeaders(),
        },
      );
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  private getHeaders() {
    return {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": this.apiKey,
    };
  }

  private formatOptions(options: Record<string, any>): Record<string, string> {
    return Object.entries(options).reduce(
      (acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value.toString();
        }
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  private handleApiError(error: any): BraveSearchError {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      const responseData = error.response?.data;

      if (status === 429) {
        return new BraveSearchError(`Rate limit exceeded: ${message}`, responseData);
      } else if (status === 401) {
        return new BraveSearchError(`Authentication error: ${message}`, responseData);
      } else {
        return new BraveSearchError(`API error (${status}): ${message}`, responseData);
      }
    }
    return new BraveSearchError(`Unexpected error: ${error.message}`);
  }
}

export {
  BraveSearch,
  BraveSearchError,
  type BraveSearchOptions,
  type LocalDescriptionsOptions,
  type LocalDescriptionsSearchApiResponse,
  type LocalPoiOptions,
  type LocalPoiSearchApiResponse,
  type SummarizerOptions,
  type SummarizerSearchApiResponse,
  type WebSearchApiResponse,
};
