import { PolicyService } from "../../../admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "../../../admin-console/enums";
import { PasswordGeneratorPolicyOptions } from "../../../admin-console/models/domain/password-generator-policy-options";
import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { StateService } from "../../../platform/abstractions/state.service";
import { EFFLongWordList } from "../../../platform/misc/wordlist";
import { EncString } from "../../../platform/models/domain/enc-string";
import { PassphraseGeneratorOptionsEvaluator } from "../passphrase/passphrase-generator-options-evaluator";

import { GeneratedPasswordHistory } from "./generated-password-history";
import { PasswordGenerationServiceAbstraction } from "./password-generation.service.abstraction";
import { PasswordGeneratorOptions } from "./password-generator-options";
import { PasswordGeneratorOptionsEvaluator } from "./password-generator-options-evaluator";

const DefaultOptions: PasswordGeneratorOptions = {
  length: 14,
  minLength: 5,
  ambiguous: false,
  number: true,
  minNumber: 1,
  uppercase: true,
  minUppercase: 0,
  lowercase: true,
  minLowercase: 0,
  special: false,
  minSpecial: 0,
  type: "password",
  numWords: 3,
  wordSeparator: "-",
  capitalize: false,
  includeNumber: false,
};

const DefaultPolicy = new PasswordGeneratorPolicyOptions();

const MaxPasswordsInHistory = 100;

export class PasswordGenerationService implements PasswordGenerationServiceAbstraction {
  constructor(
    private cryptoService: CryptoService,
    private policyService: PolicyService,
    private stateService: StateService,
  ) {}

  async generatePassword(options: PasswordGeneratorOptions): Promise<string> {
    if ((options.type ?? DefaultOptions.type) === "passphrase") {
      return this.generatePassphrase({ ...DefaultOptions, ...options });
    }

    const evaluator = new PasswordGeneratorOptionsEvaluator(DefaultPolicy);
    const o = evaluator.sanitize({ ...DefaultOptions, ...options });

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
    const evaluator = new PassphraseGeneratorOptionsEvaluator(DefaultPolicy);
    const o = evaluator.sanitize({ ...DefaultOptions, ...options });

    if (o.numWords == null || o.numWords <= 2) {
      o.numWords = DefaultOptions.numWords;
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
    options: PasswordGeneratorOptions,
  ): Promise<[PasswordGeneratorOptions, PasswordGeneratorPolicyOptions]> {
    let policy = await this.getPasswordGeneratorPolicyOptions();
    policy = policy ?? new PasswordGeneratorPolicyOptions();

    // Force default type if password/passphrase selected via policy
    if (policy.defaultType === "password" || policy.defaultType === "passphrase") {
      options.type = policy.defaultType;
    }

    const evaluator =
      options.type == "password"
        ? new PasswordGeneratorOptionsEvaluator(policy)
        : new PassphraseGeneratorOptionsEvaluator(policy);

    // Ensure the options to pass the current rules
    const withPolicy = evaluator.applyPolicy(options);
    const sanitized = evaluator.sanitize(withPolicy);

    // callers assume this function updates the options parameter
    const result = Object.assign(options, sanitized);
    return [result, policy];
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
    enforcedPolicyOptions: PasswordGeneratorPolicyOptions,
  ) {
    const evaluator =
      options.type == "password"
        ? new PasswordGeneratorOptionsEvaluator(enforcedPolicyOptions)
        : new PassphraseGeneratorOptionsEvaluator(enforcedPolicyOptions);

    const evaluatedOptions = evaluator.applyPolicy(options);
    const santizedOptions = evaluator.sanitize(evaluatedOptions);

    // callers assume this function updates the options parameter
    Object.assign(options, santizedOptions);

    return options;
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
    history: GeneratedPasswordHistory[],
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
    history: GeneratedPasswordHistory[],
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
}
