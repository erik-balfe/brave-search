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
  BraveSearchOptions,
  LocalDescriptionsOptions,
  LocalDescriptionsSearchApiResponse,
  LocalPoiOptions,
  LocalPoiSearchApiResponse,
  SummarizerOptions,
  SummarizerSearchApiResponse,
  WebSearchApiResponse,
} from "./types";

class BraveSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BraveSearchError";
  }
}

class BraveSearch {
  private apiKey: string;
  private baseUrl = "https://api.search.brave.com/res/v1";
  private maxPollAttempts = 5;
  private pollInterval = 500;

  constructor(
    apiKey: string,
    options?: { maxPollAttempts?: number; pollInterval?: number },
  ) {
    this.apiKey = apiKey;
    if (options) {
      this.maxPollAttempts = options.maxPollAttempts ?? this.maxPollAttempts;
      this.pollInterval = options.pollInterval ?? this.pollInterval;
    }
  }

  async webSearch(
    query: string,
    options: BraveSearchOptions = {},
  ): Promise<WebSearchApiResponse> {
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
      throw this.handleApiError(error);
    }
  }

  async getSummarizedAnswer(
    query: string,
    options: BraveSearchOptions = {},
    summarizerOptions: SummarizerOptions = {},
  ): Promise<
    {
      summary?: SummarizerSearchApiResponse;
      webSearchResponse: WebSearchApiResponse;
    }
  > {
    try {
      const webSearchResponse = await this.webSearch(query, options);
      const summarizerKey = webSearchResponse.summarizer?.key;

      if (summarizerKey) {
        const summary = await this.pollForSummary(
          summarizerKey,
          summarizerOptions,
        );
        return { summary, webSearchResponse };
      }

      return { webSearchResponse };
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async localPoiSearch(
    ids: string[],
    options: LocalPoiOptions = {},
  ): Promise<LocalPoiSearchApiResponse> {
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

    throw new BraveSearchError(
      "Summary not available after maximum polling attempts",
    );
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
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": this.apiKey,
    };
  }

  private formatOptions(options: Record<string, any>): Record<string, string> {
    return Object.entries(options).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value.toString();
      }
      return acc;
    }, {} as Record<string, string>);
  }

  private handleApiError(error: any): BraveSearchError {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (status === 429) {
        return new BraveSearchError(`Rate limit exceeded: ${message}`);
      } else if (status === 401) {
        return new BraveSearchError(`Authentication error: ${message}`);
      } else {
        return new BraveSearchError(`API error (${status}): ${message}`);
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
