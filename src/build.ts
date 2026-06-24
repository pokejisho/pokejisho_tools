import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { listAll, fetchDetail } from "./pokeapi.ts";
import { SOURCES, deriveEntry, entryKey } from "./derive.ts";
import { pokeAPISlug } from "./slug.ts";
import type { DictionaryEntry } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const CANONICAL = join(here, "..", "data", "jisho.json");
const OUT_DIR = join(here, "..", "dist");
const OUT = join(OUT_DIR, "jisho.json");

async function main() {
  const canonical: DictionaryEntry[] = JSON.parse(readFileSync(CANONICAL, "utf8"));
  const have = new Set(canonical.map((e) => entryKey(e.type, e.english)));
  console.log(`Canonical entries: ${canonical.length}`);

  const added: DictionaryEntry[] = [];
  let skipped = 0;
  let collided = 0;
  let prefiltered = 0;

  for (const { resource, type } of SOURCES) {
    const list = await listAll(resource);
    // Pre-filter: a list item whose slug matches a canonical entry of this type
    // is already covered (canonical wins), so skip the detail fetch entirely.
    const canonSlugs = new Set(
      canonical.filter((e) => e.type === type).map((e) => pokeAPISlug(e.english)),
    );
    const toFetch = list.filter((i) => !canonSlugs.has(i.name));
    prefiltered += list.length - toFetch.length;
    console.log(
      `\n${resource}: ${list.length} resources, ${toFetch.length} to fetch ` +
        `(${list.length - toFetch.length} already in canonical)`,
    );

    let n = 0;
    for (const item of toFetch) {
      const res = await fetchDetail(resource, item);
      const derived = deriveEntry(res, type);
      if ("skip" in derived) {
        skipped++;
        continue;
      }
      const key = entryKey(derived.type, derived.english);
      if (have.has(key)) {
        collided++;
        continue;
      }
      have.add(key);
      added.push(derived);
      console.log(`  + ${derived.type}: ${derived.english} / ${derived.japanese}`);
      if (++n % 200 === 0) console.log(`  …${n}/${toFetch.length}`);
    }
  }

  const merged = [...canonical, ...added];
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, JSON.stringify(merged, null, 2) + "\n");

  console.log(
    `\nDone. canonical=${canonical.length} +new=${added.length} ` +
      `(pre-filtered ${prefiltered} already-in-canonical, ` +
      `kept canonical on ${collided} name collisions, skipped ${skipped} unnamed) ` +
      `-> ${merged.length} entries written to dist/jisho.json`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
