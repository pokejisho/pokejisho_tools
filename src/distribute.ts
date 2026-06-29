import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { DictionaryEntry } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const DIST = join(here, "..", "dist", "jisho.json");

// The consumer repos are siblings of pokejisho_tool.
const SIBLINGS = join(here, "..", "..");
const WEB = join(SIBLINGS, "pokejisho_web");
const IOS = join(SIBLINGS, "pokejisho_ios");
const ANDROID = join(SIBLINGS, "pokejisho_android");

const TARGETS = {
  "web raw.json": join(WEB, "js", "raw.json"),
  "web jisho-data.js": join(WEB, "js", "jisho-data.js"),
  "ios jisho.json": join(
    IOS,
    "PokeJishoKit",
    "Sources",
    "PokeJishoKit",
    "Resources",
    "jisho.json",
  ),
  "android jisho.json": join(
    ANDROID,
    "app",
    "src",
    "main",
    "assets",
    "jisho.json",
  ),
};

/**
 * Render entries as the web `jisho-data.js` file: a `var jisho = [...]` literal
 * with unquoted keys and trailing commas, matching the existing file's style.
 */
function toJishoDataJs(entries: DictionaryEntry[]): string {
  const objects = entries.map((entry) => {
    const fields = Object.entries(entry)
      .map(([key, value]) => `    ${key}: ${JSON.stringify(value)},`)
      .join("\n");
    return `  {\n${fields}\n  },`;
  });
  return `var jisho = [\n${objects.join("\n")}\n];\n`;
}

function main() {
  if (!existsSync(DIST)) {
    console.error(`Missing ${DIST} — run \`npm run build-dataset\` first.`);
    process.exit(1);
  }

  for (const [label, path] of Object.entries(TARGETS)) {
    if (!existsSync(dirname(path))) {
      console.error(`Missing target directory for ${label}: ${dirname(path)}`);
      process.exit(1);
    }
  }

  const json = readFileSync(DIST, "utf8");
  const entries: DictionaryEntry[] = JSON.parse(json);

  // raw.json and the iOS/Android bundle resources are plain JSON, byte-identical to dist.
  writeFileSync(TARGETS["web raw.json"], json);
  writeFileSync(TARGETS["ios jisho.json"], json);
  writeFileSync(TARGETS["android jisho.json"], json);
  // jisho-data.js wraps the same data in a JS variable for the web search script.
  writeFileSync(TARGETS["web jisho-data.js"], toJishoDataJs(entries));

  console.log(`Distributed ${entries.length} entries:`);
  for (const [label, path] of Object.entries(TARGETS)) {
    console.log(`  ${label.padEnd(18)} -> ${path}`);
  }
}

main();
