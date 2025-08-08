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

export class GenerateCommand {
  constructor(
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private readonly accountService: AccountService,
    private readonly tokenService: TokenService,
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
    const enforcedOptions = shouldEnforceOptions
      ? (await this.passwordGenerationService.enforcePasswordGeneratorPoliciesOnOptions(options))[0]
      : options;

    const password = await this.passwordGenerationService.generatePassword(enforcedOptions);
    const res = new StringResponse(password);
    return Response.success(res);
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

  constructor(passedOptions: Record<string, any>) {
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
