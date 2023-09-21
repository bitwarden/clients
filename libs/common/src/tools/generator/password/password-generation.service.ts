import { PolicyService } from "../../../admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "../../../admin-console/enums";
import { PasswordGeneratorPolicyOptions } from "../../../admin-console/models/domain/password-generator-policy-options";
import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { StateService } from "../../../platform/abstractions/state.service";
import { EFFLongWordList } from "../../../platform/misc/wordlist";
import { EncString } from "../../../platform/models/domain/enc-string";

import { GeneratedPasswordHistory } from "./generated-password-history";
import { PasswordGenerationServiceAbstraction } from "./password-generation.service.abstraction";
import { PasswordGeneratorOptions } from "./password-generator-options";

const DefaultOptions: PasswordGeneratorOptions = {
  length: 14,
  ambiguous: false,
  number: true,
  minNumber: 1,
  uppercase: true,
  minUppercase: 0,
  lowercase: true,
  minLowercase: 0,
  special: false,
  minSpecial: 1,
  type: "password",
  numWords: 3,
  wordSeparator: "-",
  capitalize: false,
  includeNumber: false,
};

const MaxPasswordsInHistory = 100;

export class PasswordGenerationService implements PasswordGenerationServiceAbstraction {
  constructor(
    private cryptoService: CryptoService,
    private policyService: PolicyService,
    private stateService: StateService
  ) {}

  async generatePassword(options: PasswordGeneratorOptions): Promise<string> {
    // overload defaults with given options
    const o = Object.assign({}, DefaultOptions, options);

    if (o.type === "passphrase") {
      return this.generatePassphrase(options);
    }

    // sanitize
    this.sanitizePasswordLength(o, true);

    const minLength: number = o.minUppercase + o.minLowercase + o.minNumber + o.minSpecial;
    if (o.length < minLength) {
      o.length = minLength;
    }

    const positions: string[] = [];
    if (o.lowercase && o.minLowercase > 0) {
      for (let i = 0; i < o.minLowercase; i++) {
        positions.push("l");
      }
    }
    if (o.uppercase && o.minUppercase > 0) {
      for (let i = 0; i < o.minUppercase; i++) {
        positions.push("u");
      }
    }
    if (o.number && o.minNumber > 0) {
      for (let i = 0; i < o.minNumber; i++) {
        positions.push("n");
      }
    }
    if (o.special && o.minSpecial > 0) {
      for (let i = 0; i < o.minSpecial; i++) {
        positions.push("s");
      }
    }
    while (positions.length < o.length) {
      positions.push("a");
    }

    // shuffle
    await this.shuffleArray(positions);

    // build out the char sets
    let allCharSet = "";

    let lowercaseCharSet = "abcdefghijkmnopqrstuvwxyz";
    if (o.ambiguous) {
      lowercaseCharSet += "l";
    }
    if (o.lowercase) {
      allCharSet += lowercaseCharSet;
    }

    let uppercaseCharSet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    if (o.ambiguous) {
      uppercaseCharSet += "IO";
    }
    if (o.uppercase) {
      allCharSet += uppercaseCharSet;
    }

    let numberCharSet = "23456789";
    if (o.ambiguous) {
      numberCharSet += "01";
    }
    if (o.number) {
      allCharSet += numberCharSet;
    }

    const specialCharSet = "!@#$%^&*";
    if (o.special) {
      allCharSet += specialCharSet;
    }

    let password = "";
    for (let i = 0; i < o.length; i++) {
      let positionChars: string;
      switch (positions[i]) {
        case "l":
          positionChars = lowercaseCharSet;
          break;
        case "u":
          positionChars = uppercaseCharSet;
          break;
        case "n":
          positionChars = numberCharSet;
          break;
        case "s":
          positionChars = specialCharSet;
          break;
        case "a":
          positionChars = allCharSet;
          break;
        default:
          break;
      }

      const randomCharIndex = await this.cryptoService.randomNumber(0, positionChars.length - 1);
      password += positionChars.charAt(randomCharIndex);
    }

    return password;
  }

  async generatePassphrase(options: PasswordGeneratorOptions): Promise<string> {
    const o = Object.assign({}, DefaultOptions, options);

    if (o.numWords == null || o.numWords <= 2) {
      o.numWords = DefaultOptions.numWords;
    }
    if (o.wordSeparator == null || o.wordSeparator.length === 0 || o.wordSeparator.length > 1) {
      o.wordSeparator = " ";
    }
    if (o.capitalize == null) {
      o.capitalize = false;
    }
    if (o.includeNumber == null) {
      o.includeNumber = false;
    }

    const listLength = EFFLongWordList.length - 1;
    const wordList = new Array(o.numWords);
    for (let i = 0; i < o.numWords; i++) {
      const wordIndex = await this.cryptoService.randomNumber(0, listLength);
      if (o.capitalize) {
        wordList[i] = this.capitalize(EFFLongWordList[wordIndex]);
      } else {
        wordList[i] = EFFLongWordList[wordIndex];
      }
    }

    if (o.includeNumber) {
      await this.appendRandomNumberToRandomWord(wordList);
    }
    return wordList.join(o.wordSeparator);
  }

  async getOptions(): Promise<[PasswordGeneratorOptions, PasswordGeneratorPolicyOptions]> {
    let options = await this.stateService.getPasswordGenerationOptions();
    if (options == null) {
      options = Object.assign({}, DefaultOptions);
    } else {
      options = Object.assign({}, DefaultOptions, options);
    }
    await this.stateService.setPasswordGenerationOptions(options);
    const enforcedOptions = await this.enforcePasswordGeneratorPoliciesOnOptions(options);
    options = enforcedOptions[0];
    return [options, enforcedOptions[1]];
  }

  async enforcePasswordGeneratorPoliciesOnOptions(
    options: PasswordGeneratorOptions
  ): Promise<[PasswordGeneratorOptions, PasswordGeneratorPolicyOptions]> {
    let enforcedPolicyOptions = await this.getPasswordGeneratorPolicyOptions();
    if (enforcedPolicyOptions != null) {
      if (options.length < enforcedPolicyOptions.minLength) {
        options.length = enforcedPolicyOptions.minLength;
      }

      if (enforcedPolicyOptions.useUppercase) {
        options.uppercase = true;
      }

      if (enforcedPolicyOptions.useLowercase) {
        options.lowercase = true;
      }

      if (enforcedPolicyOptions.useNumbers) {
        options.number = true;
      }

      if (options.minNumber < enforcedPolicyOptions.numberCount) {
        options.minNumber = enforcedPolicyOptions.numberCount;
      }

      if (enforcedPolicyOptions.useSpecial) {
        options.special = true;
      }

      if (options.minSpecial < enforcedPolicyOptions.specialCount) {
        options.minSpecial = enforcedPolicyOptions.specialCount;
      }

      // Must normalize these fields because the receiving call expects all options to pass the current rules
      if (options.minSpecial + options.minNumber > options.length) {
        options.minSpecial = options.length - options.minNumber;
      }

      if (options.numWords < enforcedPolicyOptions.minNumberWords) {
        options.numWords = enforcedPolicyOptions.minNumberWords;
      }

      if (enforcedPolicyOptions.capitalize) {
        options.capitalize = true;
      }

      if (enforcedPolicyOptions.includeNumber) {
        options.includeNumber = true;
      }

      // Force default type if password/passphrase selected via policy
      if (
        enforcedPolicyOptions.defaultType === "password" ||
        enforcedPolicyOptions.defaultType === "passphrase"
      ) {
        options.type = enforcedPolicyOptions.defaultType;
      }
    } else {
      // UI layer expects an instantiated object to prevent more explicit null checks
      enforcedPolicyOptions = new PasswordGeneratorPolicyOptions();
    }
    return [options, enforcedPolicyOptions];
  }

  async getPasswordGeneratorPolicyOptions(): Promise<PasswordGeneratorPolicyOptions> {
    const policies = await this.policyService?.getAll(PolicyType.PasswordGenerator);
    let enforcedOptions: PasswordGeneratorPolicyOptions = null;

    if (policies == null || policies.length === 0) {
      return enforcedOptions;
    }

    policies.forEach((currentPolicy) => {
      if (!currentPolicy.enabled || currentPolicy.data == null) {
        return;
      }

      if (enforcedOptions == null) {
        enforcedOptions = new PasswordGeneratorPolicyOptions();
      }

      // Password wins in multi-org collisions
      if (currentPolicy.data.defaultType != null && enforcedOptions.defaultType !== "password") {
        enforcedOptions.defaultType = currentPolicy.data.defaultType;
      }

      if (
        currentPolicy.data.minLength != null &&
        currentPolicy.data.minLength > enforcedOptions.minLength
      ) {
        enforcedOptions.minLength = currentPolicy.data.minLength;
      }

      if (currentPolicy.data.useUpper) {
        enforcedOptions.useUppercase = true;
      }

      if (currentPolicy.data.useLower) {
        enforcedOptions.useLowercase = true;
      }

      if (currentPolicy.data.useNumbers) {
        enforcedOptions.useNumbers = true;
      }

      if (
        currentPolicy.data.minNumbers != null &&
        currentPolicy.data.minNumbers > enforcedOptions.numberCount
      ) {
        enforcedOptions.numberCount = currentPolicy.data.minNumbers;
      }

      if (currentPolicy.data.useSpecial) {
        enforcedOptions.useSpecial = true;
      }

      if (
        currentPolicy.data.minSpecial != null &&
        currentPolicy.data.minSpecial > enforcedOptions.specialCount
      ) {
        enforcedOptions.specialCount = currentPolicy.data.minSpecial;
      }

      if (
        currentPolicy.data.minNumberWords != null &&
        currentPolicy.data.minNumberWords > enforcedOptions.minNumberWords
      ) {
        enforcedOptions.minNumberWords = currentPolicy.data.minNumberWords;
      }

      if (currentPolicy.data.capitalize) {
        enforcedOptions.capitalize = true;
      }

      if (currentPolicy.data.includeNumber) {
        enforcedOptions.includeNumber = true;
      }
    });

    return enforcedOptions;
  }

  async saveOptions(options: PasswordGeneratorOptions) {
    await this.stateService.setPasswordGenerationOptions(options);
  }

  async getHistory(): Promise<GeneratedPasswordHistory[]> {
    const hasKey = await this.cryptoService.hasUserKey();
    if (!hasKey) {
      return new Array<GeneratedPasswordHistory>();
    }

    if ((await this.stateService.getDecryptedPasswordGenerationHistory()) == null) {
      const encrypted = await this.stateService.getEncryptedPasswordGenerationHistory();
      const decrypted = await this.decryptHistory(encrypted);
      await this.stateService.setDecryptedPasswordGenerationHistory(decrypted);
    }

    const passwordGenerationHistory =
      await this.stateService.getDecryptedPasswordGenerationHistory();
    return passwordGenerationHistory != null
      ? passwordGenerationHistory
      : new Array<GeneratedPasswordHistory>();
  }

  async addHistory(password: string): Promise<void> {
    // Cannot add new history if no key is available
    const hasKey = await this.cryptoService.hasUserKey();
    if (!hasKey) {
      return;
    }

    const currentHistory = await this.getHistory();

    // Prevent duplicates
    if (this.matchesPrevious(password, currentHistory)) {
      return;
    }

    currentHistory.unshift(new GeneratedPasswordHistory(password, Date.now()));

    // Remove old items.
    if (currentHistory.length > MaxPasswordsInHistory) {
      currentHistory.pop();
    }

    const newHistory = await this.encryptHistory(currentHistory);
    await this.stateService.setDecryptedPasswordGenerationHistory(currentHistory);
    return await this.stateService.setEncryptedPasswordGenerationHistory(newHistory);
  }

  async clear(userId?: string): Promise<void> {
    await this.stateService.setEncryptedPasswordGenerationHistory(null, { userId: userId });
    await this.stateService.setDecryptedPasswordGenerationHistory(null, { userId: userId });
  }

  normalizeOptions(
    options: PasswordGeneratorOptions,
    enforcedPolicyOptions: PasswordGeneratorPolicyOptions
  ) {
    options.minLowercase = 0;
    options.minUppercase = 0;

    if (!options.length || options.length < 5) {
      options.length = 5;
    } else if (options.length > 128) {
      options.length = 128;
    }

    if (options.length < enforcedPolicyOptions.minLength) {
      options.length = enforcedPolicyOptions.minLength;
    }

    if (!options.minNumber) {
      options.minNumber = 0;
    } else if (options.minNumber > options.length) {
      options.minNumber = options.length;
    } else if (options.minNumber > 9) {
      options.minNumber = 9;
    }

    if (options.minNumber < enforcedPolicyOptions.numberCount) {
      options.minNumber = enforcedPolicyOptions.numberCount;
    }

    if (!options.minSpecial) {
      options.minSpecial = 0;
    } else if (options.minSpecial > options.length) {
      options.minSpecial = options.length;
    } else if (options.minSpecial > 9) {
      options.minSpecial = 9;
    }

    if (options.minSpecial < enforcedPolicyOptions.specialCount) {
      options.minSpecial = enforcedPolicyOptions.specialCount;
    }

    if (options.minSpecial + options.minNumber > options.length) {
      options.minSpecial = options.length - options.minNumber;
    }

    if (options.numWords == null || options.length < 3) {
      options.numWords = 3;
    } else if (options.numWords > 20) {
      options.numWords = 20;
    }

    if (options.numWords < enforcedPolicyOptions.minNumberWords) {
      options.numWords = enforcedPolicyOptions.minNumberWords;
    }

    if (options.wordSeparator != null && options.wordSeparator.length > 1) {
      options.wordSeparator = options.wordSeparator[0];
    }

    this.sanitizePasswordLength(options, false);
  }

  private capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private async appendRandomNumberToRandomWord(wordList: string[]) {
    if (wordList == null || wordList.length <= 0) {
      return;
    }
    const index = await this.cryptoService.randomNumber(0, wordList.length - 1);
    const num = await this.cryptoService.randomNumber(0, 9);
    wordList[index] = wordList[index] + num;
  }

  private async encryptHistory(
    history: GeneratedPasswordHistory[]
  ): Promise<GeneratedPasswordHistory[]> {
    if (history == null || history.length === 0) {
      return Promise.resolve([]);
    }

    const promises = history.map(async (item) => {
      const encrypted = await this.cryptoService.encrypt(item.password);
      return new GeneratedPasswordHistory(encrypted.encryptedString, item.date);
    });

    return await Promise.all(promises);
  }

  private async decryptHistory(
    history: GeneratedPasswordHistory[]
  ): Promise<GeneratedPasswordHistory[]> {
    if (history == null || history.length === 0) {
      return Promise.resolve([]);
    }

    const promises = history.map(async (item) => {
      const decrypted = await this.cryptoService.decryptToUtf8(new EncString(item.password));
      return new GeneratedPasswordHistory(decrypted, item.date);
    });

    return await Promise.all(promises);
  }

  private matchesPrevious(password: string, history: GeneratedPasswordHistory[]): boolean {
    if (history == null || history.length === 0) {
      return false;
    }

    return history[history.length - 1].password === password;
  }

  // ref: https://stackoverflow.com/a/12646864/1090359
  private async shuffleArray(array: string[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = await this.cryptoService.randomNumber(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  private sanitizePasswordLength(options: any, forGeneration: boolean) {
    let minUppercaseCalc = 0;
    let minLowercaseCalc = 0;
    let minNumberCalc: number = options.minNumber;
    let minSpecialCalc: number = options.minSpecial;

    if (options.uppercase && options.minUppercase <= 0) {
      minUppercaseCalc = 1;
    } else if (!options.uppercase) {
      minUppercaseCalc = 0;
    }

    if (options.lowercase && options.minLowercase <= 0) {
      minLowercaseCalc = 1;
    } else if (!options.lowercase) {
      minLowercaseCalc = 0;
    }

    if (options.number && options.minNumber <= 0) {
      minNumberCalc = 1;
    } else if (!options.number) {
      minNumberCalc = 0;
    }

    if (options.special && options.minSpecial <= 0) {
      minSpecialCalc = 1;
    } else if (!options.special) {
      minSpecialCalc = 0;
    }

    // This should never happen but is a final safety net
    if (!options.length || options.length < 1) {
      options.length = 10;
    }

    const minLength: number = minUppercaseCalc + minLowercaseCalc + minNumberCalc + minSpecialCalc;
    // Normalize and Generation both require this modification
    if (options.length < minLength) {
      options.length = minLength;
    }

    // Apply other changes if the options object passed in is for generation
    if (forGeneration) {
      options.minUppercase = minUppercaseCalc;
      options.minLowercase = minLowercaseCalc;
      options.minNumber = minNumberCalc;
      options.minSpecial = minSpecialCalc;
    }
  }
}
