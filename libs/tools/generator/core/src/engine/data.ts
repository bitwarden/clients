import { CharacterSet, CharacterSets } from "./types";

function toCharacterSet(characters: string) {
  const set = characters.split("");

  return Object.freeze(set as CharacterSet);
}

const SpecialCharacters = toCharacterSet("!@#$%^&*");

/** Sets of Ascii characters used for password generation */
export const Ascii = Object.freeze({
  /** The full set of characters available to the generator */
  Full: Object.freeze({
    Uppercase: toCharacterSet("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
    Lowercase: toCharacterSet("abcdefghijklmnopqrstuvwxyz"),
    Digit: toCharacterSet("0123456789"),
    Special: SpecialCharacters,
  } as CharacterSets),

  /** All characters available to the generator that are not ambiguous. */
  Unmistakable: Object.freeze({
    Uppercase: toCharacterSet("ABCDEFGHJKLMNPQRSTUVWXYZ"),
    Lowercase: toCharacterSet("abcdefghijkmnopqrstuvwxyz"),
    Digit: toCharacterSet("23456789"),
    Special: SpecialCharacters,
  } as CharacterSets),
});

/** Splits an email into a username, subaddress, and domain named group.
 * Subaddress is optional.
 */
export const SUBADDRESS_PARSER = new RegExp(
  "(?<username>[^@+]+)(?<subaddress>\\+.+)?(?<domain>@.+)",
);
