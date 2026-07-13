import {
  PasswordManagerClient,
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

/** Generation algorithms that produce randomized secrets by calling on functionality from the SDK */
export class SdkPasswordRandomizer
  implements
    CredentialGenerator<PassphraseGenerationOptions>,
    CredentialGenerator<PasswordGenerationOptions>
{
  /** Instantiates the password randomizer
   *  @param client lazy factory that resolves a fresh SDK client per call. Invoked on each
   *  `generate()` so that re-emissions from `SdkService.client$` (e.g. environment changes) are
   *  picked up instead of capturing a stale client; see {@link GeneratorDependencyProvider.sdk}.
   *  @param currentTime gets the current datetime in epoch time
   */
  constructor(
    private client: () => Promise<PasswordManagerClient>,
    private currentTime: () => number,
  ) {}

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
    const client = await this.client();

    if (isPasswordGenerationOptions(settings)) {
      const password = await client.generator().password(convertPasswordRequest(settings));

      return new GeneratedCredential(
        password,
        Type.password,
        this.currentTime(),
        request.source,
        request.website,
      );
    } else if (isPassphraseGenerationOptions(settings)) {
      const passphrase = await client.generator().passphrase(convertPassphraseRequest(settings));

      return new GeneratedCredential(
        passphrase,
        Type.password,
        this.currentTime(),
        request.source,
        request.website,
      );
    }

    throw new Error("Invalid settings received by generator.");
  }
}

function convertPasswordRequest(settings: PasswordGenerationOptions): PasswordGeneratorRequest {
  return {
    lowercase: settings.lowercase!,
    uppercase: settings.uppercase!,
    numbers: settings.number!,
    special: settings.special!,
    length: settings.length!,
    avoidAmbiguous: !settings.ambiguous!,
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
