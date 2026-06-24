export type EntryType =
  | "Pokémon"
  | "item"
  | "move"
  | "Ability"
  | "nature"
  | "location"
  | "character";

export interface DictionaryEntry {
  type: EntryType;
  english: string;
  japanese: string;
  katakana: string;
  romaji: string;
}
