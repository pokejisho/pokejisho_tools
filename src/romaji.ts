import { toRomaji as wanakanaToRomaji } from "wanakana";

/**
 * Convert katakana to romaji following the conventions used by the original
 * jisho.json dataset (wāpuro/Hepburn: long vowels written out, ん→n with
 * apostrophe before vowels, づ→zu, を→wo, ー→repeated vowel, small tsu doubles).
 *
 * Baseline implementation delegates to wanakana; hand-rules are layered on after
 * round-trip validation against the existing dataset (see validate-romaji.ts).
 */
export function toRomaji(katakana: string): string {
  return normalizeFullwidthDigits(wanakanaToRomaji(katakana));
}

/**
 * The original dataset converts full-width digits (０-９) to ASCII, while keeping
 * full-width letters (ＳＰ, Ｐ, ＮＯ) as-is. wanakana passes both through unchanged,
 * so normalize only the digits here.
 */
function normalizeFullwidthDigits(s: string): string {
  return s.replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30),
  );
}
