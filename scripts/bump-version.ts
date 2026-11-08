#!/usr/bin/env bun

/**
 * Bumps the version in package.json and mirrors it into deno.json, so npm and
 * JSR never drift apart. No npm dependency, no extra tooling.
 *
 *   bun scripts/bump-version.ts major|minor|patch
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Level = "major" | "minor" | "patch";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = join(root, "package.json");
const denoJsonPath = join(root, "deno.json");

const level = process.argv[2] as Level | undefined;
if (level !== "major" && level !== "minor" && level !== "patch") {
  console.error("bump-version: pass major, minor or patch");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
const current = pkg.version;

if (typeof current !== "string" || !/^\d+\.\d+\.\d+$/.test(current)) {
  console.error(`bump-version: unexpected version "${current}" in package.json`);
  process.exit(1);
}

const [major, minor, patch] = current.split(".").map(Number) as [number, number, number];
const next =
  level === "major"
    ? `${major + 1}.0.0`
    : level === "minor"
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`;

pkg.version = next;
writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

const deno = JSON.parse(readFileSync(denoJsonPath, "utf8")) as Record<string, unknown>;
deno["version"] = next;
writeFileSync(denoJsonPath, `${JSON.stringify(deno, null, 2)}\n`);

console.log(`bump-version: ${current} -> ${next} (package.json + deno.json)`);
