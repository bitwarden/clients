import { EFFLongWordList } from "@bitwarden/common/platform/misc/wordlist";

import {
  CredentialGenerator,
  EffUsernameGenerationOptions,
  GenerateRequest,
  GeneratedCredential,
} from "../types";

import { Randomizer } from "./abstractions";
import { WordsRequest } from "./types";

/** The number of digits used when generating an Eff username with a number. */
const NUMBER_OF_DIGITS = 4;

/** Generation algorithms that produce randomized usernames */
export class UsernameRandomizer implements CredentialGenerator<EffUsernameGenerationOptions> {
  /** Instantiates the username randomizer
   *  @param random data source for random data
   */
  constructor(private random: Randomizer) {}

  /** Creates a username composed of random words
   *  @param request parameters to which the generated username conforms
   *  @returns a promise that resolves with the generated username.
   */
  async randomWords(request?: WordsRequest) {
    const numberOfWords = request?.numberOfWords ?? 1;
    if (numberOfWords < 1) {
      return "";
    }

    const digits = Math.max(request?.digits ?? 0, 0);
    let selectCase = (_: number) => false;
    if (request?.casing === "camelCase") {
      selectCase = (i: number) => i !== 0;
    } else if (request?.casing === "TitleCase") {
      selectCase = (_: number) => true;
    }

    const wordList = request?.words ?? EFFLongWordList;
    const parts = [];
    for (let i = 0; i < numberOfWords; i++) {
      const word = await this.random.pickWord(wordList, { titleCase: selectCase(i) });
      parts.push(word);
    }

    for (let i = 0; i < digits; i++) {
      const digit = await this.random.uniform(0, 9);
      parts.push(digit.toString());
    }

    const result = parts.join("");

    return result;
  }

  async generate(request: GenerateRequest, settings: EffUsernameGenerationOptions) {
    if (isEffUsernameGenerationOptions(settings)) {
      const username = await this.randomWords({
        digits: settings.wordIncludeNumber ? NUMBER_OF_DIGITS : 0,
        casing: settings.wordCapitalize ? "TitleCase" : "lowercase",
      });

      return new GeneratedCredential(
        username,
        "username",
        Date.now(),
        request.source,
        request.website,
      );
    }

    throw new Error("Invalid settings received by generator.");
  }
}

function isEffUsernameGenerationOptions(settings: any): settings is EffUsernameGenerationOptions {
  return "wordIncludeNumber" in (settings ?? {});
}
