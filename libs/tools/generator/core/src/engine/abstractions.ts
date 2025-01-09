import { WordOptions } from "../types";

/** Entropy source for credential generation. */
export interface Randomizer {
  /** picks a random entry from a list.
   *  @param list random entry source. This must have at least one entry.
   *  @returns a promise that resolves with a random entry from the list.
   */
  pick<Entry>(list: Array<Entry>): Promise<Entry>;

  /** picks a random word from a list.
   *  @param list random entry source. This must have at least one entry.
   *  @param options customizes the output word
   *  @returns a promise that resolves with a random word from the list.
   */
  pickWord(list: Array<string>, options?: WordOptions): Promise<string>;

  /** Shuffles a list of items
   *  @param list random entry source. This must have at least two entries.
   *  @param options.copy shuffles a copy of the input when this is true.
   *    Defaults to true.
   *  @returns a promise that resolves with the randomized list.
   */
  shuffle<Entry>(items: Array<Entry>): Promise<Array<Entry>>;

  /** Generates a string containing random lowercase ASCII characters and numbers.
   *  @param length the number of characters to generate
   *  @returns a promise that resolves with the randomized string.
   */
  chars(length: number): Promise<string>;

  /** Selects an integer value from a range by randomly choosing it from
   *  a uniform distribution.
   *  @param min the minimum value in the range, inclusive.
   *  @param max the minimum value in the range, inclusive.
   *  @returns a promise that resolves with the randomized string.
   */
  uniform(min: number, max: number): Promise<number>;
}
