import { listAll, fetchDetail, isDetailCached } from "./pokeapi.ts";
import { SOURCES } from "./derive.ts";

/**
 * Warm the disk cache for every PokéAPI resource the build consumes, skipping
 * anything already cached. Unlike `build-dataset`, this does NOT pre-filter by
 * canonical coverage — it fetches every list item so a later cold run is free.
 * Idempotent and resumable: re-running only fetches what's still missing.
 */
async function main() {
  let fetched = 0;
  let cachedAlready = 0;

  for (const { resource } of SOURCES) {
    const list = await listAll(resource);
    const missing = list.filter((i) => !isDetailCached(resource, i));
    cachedAlready += list.length - missing.length;
    console.log(
      `\n${resource}: ${list.length} resources, ${missing.length} to fetch ` +
        `(${list.length - missing.length} already cached)`,
    );

    let n = 0;
    for (const item of missing) {
      await fetchDetail(resource, item);
      fetched++;
      if (++n % 200 === 0) console.log(`  …${n}/${missing.length}`);
    }
  }

  console.log(
    `\nDone. fetched ${fetched} new, ${cachedAlready} already cached.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
