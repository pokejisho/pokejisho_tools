/**
 * Derive a PokéAPI slug from an English display name. Mirrors the iOS app's
 * pokeAPISlug, plus é→e and ♀/♂ handling for better coverage.
 *
 * Used only as a pre-fetch optimization: if a list item's slug matches a slug
 * derived from a canonical entry, we already have that entry and can skip the
 * detail fetch. Imperfect derivation only costs a redundant fetch (the post-fetch
 * (type, english) merge still de-duplicates), never a wrong result.
 */
export function pokeAPISlug(english: string): string {
  let s = english.toLowerCase();
  s = s.replace(/é/g, "e");
  s = s.replace(/♀/g, "-f").replace(/♂/g, "-m");
  for (const ch of ["'", "’", ".", ":", ",", "(", ")"]) s = s.split(ch).join("");
  s = s.replace(/\s+/g, "-").replace(/-+/g, "-");
  return s;
}
