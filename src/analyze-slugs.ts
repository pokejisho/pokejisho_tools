import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { listAll } from "./pokeapi.ts";
import { SOURCES } from "./derive.ts";
import { pokeAPISlug } from "./slug.ts";
import type { DictionaryEntry } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const canonical: DictionaryEntry[] = JSON.parse(
  readFileSync(join(here, "..", "data", "jisho.json"), "utf8"),
);

for (const { resource, type } of SOURCES) {
  const list = await listAll(resource); // cheap: one request, cached
  const liveSlugs = new Set(list.map((i) => i.name));
  const canonSlugs = new Set(
    canonical.filter((e) => e.type === type).map((e) => pokeAPISlug(e.english)),
  );
  const matched = [...liveSlugs].filter((s) => canonSlugs.has(s)).length;
  const wouldFetch = liveSlugs.size - matched;
  // canonical slugs that don't appear in the live list = derivation gaps or removed entries
  const canonMisses = [...canonSlugs].filter((s) => !liveSlugs.has(s));
  console.log(
    `${resource.padEnd(16)} live=${String(list.length).padStart(4)} ` +
      `skip=${String(matched).padStart(4)} fetch=${String(wouldFetch).padStart(4)} ` +
      `| canonical ${type}=${canonSlugs.size}, derivation-gap=${canonMisses.length}`,
  );
  if (canonMisses.length) console.log(`    gap examples: ${canonMisses.slice(0, 8).join(", ")}`);
}
