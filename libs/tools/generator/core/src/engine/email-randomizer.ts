import { EFFLongWordList } from "@bitwarden/common/platform/misc/wordlist";

import { Randomizer } from "./abstractions";
import { SUBADDRESS_PARSER } from "./data";

/** Generation algorithms that produce randomized email addresses */
export class EmailRandomizer {
  /** Instantiates the email randomizer
   *  @param random data source for random data
   */
  constructor(private random: Randomizer) {}

  /** Appends a random set of characters as a subaddress
   *  @param email the email address used to generate a subaddress. If this address
   *    already contains a subaddress, the subaddress is extended.
   *  @param options.length the number of characters to append to the subaddress. Defaults to 8. If
   *    the length is <= 0, the function returns the input address.
   *  @returns a promise that resolves with the generated email address. If the provided address
   *    lacks a username (the part before the "@") or domain (the part after the "@"), the function
   *    returns the input address.
   */
  async randomAsciiSubaddress(email: string, options?: { length?: number }) {
    let result = email ?? "";

    const subaddressLength = options?.length ?? 8;
    if (subaddressLength < 1) {
      return result;
    }

    const parsed = SUBADDRESS_PARSER.exec(result);
    if (!parsed) {
      return result;
    }

    let subaddress = parsed.groups.subaddress ?? "+";
    subaddress += await this.random.chars(subaddressLength);
    result = `${parsed.groups.username}${subaddress}${parsed.groups.domain}`;

    return result;
  }

  /** Creates a catchall address composed of random characters
   *  @param domain the domain part of the generated email address.
   *  @param options.length the number of characters to include in the catchall
   *    address. Defaults to 8.
   *  @returns a promise that resolves with the generated email address. If the domain
   *    is empty, resolves to null instead.
   */
  async randomAsciiCatchall(domain: string, options?: { length?: number }) {
    const emailDomain = domain?.startsWith("@") ? domain.substring(1, Infinity) : domain ?? "";
    if (emailDomain.length < 1) {
      return null;
    }

    const length = options?.length ?? 8;
    if (length < 1) {
      return null;
    }

    const catchall = await this.random.chars(length);
    const result = `${catchall}@${domain}`;

    return result;
  }

  /** Creates a catchall address composed of random words
   *  @param domain the domain part of the generated email address.
   *  @param options.numberOfWords the number of words to include in the catchall
   *    address. Defaults to 1.
   *  @param options.words selects words from the provided wordlist. Defaults to
   *    the EFF "5-dice" list.
   *  @returns a promise that resolves with the generated email address.
   */
  async randomWordsCatchall(
    domain: string,
    options?: { numberOfWords?: number; words?: Array<string> },
  ) {
    const emailDomain = domain?.startsWith("@") ? domain.substring(1, Infinity) : domain ?? "";
    if (emailDomain.length < 1) {
      return null;
    }

    const numberOfWords = options?.numberOfWords ?? 1;
    if (numberOfWords < 1) {
      return null;
    }

    const wordList = options?.words ?? EFFLongWordList;
    const words = [];
    for (let i = 0; i < numberOfWords; i++) {
      // camelCase the words for legibility
      words[i] = await this.random.pickWord(wordList, { titleCase: i !== 0 });
    }

    const result = `${words.join("")}@${domain}`;

    return result;
  }
}
