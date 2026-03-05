// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import {
  DefaultPasswordGenerationOptions,
  DefaultPassphraseGenerationOptions,
} from "@bitwarden/generator-core";
import {
  PasswordGeneratorOptions,
  PasswordGenerationServiceAbstraction,
} from "@bitwarden/generator-legacy";

import { Response } from "../models/response";
import { StringResponse } from "../models/response/string.response";
import { CliUtils } from "../utils";

// Used to track user-supplied options in case of policy requirement conflicts
type ExplicitFlags = {
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
  length: boolean;
  minNumber: boolean;
  minSpecial: boolean;
  words: boolean;
};

export class GenerateCommand {
  constructor(
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private tokenService: TokenService,
    private accountService: AccountService,
  ) {}

  async run(cmdOptions: Record<string, any>): Promise<Response> {
    const normalizedOptions = new Options(cmdOptions);
    const options: PasswordGeneratorOptions = {
      uppercase: normalizedOptions.uppercase,
      lowercase: normalizedOptions.lowercase,
      number: normalizedOptions.number,
      special: normalizedOptions.special,
      length: normalizedOptions.length,
      type: normalizedOptions.type,
      wordSeparator: normalizedOptions.separator,
      numWords: normalizedOptions.words,
      capitalize: normalizedOptions.capitalize,
      includeNumber: normalizedOptions.includeNumber,
      minNumber: normalizedOptions.minNumber,
      minSpecial: normalizedOptions.minSpecial,
      ambiguous: !normalizedOptions.ambiguous,
    };

    const shouldEnforceOptions = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        switchMap((account) => {
          if (account == null) {
            return of(false);
          }

          return this.tokenService.hasAccessToken$(account.id);
        }),
      ),
    );
    // snapshot before the service mutates options in place
    const optionsBeforeEnforcement = { ...options };
    const enforcedOptions = shouldEnforceOptions
      ? (await this.passwordGenerationService.enforcePasswordGeneratorPoliciesOnOptions(options))[0]
      : options;

    if (shouldEnforceOptions) {
      const conflicts = this.detectPolicyConflicts(
        normalizedOptions.explicit,
        optionsBeforeEnforcement,
        enforcedOptions,
      );
      if (conflicts.length > 0) {
        const msg =
          "Your options conflict with your organization's password generation policy:\n" +
          conflicts.map((c) => `  ${c}`).join("\n") +
          '\n\nRun "bw generate" without those options to use policy defaults.';
        return Response.badRequest(msg);
      }
    }

    const password = await this.passwordGenerationService.generatePassword(enforcedOptions);
    const res = new StringResponse(password);
    return Response.success(res);
  }

  private detectPolicyConflicts(
    explicit: ExplicitFlags,
    before: PasswordGeneratorOptions,
    after: PasswordGeneratorOptions,
  ): string[] {
    const conflicts: string[] = [];
    const isPassword = before.type !== "passphrase";

    if (isPassword) {
      if (explicit.length && after.length > before.length) {
        conflicts.push(
          `--length ${before.length}: policy requires a minimum length of ${after.length}.`,
        );
      }
      if (explicit.minNumber && after.minNumber > before.minNumber) {
        conflicts.push(
          `--minNumber ${before.minNumber}: policy requires a minimum of ${after.minNumber} numbers.`,
        );
      }
      if (explicit.minSpecial && after.minSpecial > before.minSpecial) {
        conflicts.push(
          `--minSpecial ${before.minSpecial}: policy requires a minimum of ${after.minSpecial} special characters.`,
        );
      }

      const anyCharTypeExplicit =
        explicit.uppercase || explicit.lowercase || explicit.number || explicit.special;

      if (anyCharTypeExplicit) {
        if (!explicit.uppercase && after.uppercase && !before.uppercase) {
          conflicts.push(`policy requires uppercase letters (add --uppercase).`);
        }
        if (!explicit.lowercase && after.lowercase && !before.lowercase) {
          conflicts.push(`policy requires lowercase letters (add --lowercase).`);
        }
        if (!explicit.number && after.number && !before.number) {
          conflicts.push(`policy requires numbers (add --number).`);
        }
        if (!explicit.special && after.special && !before.special) {
          conflicts.push(`policy requires special characters (add --special).`);
        }
      }
    } else {
      if (explicit.words && after.numWords > before.numWords) {
        conflicts.push(
          `--words ${before.numWords}: policy requires a minimum of ${after.numWords} words.`,
        );
      }
    }

    return conflicts;
  }
}

class Options {
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
  length: number;
  type: "passphrase" | "password";
  separator: string;
  words: number;
  capitalize: boolean;
  includeNumber: boolean;
  minNumber: number;
  minSpecial: number;
  ambiguous: boolean;
  readonly explicit: ExplicitFlags;

  constructor(passedOptions: Record<string, any>) {
    this.explicit = {
      uppercase: passedOptions?.uppercase != null,
      lowercase: passedOptions?.lowercase != null,
      number: passedOptions?.number != null,
      special: passedOptions?.special != null,
      length: passedOptions?.length != null,
      minNumber: passedOptions?.minNumber != null,
      minSpecial: passedOptions?.minSpecial != null,
      words: passedOptions?.words != null,
    };

    this.uppercase = CliUtils.convertBooleanOption(passedOptions?.uppercase);
    this.lowercase = CliUtils.convertBooleanOption(passedOptions?.lowercase);
    this.number = CliUtils.convertBooleanOption(passedOptions?.number);
    this.special = CliUtils.convertBooleanOption(passedOptions?.special);
    this.capitalize = CliUtils.convertBooleanOption(passedOptions?.capitalize);
    this.includeNumber = CliUtils.convertBooleanOption(passedOptions?.includeNumber);
    this.ambiguous = CliUtils.convertBooleanOption(passedOptions?.ambiguous);
    this.length = CliUtils.convertNumberOption(
      passedOptions?.length,
      DefaultPasswordGenerationOptions.length,
    );
    this.type = passedOptions?.passphrase ? "passphrase" : "password";
    this.separator = CliUtils.convertStringOption(
      passedOptions?.separator,
      DefaultPassphraseGenerationOptions.wordSeparator,
    );
    this.words = CliUtils.convertNumberOption(
      passedOptions?.words,
      DefaultPassphraseGenerationOptions.numWords,
    );
    this.minNumber = CliUtils.convertNumberOption(
      passedOptions?.minNumber,
      DefaultPasswordGenerationOptions.minNumber,
    );
    this.minSpecial = CliUtils.convertNumberOption(
      passedOptions?.minSpecial,
      DefaultPasswordGenerationOptions.minSpecial,
    );

    if (!this.uppercase && !this.lowercase && !this.special && !this.number) {
      this.lowercase = true;
      this.uppercase = true;
      this.number = true;
    }
    if (this.length < 5) {
      this.length = 5;
    }
    if (this.words < 3) {
      this.words = 3;
    }
    if (this.separator === "space") {
      this.separator = " ";
    } else if (this.separator === "empty") {
      this.separator = "";
    } else if (this.separator != null && this.separator.length > 1) {
      this.separator = this.separator[0];
    }
  }
}
