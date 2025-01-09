/** Each entry of a character set contains a codepoint used for password generation */
export type CharacterSet = string[];

/** Well known character sets used for password generation */
export type CharacterSets = {
  /** A set of uppercase characters */
  Uppercase: CharacterSet;

  /** A set of lowercase characters */
  Lowercase: CharacterSet;

  /** A set of numeric characters (i.e., digits) */
  Digit: CharacterSet;

  /** A set of special characters (e.g. "$") */
  Special: CharacterSet;
};

/** Request a random password using ascii characters */
export type RandomAsciiRequest = {
  /** Number of codepoints drawn from all available character sets */
  all: number;

  /** Number of codepoints drawn from uppercase character sets */
  uppercase?: number;

  /** Number of codepoints drawn from lowercase character sets */
  lowercase?: number;

  /** Number of codepoints drawn from numeric character sets */
  digits?: number;

  /** Number of codepoints drawn from special character sets */
  special?: number;

  /** When `false`, characters with ambiguous glyphs (e.g., "I", "l", and "1") are excluded from the generated password. */
  ambiguous: boolean;
};

/** Request random words drawn from the EFF "5 dice" word list */
export type EffWordListRequest = {
  /** Number of words drawn from the word list */
  numberOfWords: number;

  /** Separator rendered in between each word */
  separator: string;

  /** Whether or not a word should include a random digit */
  number: boolean;

  /** Whether or not the words should be capitalized */
  capitalize: boolean;
};

/** request random username drawn from a word list */
export type WordsRequest = {
  /** the number of words to select. This defaults to 1. */
  numberOfWords?: number;

  /** Draw the words from a custom word list; defaults to the EFF "5 dice" word list. */
  words?: Array<string>;

  /** The number of digits to append to the random word(s). Defaults to 0. */
  digits?: number;

  /** Expected casing of the returned words. Defaults to lowercase. */
  casing?: "lowercase" | "TitleCase" | "camelCase";
};
