import {
  BitwardenClient,
  PassphraseGeneratorRequest,
  PasswordGeneratorRequest,
} from "@bitwarden/sdk-internal";

import { Type } from "../metadata";
import {
  CredentialGenerator,
  GenerateRequest,
  GeneratedCredential,
  PassphraseGenerationOptions,
  PasswordGenerationOptions,
} from "../types";

/** Generation algorithms that produce randomized secrets */
export class SdkPasswordRandomizer
  implements
    CredentialGenerator<PassphraseGenerationOptions>,
    CredentialGenerator<PasswordGenerationOptions>
{
  /** Instantiates the password randomizer
   *  @param randomizer data source for random data
   */
  constructor(private client: BitwardenClient) {}

  generate(
    request: GenerateRequest,
    settings: PasswordGenerationOptions,
  ): Promise<GeneratedCredential>;
  generate(
    request: GenerateRequest,
    settings: PassphraseGenerationOptions,
  ): Promise<GeneratedCredential>;
  async generate(
    request: GenerateRequest,
    settings: PasswordGenerationOptions | PassphraseGenerationOptions,
  ) {
    if (isPasswordGenerationOptions(settings)) {
      const password = await this.client.generator().password(convertPasswordRequest(settings));

      return new GeneratedCredential(
        password,
        Type.password,
        Date.now(),
        request.source,
        request.website,
      );
    } else if (isPassphraseGenerationOptions(settings)) {
      const passphrase = await this.client
        .generator()
        .passphrase(convertPassphraseRequest(settings));

      return new GeneratedCredential(
        passphrase,
        Type.password,
        Date.now(),
        request.source,
        request.website,
      );
    }

    throw new Error("Invalid settings received by generator.");
  }
}

function convertPasswordRequest(settings: PasswordGenerationOptions): PasswordGeneratorRequest {
  //return settings as PassphraseGeneratorRequest;
  return {
    lowercase: settings.lowercase!,
    uppercase: settings.uppercase!,
    numbers: settings.number!,
    special: settings.special!,
    length: settings.length!,
    avoidAmbiguous: settings.ambiguous!,
    minLowercase: settings.minLowercase!,
    minUppercase: settings.minUppercase!,
    minNumber: settings.minNumber!,
    minSpecial: settings.minSpecial!,
  };
}

function convertPassphraseRequest(
  settings: PassphraseGenerationOptions,
): PassphraseGeneratorRequest {
  return {
    numWords: settings.numWords!,
    wordSeparator: settings.wordSeparator!,
    capitalize: settings.capitalize!,
    includeNumber: settings.includeNumber!,
  };
}

function isPasswordGenerationOptions(settings: any): settings is PasswordGenerationOptions {
  return "length" in (settings ?? {});
}

function isPassphraseGenerationOptions(settings: any): settings is PassphraseGenerationOptions {
  return "numWords" in (settings ?? {});
}
