// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  concatMap,
  zip,
  map,
  firstValueFrom,
  combineLatest,
  pairwise,
  of,
  concat,
  Observable,
  filter,
  timeout,
} from "rxjs";

import { PasswordGeneratorPolicyOptions } from "@bitwarden/common/admin-console/models/domain/password-generator-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  GeneratorService,
  PassphraseGenerationOptions,
  PassphraseGeneratorPolicy,
  PasswordGenerationOptions,
  PasswordGeneratorPolicy,
  PolicyEvaluator,
} from "@bitwarden/generator-core";
import {
  GeneratedCredential,
  GeneratorHistoryService,
  GeneratedPasswordHistory,
} from "@bitwarden/generator-history";
import {
  GeneratorNavigationService,
  GeneratorNavigation,
  GeneratorNavigationPolicy,
} from "@bitwarden/generator-navigation";

import { PasswordGenerationServiceAbstraction } from "./password-generation.service.abstraction";
import { PasswordGeneratorOptions } from "./password-generator-options";

type MappedOptions = {
  generator: GeneratorNavigation;
  password: PasswordGenerationOptions;
  passphrase: PassphraseGenerationOptions;
  policyUpdated: boolean;
};

/** Adapts the generator 2.0 design to 1.0 angular services. */
export class LegacyPasswordGenerationService implements PasswordGenerationServiceAbstraction {
  constructor(
    private readonly accountService: AccountService,
    private readonly navigation: GeneratorNavigationService,
    private readonly passwords: GeneratorService<
      PasswordGenerationOptions,
      PasswordGeneratorPolicy
    >,
    private readonly passphrases: GeneratorService<
      PassphraseGenerationOptions,
      PassphraseGeneratorPolicy
    >,
    private readonly history: GeneratorHistoryService,
  ) {}

  generatePassword(options: PasswordGeneratorOptions) {
    if (options.type === "password") {
      return this.passwords.generate(options);
    } else {
      return this.passphrases.generate(options);
    }
  }

  generatePassphrase(options: PasswordGeneratorOptions) {
    return this.passphrases.generate(options);
  }

  private getRawOptions$() {
    // give the typechecker a nudge to avoid "implicit any" errors
    type RawOptionsIntermediateType = [
      PasswordGenerationOptions,
      PasswordGenerationOptions,
      [PolicyEvaluator<PasswordGeneratorPolicy, PasswordGenerationOptions>, number],
      PassphraseGenerationOptions,
      PassphraseGenerationOptions,
      [PolicyEvaluator<PassphraseGeneratorPolicy, PassphraseGenerationOptions>, number],
      GeneratorNavigation,
      GeneratorNavigation,
      [PolicyEvaluator<GeneratorNavigationPolicy, GeneratorNavigation>, number],
    ];

    function withSequenceNumber<T>(observable$: Observable<T>) {
      return observable$.pipe(map((evaluator, i) => [evaluator, i] as const));
    }

    // initial array ensures that destructuring never fails; sequence numbers
    // set to `-1` so that the first update reflects that the policy changed from
    // "unknown" to "whatever was provided by the service". This needs to be called
    // each time the active user changes or the `concat` will block.
    function initial$() {
      const initial: RawOptionsIntermediateType = [
        null,
        null,
        [null, -1],
        null,
        null,
        [null, -1],
        null,
        null,
        [null, -1],
      ];

      return of(initial);
    }

    function intermediatePairsToRawOptions([previous, current]: [
      RawOptionsIntermediateType,
      RawOptionsIntermediateType,
    ]) {
      const [, , [, passwordPrevious], , , [, passphrasePrevious], , , [, generatorPrevious]] =
        previous;
      const [
        passwordOptions,
        passwordDefaults,
        [passwordEvaluator, passwordCurrent],
        passphraseOptions,
        passphraseDefaults,
        [passphraseEvaluator, passphraseCurrent],
        generatorOptions,
        generatorDefaults,
        [generatorEvaluator, generatorCurrent],
      ] = current;

      // when any of the sequence numbers change, the emission occurs as the result of
      // a policy update
      const policyEmitted =
        passwordPrevious < passwordCurrent ||
        passphrasePrevious < passphraseCurrent ||
        generatorPrevious < generatorCurrent;

      const result = [
        passwordOptions,
        passwordDefaults,
        passwordEvaluator,
        passphraseOptions,
        passphraseDefaults,
        passphraseEvaluator,
        generatorOptions,
        generatorDefaults,
        generatorEvaluator,
        policyEmitted,
      ] as const;

      return result;
    }

    // look upon my works, ye mighty, and despair!
    const rawOptions$ = this.accountService.activeAccount$.pipe(
      concatMap((activeUser) =>
        concat(
          initial$(),
          combineLatest([
            this.passwords.options$(activeUser.id),
            this.passwords.defaults$(activeUser.id),
            withSequenceNumber(this.passwords.evaluator$(activeUser.id)),
            this.passphrases.options$(activeUser.id),
            this.passphrases.defaults$(activeUser.id),
            withSequenceNumber(this.passphrases.evaluator$(activeUser.id)),
            this.navigation.options$(activeUser.id),
            this.navigation.defaults$(activeUser.id),
            withSequenceNumber(this.navigation.evaluator$(activeUser.id)),
          ]),
        ),
      ),
      pairwise(),
      map(intermediatePairsToRawOptions),
    );

    return rawOptions$;
  }

  getOptions$() {
    const options$ = this.getRawOptions$().pipe(
      map(
        ([
          passwordOptions,
          passwordDefaults,
          passwordEvaluator,
          passphraseOptions,
          passphraseDefaults,
          passphraseEvaluator,
          generatorOptions,
          generatorDefaults,
          generatorEvaluator,
          policyUpdated,
        ]) => {
          const passwordOptionsWithPolicy = passwordEvaluator.applyPolicy(
            passwordOptions ?? passwordDefaults,
          );
          const passphraseOptionsWithPolicy = passphraseEvaluator.applyPolicy(
            passphraseOptions ?? passphraseDefaults,
          );
          const generatorOptionsWithPolicy = generatorEvaluator.applyPolicy(
            generatorOptions ?? generatorDefaults,
          );

          const options = this.toPasswordGeneratorOptions({
            password: passwordEvaluator.sanitize(passwordOptionsWithPolicy),
            passphrase: passphraseEvaluator.sanitize(passphraseOptionsWithPolicy),
            generator: generatorEvaluator.sanitize(generatorOptionsWithPolicy),
            policyUpdated,
          });

          const policy = Object.assign(
            new PasswordGeneratorPolicyOptions(),
            passwordEvaluator.policy,
            passphraseEvaluator.policy,
            generatorEvaluator.policy,
          );

          return [options, policy] as [PasswordGeneratorOptions, PasswordGeneratorPolicyOptions];
        },
      ),
    );

    return options$;
  }

  async getOptions() {
    return await firstValueFrom(this.getOptions$());
  }

  async enforcePasswordGeneratorPoliciesOnOptions(options: PasswordGeneratorOptions) {
    const options$ = this.accountService.activeAccount$.pipe(
      concatMap((activeUser) =>
        zip(
          this.passwords.evaluator$(activeUser.id),
          this.passphrases.evaluator$(activeUser.id),
          this.navigation.evaluator$(activeUser.id),
        ),
      ),
      map(([passwordEvaluator, passphraseEvaluator, navigationEvaluator]) => {
        const policy = Object.assign(
          new PasswordGeneratorPolicyOptions(),
          passwordEvaluator.policy,
          passphraseEvaluator.policy,
          navigationEvaluator.policy,
        );

        const navigationApplied = navigationEvaluator.applyPolicy(options);
        const navigationSanitized = {
          ...options,
          ...navigationEvaluator.sanitize(navigationApplied),
        };
        if (navigationSanitized.type === "password") {
          const applied = passwordEvaluator.applyPolicy(navigationSanitized);
          const sanitized = passwordEvaluator.sanitize(applied);
          return [sanitized, policy];
        } else {
          const applied = passphraseEvaluator.applyPolicy(navigationSanitized);
          const sanitized = passphraseEvaluator.sanitize(applied);
          return [sanitized, policy];
        }
      }),
    );

    const [sanitized, policy] = await firstValueFrom(options$);
    return [
      // callers assume this function updates the options parameter
      Object.assign(options, sanitized),
      policy,
    ] as [PasswordGeneratorOptions, PasswordGeneratorPolicyOptions];
  }

  async saveOptions(options: PasswordGeneratorOptions) {
    const stored = this.toStoredOptions(options);
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    // generator settings needs to preserve whether password or passphrase is selected,
    // so `navigationOptions` is mutated.
    const navigationOptions$ = zip(
      this.navigation.options$(activeAccount.id),
      this.navigation.defaults$(activeAccount.id),
    ).pipe(map(([options, defaults]) => options ?? defaults));
    let navigationOptions = await firstValueFrom(navigationOptions$);
    navigationOptions = Object.assign(navigationOptions, stored.generator);
    await this.navigation.saveOptions(activeAccount.id, navigationOptions);

    // overwrite all other settings with latest values
    await this.passwords.saveOptions(activeAccount.id, stored.password);
    await this.passphrases.saveOptions(activeAccount.id, stored.passphrase);
  }

  private toStoredOptions(options: PasswordGeneratorOptions): MappedOptions {
    return {
      generator: {
        type: options.type,
      },
      password: {
        length: options.length,
        minLength: options.minLength,
        ambiguous: options.ambiguous,
        uppercase: options.uppercase,
        minUppercase: options.minUppercase,
        lowercase: options.lowercase,
        minLowercase: options.minLowercase,
        number: options.number,
        minNumber: options.minNumber,
        special: options.special,
        minSpecial: options.minSpecial,
      },
      passphrase: {
        numWords: options.numWords,
        wordSeparator: options.wordSeparator,
        capitalize: options.capitalize,
        includeNumber: options.includeNumber,
      },
      policyUpdated: false,
    };
  }

  private toPasswordGeneratorOptions(options: MappedOptions): PasswordGeneratorOptions {
    return {
      type: options.generator.type,
      length: options.password.length,
      minLength: options.password.minLength,
      ambiguous: options.password.ambiguous,
      uppercase: options.password.uppercase,
      minUppercase: options.password.minUppercase,
      lowercase: options.password.lowercase,
      minLowercase: options.password.minLowercase,
      number: options.password.number,
      minNumber: options.password.minNumber,
      special: options.password.special,
      minSpecial: options.password.minSpecial,
      numWords: options.passphrase.numWords,
      wordSeparator: options.passphrase.wordSeparator,
      capitalize: options.passphrase.capitalize,
      includeNumber: options.passphrase.includeNumber,
      policyUpdated: options.policyUpdated,
    };
  }

  getHistory() {
    const history = this.accountService.activeAccount$.pipe(
      concatMap((account) => this.history.credentials$(account.id)),
      timeout({
        // timeout after 1 second
        each: 1000,
        // TODO(PM-22309): Typescript 5.8 update, confirm type
        with(): any[] {
          return [];
        },
      }),
      map((history) => history.map(toGeneratedPasswordHistory)),
    );

    return firstValueFrom(history);
  }

  async addHistory(password: string) {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (account?.id) {
      // legacy service doesn't distinguish credential types
      await this.history.track(account.id, password, "password");
    }
  }

  clear() {
    const history$ = this.accountService.activeAccount$.pipe(
      filter((account) => !!account?.id),
      concatMap((account) => this.history.clear(account.id)),
      timeout({
        // timeout after 1 second
        each: 1000,
        // TODO(PM-22309): Typescript 5.8 update, confirm type
        with(): any[] {
          return [];
        },
      }),
      map((history) => history.map(toGeneratedPasswordHistory)),
    );

    return firstValueFrom(history$);
  }
}

function toGeneratedPasswordHistory(value: GeneratedCredential) {
  return new GeneratedPasswordHistory(value.credential, value.generationDate.valueOf());
}
