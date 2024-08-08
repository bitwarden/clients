import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";

import { Randomizer } from "../abstractions";
import { WordOptions } from "../types";

/** A randomizer backed by a CryptoService. */
export class CryptoServiceRandomizer implements Randomizer {
  /** instantiates the type.
   * @param crypto generates random numbers
   */
  constructor(private crypto: CryptoService) {}

  async pick<Entry>(list: Array<Entry>): Promise<Entry> {
    const length = list?.length ?? 0;
    if (length <= 0) {
      throw new Error("list must have at least one entry.");
    }

    const index = await this.uniform(0, list.length - 1);
    return list[index];
  }

  async pickWord(list: Array<string>, options?: WordOptions) {
    let word = await this.pick(list);

    if (options?.titleCase ?? false) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }

    if (options?.number ?? false) {
      const num = await this.crypto.randomNumber(1, 9);
      word = word + num.toString();
    }

    return word;
  }

  // ref: https://stackoverflow.com/a/12646864/1090359
  async shuffle<T>(items: Array<T>, options?: { copy?: boolean }) {
    const length = items?.length ?? 0;
    if (length <= 0) {
      throw new Error("items must have at least one entry.");
    }

    const shuffled = options?.copy ?? true ? [...items] : items;

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = await this.uniform(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  async chars(length: number) {
    let str = "";
    const charSet = "abcdefghijklmnopqrstuvwxyz1234567890";
    for (let i = 0; i < length; i++) {
      const randomCharIndex = await this.uniform(0, charSet.length - 1);
      str += charSet.charAt(randomCharIndex);
    }
    return str;
  }

  async uniform(min: number, max: number) {
    return this.crypto.randomNumber(min, max);
  }
}
