# pokejisho_tool

Refreshes PokéJisho's `jisho.json` dictionary from [PokéAPI](https://pokeapi.co),
preserving the hand-curated canonical data. Intended to be run roughly once a year
when a new game adds Pokémon / items / moves.

See [DESIGN.md](./DESIGN.md) for how it works and why.

## Setup

```bash
npm install
```

## Usage

Build the merged dataset (fetches from PokéAPI as needed, then merges):

```bash
npm run build-dataset
```

- Output: `dist/jisho.json` — the deliverable. Copy it into the iOS and web repos.
- `data/jisho.json` is the **hand-curated canonical** layer and is never modified.
  On any collision (same type + name), the canonical entry wins.
- Entries already present in `data/jisho.json` are skipped before fetching (a slug
  is derived from each canonical name), so only genuinely new resources hit the
  network. A cold run is ~1 hour (~2,550 requests at 1.5 s each); re-runs reuse
  the `.cache/` and are near-instant. Delete `.cache/` to force a fresh fetch.
- The run is resumable: if it stops, just run it again — cached resources are skipped.

Deploy the result:

```bash
cp dist/jisho.json ../pokejisho_ios/PokeJishoKit/Sources/PokeJishoKit/Resources/jisho.json
cp dist/jisho.json ../pokejisho_web/js/...   # wherever the web dataset lives
```

## Validate the romaji converter

Checks the katakana→romaji converter against every existing entry (round-trip diff):

```bash
npm run validate-romaji
```

Currently ~99.3% exact match; the residual is a set of Gen 9 entries the original
hand-romanized with a looser convention. Those are preserved via canonical
precedence, so the converter only affects genuinely new entries.

## New entries each year

After running, review the `+ ...` lines in the build output (the new entries).
Spot-check their romaji, since new entries use the converter rather than hand
curation. If any need correcting, edit `data/jisho.json` (the canonical layer)
and re-run — canonical always wins.
