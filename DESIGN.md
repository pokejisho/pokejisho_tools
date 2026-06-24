# PokéJisho updater — design

A once-a-year script that refreshes `jisho.json` (the PokéJisho dictionary dataset)
with any new Pokémon / items / moves / etc. from PokéAPI, while preserving the
hand-curated canonical data.

## Goal

Stop maintaining `jisho.json` by hand. Iterate every relevant PokéAPI resource,
record English + Japanese, derive the remaining fields the same way the original
dataset was built, and merge with the hand-curated data (hand-curated wins).

## Data shape

Each entry: `{ type, english, japanese, katakana, romaji }`.

`type` values use **inconsistent canonical casing that must be matched exactly**:
`Pokémon`, `Ability` (capitalized; `Pokémon` accented), and `item`, `move`,
`character`, `location`, `nature` (lowercase).

- `japanese` — kana as displayed: hiragana for moves/items (`はたく`, `あかぼんぐり`),
  katakana for Pokémon (`フシギダネ`), mixed where applicable (`からてチョップ`).
- `katakana` — the `japanese` value converted hiragana→katakana.
- `romaji` — wāpuro/Hepburn romanization of `katakana` (see conventions).

## Source mapping (PokéAPI → jisho)

| jisho `type` | PokéAPI endpoint    | ~count |
| ------------ | ------------------- | ------ |
| `Pokémon`    | `pokemon-species`   | 1025   |
| `item`       | `item`              | 2176   |
| `move`       | `move`              | 937    |
| `Ability`    | `ability`           | 373    |
| `nature`     | `nature`            | 25     |
| `location`   | `location`          | 1096   |
| `character`  | — (none)            | —      |

`character` has no PokéAPI source and stays canonical-only.

Field derivation per resource:
- `english` ← `names[language=en]`
- `japanese` ← `names[language=ja-hrkt]` (matches the canonical kana convention 1:1)
- `katakana` ← `japanese` via hiragana→katakana
- `romaji` ← `katakana` via the romaji converter

`names[ja-hrkt]` fallback: if missing, use `names[ja]`; if still missing, log + skip.

## Romaji conventions (reverse-engineered from existing data)

Mostly Hepburn, with these specifics:
- Long vowels written out, **no macrons**: `ソウオン`→`souon`, `ジュウナン`→`juunan`.
- Long-vowel mark `ー` → **repeat the preceding vowel**: `アーマー`→`aamaa`, `ペース`→`peesu`.
- `ん`/`ン` → **always `n`** (never `m` before b/p/m): `テンマ`→`tenma`, `レンブ`→`renbu`.
- `ン` before a vowel → `n'`: `カンバンオジサン`→`kanban'ojisan`.
- Small `っ`/`ッ` → **double next consonant**: `ハッコウ`→`hakkou`; `ッシャ`→`ssha`.
- `を`/`ヲ` → `wo`: `ソラヲトブ`→`sorawotobu`.
- `づ`/`ヅ` → `zu`, `ぢ`/`ヂ` → `ji`: `ミカヅキ`→`mikazuki`.
- Yōon: `シャ/シュ/ショ`→`sha/shu/sho`, `チャ/チュ/チョ`→`cha/chu/cho`, `ジャ/ジュ/ジョ`→`ja/ju/jo`.
- `ヴ` is **quirky** in the original (`ヴィ`→`vyi`, `ヴェ`→`vye`, `ヴァ`→`vua`) — an
  artifact of the original library. Treated as acceptable residual mismatches
  (rare; canonical wins on existing entries, so only brand-new vu-entries differ,
  where the converter's output is arguably more correct).

### Validation

The romaji converter is validated by **round-trip diff against all existing
entries**: convert each entry's `katakana`→romaji and compare to its stored
`romaji`. Target ≥95% exact match; remaining mismatches are logged for review.
This empirically locks "the same strategy."

## Pipeline (separate modules)

1. **fetch** — list each resource (`?limit=100000`), then for each list item
   fetch its detail URL, caching raw JSON to `.cache/{type}/{id}.json`. **Serial,
   1.5 s between requests**, retry with exponential backoff (2→4→8→16 s, ~5
   attempts), identifying User-Agent. Re-runs skip cached IDs (idempotent,
   resumable).

   **Pre-filter optimization:** before fetching a list item's detail, derive a
   PokéAPI slug from each canonical entry's English name (`src/slug.ts`, mirroring
   the iOS app's `pokeAPISlug` plus é/♀/♂ handling) and skip any list item whose
   slug is already covered by canonical. Since canonical wins anyway, those
   details never need fetching — turning a ~5,700-request cold run into ~2,550.
   This is purely an optimization: imperfect slug derivation only costs a
   redundant fetch, never a wrong result, because the post-fetch `(type, english)`
   merge is the real de-duplication.
2. **derive** — map cached API resources → jisho entries (fields above).
3. **romaji** — kana→romaji converter (library + hand-rules), validated as above.
4. **merge** — overlay derived onto canonical; **canonical wins**. Merge key =
   `(type, normalized-english)`, normalized = é→e, lowercased, trimmed. Output →
   `dist/jisho.json`.

## Rate limiting

PokéAPI is a static Cloudflare deployment (responses `cache-control: max-age=86400`,
no `ratelimit` headers, no enforced cap today; historical documented limit was
100 req/min). The script stays far under that: serial, 1.5 s spacing (~40/min),
on-disk cache, backoff. A full cold run is ~4,500 requests (~2 h); re-runs are
near-instant.

## Files (canonical vs. output)

- `data/jisho.json` — hand-curated canonical, the precedence layer. **Never
  overwritten by the script.**
- `dist/jisho.json` — the merged deliverable, copied into the iOS/web repos.

## Success criteria

- `dist/jisho.json` reproduces every existing entry unchanged, plus any new
  PokéAPI entries.
- Romaji round-trip match on existing katakana ≥95%, mismatches logged.
- Re-running with a warm cache is fast and produces identical output.

## Decisions

- Output split from canonical (above); canonical never overwritten.
- Include all items (no category filtering).
- Include locations.
- Node + TypeScript.
