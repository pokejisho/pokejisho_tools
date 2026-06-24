import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { toRomaji } from "./romaji.ts";
import type { DictionaryEntry } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const data: DictionaryEntry[] = JSON.parse(
  readFileSync(join(here, "..", "data", "jisho.json"), "utf8"),
);

let match = 0;
const mismatches: { katakana: string; expected: string; got: string }[] = [];

for (const e of data) {
  if (!e.katakana || !e.romaji) continue;
  const got = toRomaji(e.katakana);
  if (got === e.romaji) match++;
  else mismatches.push({ katakana: e.katakana, expected: e.romaji, got });
}

const total = match + mismatches.length;
const pct = ((match / total) * 100).toFixed(2);
console.log(`Round-trip romaji match: ${match}/${total} (${pct}%)`);
console.log(`Mismatches: ${mismatches.length}\n`);

// Show the first N mismatches and a frequency of differing kana to guide rules.
const N = 100;
for (const m of mismatches.slice(0, N)) {
  console.log(`  ${m.katakana.padEnd(18)} expected=${m.expected.padEnd(22)} got=${m.got}`);
}
if (mismatches.length > N) console.log(`  ... and ${mismatches.length - N} more`);
