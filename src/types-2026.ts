/**
 * Types for the endpoints that exist in the live API but were not covered by
 * the original 2024 type set: video results, place search, and LLM context.
 *
 * Shapes here were taken from real responses (2026-11-08), not from docs.
 * Where Brave marks a field optional in practice, it is optional here too.
 */

import type { OpeningHours, PostalAddress, VideoData } from "./types";

export type { OpeningHours, PostalAddress, VideoData };

// ---------------------------------------------------------------------------
// Video search: GET /res/v1/videos/search
// ---------------------------------------------------------------------------

export interface VideoAuthor {
  name: string;
  url?: string;
}

export interface VideoSearchResult {
  type: "video_result";
  title: string;
  url: string;
  description: string;
  age?: string;
  page_age?: string;
  thumbnail?: {
    src?: string;
    original?: string;
  };
  video?: VideoData;
  meta_url?: {
    scheme?: string;
    netloc?: string;
    hostname?: string;
    favicon?: string;
    path?: string;
  };
}

export interface VideoSearchApiResponse {
  type: "videos";
  query: {
    original: string;
    spellcheck_off?: boolean;
    show_strict_warning?: boolean;
  };
  results: VideoSearchResult[];
  extra?: {
    might_be_offensive?: boolean;
  };
}

/** Options accepted by the video endpoint. A subset of the web options. */
export interface VideoSearchOptions {
  country?: string;
  search_lang?: string;
  ui_lang?: string;
  safesearch?: string;
  freshness?: string;
  count?: number;
  offset?: number;
  spellcheck?: boolean;
}

// ---------------------------------------------------------------------------
// Place search: GET /res/v1/local/place_search
// ---------------------------------------------------------------------------

export interface PlaceContact {
  telephone?: string;
  email?: string;
}

export interface PlaceRating {
  ratingValue?: number;
  bestRating?: number;
  reviewCount?: number;
  is_tripadvisor?: boolean;
}

export interface PlacePicture {
  src?: string;
  original?: string;
}

export interface PlaceResult {
  type: "location_result";
  title: string;
  url: string;
  description?: string;
  id?: string;
  is_source_local?: boolean;
  is_source_both?: boolean;
  family_friendly?: boolean;
  provider_url?: string;
  /** [latitude, longitude] */
  coordinates?: [number, number];
  zoom_level?: number;
  thumbnail?: PlacePicture;
  postal_address?: PostalAddress;
  opening_hours?: OpeningHours;
  contact?: PlaceContact;
  price_range?: string;
  rating?: PlaceRating;
  profiles?: unknown[];
  pictures?: { results?: PlacePicture[] };
  serves_cuisine?: string[];
  categories?: unknown[];
}

/** A city, country, region, street or neighborhood panel in the response. */
export interface PlacePanel {
  results?: Array<{
    title?: string;
    url?: string;
    description?: string;
    coordinates?: [number, number];
  }>;
}

export interface PlaceSearchApiResponse {
  type: "locations";
  results: PlaceResult[];
  /** Global location the results were anchored to, when Brave resolves one. */
  location?: PlaceResult;
  mixed?: unknown;
  cities?: PlacePanel;
  countries?: PlacePanel;
  regions?: PlacePanel;
  neighborhoods?: PlacePanel;
  streets?: PlacePanel;
  addresses?: PlacePanel;
}

/**
 * Place search parameters. Either a query, a location anchor, or both.
 * Coordinates take precedence over `location` when both are given.
 */
export interface PlaceSearchOptions {
  /** What to look for, e.g. "coffee shops". Omit for Explore mode. */
  q?: string;
  /** Freeform anchor, e.g. "tbilisi" or "tokyo japan". */
  location?: string;
  latitude?: number;
  longitude?: number;
  /** Search radius in meters around the anchor. */
  radius?: number;
  count?: number;
  units?: string;
  spellcheck?: boolean;
  safesearch?: string;
  freshness?: string;
}

// ---------------------------------------------------------------------------
// LLM context: GET/POST /res/v1/llm/context
// ---------------------------------------------------------------------------

export interface LlmContextSnippet {
  type?: string;
  /** The passage itself, already extracted and relevance-scored. */
  content?: string;
  url?: string;
  title?: string;
  /** Last time the page was fetched by Brave. */
  age?: string[] | string;
}

export interface LlmContextSource {
  url: string;
  title?: string;
  hostname?: string;
  snippet?: LlmContextSnippet[];
  age?: string[] | string;
}

export interface LlmContextApiResponse {
  grounding: {
    generic?: LlmContextSnippet[];
    map?: LlmContextSnippet[];
    poi?: LlmContextSnippet[];
    /** Flat list of every source that contributed context. */
    sources?: LlmContextSource[];
  };
}

export interface LlmContextOptions {
  country?: string;
  search_lang?: string;
  ui_lang?: string;
  count?: number;
  /** Token budget for the extracted context (roughly 1k..33k). */
  maximum_number_of_tokens?: number;
  /** How aggressively to drop weak passages. */
  context_threshold_mode?: "strict" | "balanced" | "lenient";
  safesearch?: string;
  freshness?: string;
  spellcheck?: boolean;
}

// ---------------------------------------------------------------------------
// Summarizer: GET /res/v1/summarizer/search (deprecated in favour of Answers)
// ---------------------------------------------------------------------------

export interface InlineReference {
  type: "inline_reference";
  url: string;
  start_index: number;
  end_index: number;
  number?: number;
}

export type SummaryPart =
  | { type: "token"; data: string }
  | { type: "inline_reference"; data: InlineReference }
  | { type: "enum_start" | "enum_end"; data?: unknown }
  | { type: "enum_item"; data?: unknown };

export interface SummarizerEnrichment {
  type?: string;
  data?: unknown;
}

export interface SummarizerCompleteResponse {
  type: "summarizer";
  status: "complete";
  title?: string;
  summary: SummaryPart[];
  enrichments?: SummarizerEnrichment[];
  followups?: unknown;
  entities_infos?: unknown;
}

export interface SummarizerPendingResponse {
  type: "summarizer";
  status: "pending" | "failed";
  title?: string;
}
