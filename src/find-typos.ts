import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { listAll, fetchDetail } from "./pokeapi.ts";
import { SOURCES, deriveEntry } from "./derive.ts";
import { pokeAPISlug } from "./slug.ts";
import type { DictionaryEntry } from "./types.ts";

/**
 * Find likely English typos in canonical: entries that share a Japanese name with
 * a PokéAPI resource but whose English differs. A typo breaks the slug match, so
 * the candidate always appears among the slug-unmatched ("to fetch") items.
 *
 * Usage: tsx src/find-typos.ts [resource ...]
 *   no args  -> scan every category (full scan; fetches all slug-unmatched
 *               details, ~1h cold, and warms the cache for build-dataset)
 *   args     -> scan only the named resources, e.g. `pokemon-species move`
 */
const here = dirname(fileURLToPath(import.meta.url));
const canonical: DictionaryEntry[] = JSON.parse(
  readFileSync(join(here, "..", "data", "jisho.json"), "utf8"),
);

const filter = process.argv.slice(2);
const sources = filter.length
  ? SOURCES.filter((s) => filter.includes(s.resource))
  : SOURCES;

const normEn = (s: string) => s.replace(/é/g, "e").toLowerCase().replace(/\s+/g, "");

for (const { resource, type } of sources) {
  // Index canonical entries of this type by katakana (the normalized JA field).
  const byKatakana = new Map<string, DictionaryEntry[]>();
  for (const e of canonical.filter((e) => e.type === type)) {
    const arr = byKatakana.get(e.katakana) ?? [];
    arr.push(e);
    byKatakana.set(e.katakana, arr);
  }

  const list = await listAll(resource);
  const canonSlugs = new Set(
    canonical.filter((e) => e.type === type).map((e) => pokeAPISlug(e.english)),
  );
  const toFetch = list.filter((i) => !canonSlugs.has(i.name));

  console.log(`\n=== ${resource} (${toFetch.length} slug-unmatched) ===`);
  for (const item of toFetch) {
    const derived = deriveEntry(await fetchDetail(resource, item), type);
    if ("skip" in derived) continue;
    const sameJa = byKatakana.get(derived.katakana);
    if (sameJa && sameJa.every((c) => normEn(c.english) !== normEn(derived.english))) {
      for (const c of sameJa) {
        console.log(
          `  TYPO?  canonical="${c.english}"  vs API="${derived.english}"  (${derived.japanese})`,
        );
      }
    }
  }
}
console.log("\ndone");
