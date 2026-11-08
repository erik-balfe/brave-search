import { BraveSearchError } from "./braveSearch";
import type { BraveSearchOptions, SummarizerOptions } from "./types";
import type { LlmContextOptions, PlaceSearchOptions } from "./types-2026";
import { FreshnessOption, SafeSearchLevel, UnitSystem } from "./types";

const SAFE_SEARCH_VALUES: readonly string[] = Object.values(SafeSearchLevel);
const UNIT_VALUES: readonly string[] = Object.values(UnitSystem);
const FRESHNESS_SHORTCUTS: readonly string[] = Object.values(FreshnessOption);

/** Brave accepts `YYYY-MM-DDtoYYYY-MM-DD` as a custom freshness window. */
const DATE_RANGE = /^\d{4}-\d{2}-\d{2}to\d{4}-\d{2}-\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(message: string): never {
  throw new BraveSearchError(message);
}

function assertString(name: string, value: unknown): string {
  if (typeof value !== "string") {
    fail(`${name} must be a string`);
  }
  return value;
}

function assertBoolean(name: string, value: unknown): boolean {
  if (typeof value !== "boolean") {
    fail(`${name} must be a boolean`);
  }
  return value;
}

function assertInt(name: string, value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    fail(`${name} must be an integer`);
  }
  if (value < min || value > max) {
    fail(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

/**
 * Checks a durability window. Accepts the shortcuts (`pd`, `pw`, `pm`, `py`),
 * a custom range (`2024-01-01to2024-12-31`), or a single start date
 * (`2024-01-01`, which Brave treats as "since").
 */
function assertFreshness(value: unknown): string {
  const text = assertString("freshness", value);
  if (FRESHNESS_SHORTCUTS.includes(text) || DATE_RANGE.test(text) || DATE.test(text)) {
    return text;
  }
  return fail(
    'freshness must be one of "pd", "pw", "pm", "py", "YYYY-MM-DDtoYYYY-MM-DD" or "YYYY-MM-DD"',
  );
}

/**
 * Validates search options before they reach the network.
 * Every field is optional; an unknown key is rejected instead of silently sent.
 */
export function validateSearchOptions(
  options: BraveSearchOptions | Record<string, unknown>,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  const known = new Set([
    "country",
    "search_lang",
    "ui_lang",
    "safesearch",
    "freshness",
    "text_decorations",
    "spellcheck",
    "goggles_id",
    "units",
    "extra_snippets",
    "count",
    "offset",
    "result_filter",
    "summary",
  ]);

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) {
      continue;
    }
    if (!known.has(key)) {
      fail(`unknown search option: ${key}`);
    }

    switch (key) {
      case "count":
        if (value !== undefined) result[key] = assertInt(key, value, 1, 20);
        break;
      case "offset":
        if (value !== undefined) result[key] = assertInt(key, value, 0, 9);
        break;
      case "safesearch": {
        const text = assertString(key, value);
        if (!SAFE_SEARCH_VALUES.includes(text)) {
          fail(`safesearch must be one of ${SAFE_SEARCH_VALUES.join(", ")}`);
        }
        result[key] = text;
        break;
      }
      case "units": {
        const text = assertString(key, value);
        if (!UNIT_VALUES.includes(text)) {
          fail(`units must be one of ${UNIT_VALUES.join(", ")}`);
        }
        result[key] = text;
        break;
      }
      case "freshness":
        result[key] = assertFreshness(value);
        break;
      case "text_decorations":
      case "spellcheck":
      case "extra_snippets":
      case "summary":
        result[key] = assertBoolean(key, value);
        break;
      case "country":
      case "search_lang":
      case "ui_lang":
      case "goggles_id":
      case "result_filter":
        result[key] = assertString(key, value);
        break;
      default:
        break;
    }
  }

  return result;
}

/** Validates summarizer options. `inline_references` adds source markers to the text. */
export function validateSummarizerOptions(
  options: SummarizerOptions | Record<string, unknown>,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  const known = new Set(["entity_info", "inline_references"]);

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) {
      continue;
    }
    if (!known.has(key)) {
      fail(`unknown summarizer option: ${key}`);
    }
    result[key] = assertBoolean(key, value);
  }

  return result;
}

/**
 * Validates place search parameters. At least one anchor is required:
 * coordinates or a location name, otherwise Brave has nothing to search around.
 */
export function validatePlaceSearchOptions(
  options: PlaceSearchOptions | Record<string, unknown>,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  const known = new Set([
    "q",
    "location",
    "latitude",
    "longitude",
    "radius",
    "count",
    "units",
    "spellcheck",
    "safesearch",
    "freshness",
  ]);

  let hasLat = false;
  let hasLon = false;

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) {
      continue;
    }
    if (!known.has(key)) {
      fail(`unknown place search option: ${key}`);
    }

    switch (key) {
      case "latitude":
        if (typeof value !== "number" || value < -90 || value > 90) {
          fail("latitude must be a number between -90 and 90");
        }
        hasLat = true;
        result[key] = value;
        break;
      case "longitude":
        if (typeof value !== "number" || value < -180 || value > 180) {
          fail("longitude must be a number between -180 and 180");
        }
        hasLon = true;
        result[key] = value;
        break;
      case "radius":
        result[key] = assertInt(key, value, 1, 100_000);
        break;
      case "count":
        result[key] = assertInt(key, value, 1, 20);
        break;
      case "spellcheck":
        result[key] = assertBoolean(key, value);
        break;
      case "units": {
        const text = assertString(key, value);
        if (!UNIT_VALUES.includes(text)) {
          fail(`units must be one of ${UNIT_VALUES.join(", ")}`);
        }
        result[key] = text;
        break;
      }
      case "safesearch": {
        const text = assertString(key, value);
        if (!SAFE_SEARCH_VALUES.includes(text)) {
          fail(`safesearch must be one of ${SAFE_SEARCH_VALUES.join(", ")}`);
        }
        result[key] = text;
        break;
      }
      case "freshness":
        result[key] = assertFreshness(value);
        break;
      case "q":
      case "location": {
        const text = assertString(key, value);
        if (text.trim() === "") {
          fail(`${key} must not be empty`);
        }
        result[key] = text;
        break;
      }
      default:
        break;
    }
  }

  if (hasLat !== hasLon) {
    fail("latitude and longitude must be provided together");
  }
  const hasAnchor = typeof result["location"] === "string" || (hasLat && hasLon);
  if (!hasAnchor) {
    fail("place search needs a location or latitude+longitude; q alone has no anchor");
  }

  return result;
}

/** Validates LLM context parameters, including the token budget range. */
export function validateLlmContextOptions(
  options: LlmContextOptions | Record<string, unknown>,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  const known = new Set([
    "country",
    "search_lang",
    "ui_lang",
    "count",
    "maximum_number_of_tokens",
    "context_threshold_mode",
    "safesearch",
    "freshness",
    "spellcheck",
  ]);
  const thresholds = ["strict", "balanced", "lenient"];

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) {
      continue;
    }
    if (!known.has(key)) {
      fail(`unknown llm context option: ${key}`);
    }

    switch (key) {
      case "maximum_number_of_tokens":
        result[key] = assertInt(key, value, 512, 32_768);
        break;
      case "count":
        result[key] = assertInt(key, value, 1, 50);
        break;
      case "context_threshold_mode": {
        const text = assertString(key, value);
        if (!thresholds.includes(text)) {
          fail(`context_threshold_mode must be one of ${thresholds.join(", ")}`);
        }
        result[key] = text;
        break;
      }
      case "spellcheck":
        result[key] = assertBoolean(key, value);
        break;
      case "safesearch": {
        const text = assertString(key, value);
        if (!SAFE_SEARCH_VALUES.includes(text)) {
          fail(`safesearch must be one of ${SAFE_SEARCH_VALUES.join(", ")}`);
        }
        result[key] = text;
        break;
      }
      case "freshness":
        result[key] = assertFreshness(value);
        break;
      case "country":
      case "search_lang":
      case "ui_lang":
        result[key] = assertString(key, value);
        break;
      default:
        break;
    }
  }

  return result;
}
