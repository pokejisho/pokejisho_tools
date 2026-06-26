import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(here, "..", ".cache");

const BASE = "https://pokeapi.co/api/v2";
const USER_AGENT =
  "PokeJisho-updater (https://github.com/pokejisho)";

/** Delay between network requests (ms). Deliberately gentle — far under PokéAPI's
 *  historical 100/min. Cached reads incur no delay. */
const REQUEST_DELAY_MS = 1500;
const MAX_RETRIES = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A PokéAPI resource detail we care about: it carries a localized `names` array. */
export interface NamedResource {
  names: { name: string; language: { name: string } }[];
}

/** A single `{name, url}` entry from a list endpoint. */
export interface ListItem {
  name: string;
  url: string;
}

let lastRequestAt = 0;

async function fetchJSON(url: string): Promise<unknown> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const since = Date.now() - lastRequestAt;
    if (since < REQUEST_DELAY_MS) await sleep(REQUEST_DELAY_MS - since);
    lastRequestAt = Date.now();

    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** (attempt - 1);
        console.warn(`  ${res.status} on ${url} — retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`);
        await sleep(backoff);
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const backoff = 2000 * 2 ** (attempt - 1);
      console.warn(`  error on ${url} (${String(err)}) — retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw new Error(`exhausted retries for ${url}`);
}

/** Read-through disk cache. Cache key is the file path under .cache/. */
async function cached(relPath: string, url: string): Promise<unknown> {
  const file = join(CACHE_DIR, relPath);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const data = await fetchJSON(url);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
  return data;
}

/** Fetch the full list of a resource (single request, limit beyond any count). */
export async function listAll(resource: string): Promise<ListItem[]> {
  const data = (await cached(`${resource}/_list.json`, `${BASE}/${resource}?limit=100000`)) as {
    results: ListItem[];
  };
  return data.results;
}

/** Fetch one resource detail by its list `name`, cached per resource+name. */
export async function fetchDetail(
  resource: string,
  item: ListItem,
): Promise<NamedResource> {
  return (await cached(`${resource}/${item.name}.json`, item.url)) as NamedResource;
}
