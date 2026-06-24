import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { listAll, fetchDetail } from "./pokeapi.ts";
import { SOURCES, deriveEntry, entryKey } from "./derive.ts";
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

  for (const { resource, type } of SOURCES) {
    const list = await listAll(resource);
    console.log(`\n${resource}: ${list.length} resources`);
    let n = 0;
    for (const item of list) {
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
      if (++n % 200 === 0) console.log(`  …${n}/${list.length}`);
    }
  }

  const merged = [...canonical, ...added];
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, JSON.stringify(merged, null, 2) + "\n");

  console.log(
    `\nDone. canonical=${canonical.length} +new=${added.length} ` +
      `(kept canonical on ${collided} collisions, skipped ${skipped} unnamed) ` +
      `-> ${merged.length} entries written to dist/jisho.json`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
