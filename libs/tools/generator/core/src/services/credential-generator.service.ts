// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  BehaviorSubject,
  concatMap,
  distinctUntilChanged,
  endWith,
  filter,
  firstValueFrom,
  ignoreElements,
  map,
  Observable,
  ReplaySubject,
  switchMap,
  takeUntil,
  withLatestFrom,
} from "rxjs";
import { Simplify } from "type-fest";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { LegacyEncryptorProvider } from "@bitwarden/common/tools/cryptography/legacy-encryptor-provider";
import {
  OnDependency,
  SingleUserDependency,
  UserDependency,
} from "@bitwarden/common/tools/dependencies";
import { IntegrationMetadata } from "@bitwarden/common/tools/integration";
import { RestClient } from "@bitwarden/common/tools/integration/rpc";
import { anyComplete, withLatestReady } from "@bitwarden/common/tools/rx";
import { UserStateSubject } from "@bitwarden/common/tools/state/user-state-subject";
import { UserId } from "@bitwarden/common/types/guid";

import { Randomizer } from "../abstractions";
import {
  Generators,
  getForwarderConfiguration,
  Integrations,
  toCredentialGeneratorConfiguration,
} from "../data";
import { availableAlgorithms } from "../policies/available-algorithms-policy";
import { mapPolicyToConstraints } from "../rx";
import {
  CredentialAlgorithm,
  CredentialCategories,
  CredentialCategory,
  AlgorithmInfo,
  CredentialPreference,
  isForwarderIntegration,
  ForwarderIntegration,
  GenerateRequest,
} from "../types";
import {
  CredentialGeneratorConfiguration as Configuration,
  CredentialGeneratorInfo,
  GeneratorDependencyProvider,
} from "../types/credential-generator-configuration";
import { GeneratorConstraints } from "../types/generator-constraints";

import { PREFERENCES } from "./credential-preferences";

type Policy$Dependencies = UserDependency;
type Settings$Dependencies = Partial<UserDependency>;
type Generate$Dependencies = Simplify<OnDependency<GenerateRequest> & Partial<UserDependency>>;

type Algorithms$Dependencies = Partial<UserDependency>;

const OPTIONS_FRAME_SIZE = 512;

export class CredentialGeneratorService {
  constructor(
    private readonly randomizer: Randomizer,
    private readonly stateProvider: StateProvider,
    private readonly policyService: PolicyService,
    private readonly apiService: ApiService,
    private readonly i18nService: I18nService,
    private readonly encryptorProvider: LegacyEncryptorProvider,
    private readonly accountService: AccountService,
  ) {}

  private getDependencyProvider(): GeneratorDependencyProvider {
    return {
      client: new RestClient(this.apiService, this.i18nService),
      i18nService: this.i18nService,
      randomizer: this.randomizer,
    };
  }

  // FIXME: the rxjs methods of this service can be a lot more resilient if
  // `Subjects` are introduced where sharing occurs

  /** Generates a stream of credentials
   * @param configuration determines which generator's settings are loaded
   * @param dependencies.on$ Required. A new credential is emitted when this emits.
   */
  generate$<Settings extends object, Policy>(
    configuration: Readonly<Configuration<Settings, Policy>>,
    dependencies: Generate$Dependencies,
  ) {
    const engine = configuration.engine.create(this.getDependencyProvider());
    const settings$ = this.settings$(configuration, dependencies);

    // generation proper
    const generate$ = dependencies.on$.pipe(
      withLatestReady(settings$),
      concatMap(([request, settings]) => engine.generate(request, settings)),
      takeUntil(anyComplete([settings$])),
    );

    return generate$;
  }

  /** Emits metadata concerning the provided generation algorithms
   *  @param category the category or categories of interest
   *  @param dependences.userId$ when provided, the algorithms are filter to only
   *   those matching the provided user's policy. Otherwise, emits the algorithms
   *   available to the active user.
   *  @returns An observable that emits algorithm metadata.
   */
  algorithms$(
    category: CredentialCategory,
    dependencies?: Algorithms$Dependencies,
  ): Observable<AlgorithmInfo[]>;
  algorithms$(
    category: CredentialCategory[],
    dependencies?: Algorithms$Dependencies,
  ): Observable<AlgorithmInfo[]>;
  algorithms$(
    category: CredentialCategory | CredentialCategory[],
    dependencies?: Algorithms$Dependencies,
  ) {
    // any cast required here because TypeScript fails to bind `category`
    // to the union-typed overload of `algorithms`.
    const algorithms = this.algorithms(category as any);

    // fall back to default bindings
    const userId$ = dependencies?.userId$ ?? this.stateProvider.activeUserId$;

    // monitor completion
    const completion$ = userId$.pipe(ignoreElements(), endWith(true));

    // apply policy
    const algorithms$ = userId$.pipe(
      distinctUntilChanged(),
      switchMap((userId) => {
        // complete policy emissions otherwise `switchMap` holds `algorithms$` open indefinitely
        const policies$ = this.policyService.getAll$(PolicyType.PasswordGenerator, userId).pipe(
          map((p) => new Set(availableAlgorithms(p))),
          takeUntil(completion$),
        );
        return policies$;
      }),
      map((available) => {
        const filtered = algorithms.filter(
          (c) => isForwarderIntegration(c.id) || available.has(c.id),
        );
        return filtered;
      }),
    );

    return algorithms$;
  }

  /** Lists metadata for the algorithms in a credential category
   *  @param category the category or categories of interest
   *  @returns A list containing the requested metadata.
   */
  algorithms(category: CredentialCategory): AlgorithmInfo[];
  algorithms(category: CredentialCategory[]): AlgorithmInfo[];
  algorithms(category: CredentialCategory | CredentialCategory[]): AlgorithmInfo[] {
    const categories: CredentialCategory[] = Array.isArray(category) ? category : [category];

    const algorithms = categories
      .flatMap((c) => CredentialCategories[c] as CredentialAlgorithm[])
      .map((id) => this.algorithm(id))
      .filter((info) => info !== null);

    const forwarders = Object.keys(Integrations)
      .map((key: keyof typeof Integrations) => {
        const forwarder: ForwarderIntegration = { forwarder: Integrations[key].id };
        return this.algorithm(forwarder);
      })
      .filter((forwarder) => categories.includes(forwarder.category));

    return algorithms.concat(forwarders);
  }

  /** Look up the metadata for a specific generator algorithm
   *  @param id identifies the algorithm
   *  @returns the requested metadata, or `null` if the metadata wasn't found.
   */
  algorithm(id: CredentialAlgorithm): AlgorithmInfo {
    let generator: CredentialGeneratorInfo = null;
    let integration: IntegrationMetadata = null;

    if (isForwarderIntegration(id)) {
      const forwarderConfig = getForwarderConfiguration(id.forwarder);
      integration = forwarderConfig;

      if (forwarderConfig) {
        generator = toCredentialGeneratorConfiguration(forwarderConfig);
      }
    } else {
      generator = Generators[id];
    }

    if (!generator) {
      throw new Error(`Invalid credential algorithm: ${JSON.stringify(id)}`);
    }

    const info: AlgorithmInfo = {
      id: generator.id,
      category: generator.category,
      name: integration ? integration.name : this.i18nService.t(generator.nameKey),
      generate: this.i18nService.t(generator.generateKey),
      onGeneratedMessage: this.i18nService.t(generator.onGeneratedMessageKey),
      credentialType: this.i18nService.t(generator.credentialTypeKey),
      copy: this.i18nService.t(generator.copyKey),
      useGeneratedValue: this.i18nService.t(generator.useGeneratedValueKey),
      onlyOnRequest: generator.onlyOnRequest,
      request: generator.request,
    };

    if (generator.descriptionKey) {
      info.description = this.i18nService.t(generator.descriptionKey);
    }

    return info;
  }

  /** Get the settings for the provided configuration
   * @param configuration determines which generator's settings are loaded
   * @param dependencies.userId$ identifies the user to which the settings are bound.
   *   If this parameter is not provided, the observable follows the active user and
   *   may not complete.
   * @returns an observable that emits settings
   * @remarks the observable enforces policies on the settings
   */
  settings$<Settings extends object, Policy>(
    configuration: Configuration<Settings, Policy>,
    dependencies?: Settings$Dependencies,
  ) {
    const userId$ = dependencies?.userId$ ?? this.stateProvider.activeUserId$;
    const constraints$ = this.policy$(configuration, { userId$ });

    const settings$ = userId$.pipe(
      filter((userId) => !!userId),
      distinctUntilChanged(),
      switchMap((userId) => {
        const singleUserId$ = new BehaviorSubject(userId);
        const singleUserEncryptor$ = this.encryptorProvider.userEncryptor$(OPTIONS_FRAME_SIZE, {
          singleUserId$,
        });

        const state$ = new UserStateSubject(
          configuration.settings.account,
          (key) => this.stateProvider.getUser(userId, key),
          { constraints$, singleUserEncryptor$ },
        );
        return state$;
      }),
      map((settings) => settings ?? structuredClone(configuration.settings.initial)),
      takeUntil(anyComplete(userId$)),
    );

    return settings$;
  }

  /** Get a subject bound to credential generator preferences.
   *  @param dependencies.singleUserId$ identifies the user to which the preferences are bound
   *  @returns a promise that resolves with the subject once `dependencies.singleUserId$`
   *   becomes available.
   *  @remarks Preferences determine which algorithms are used when generating a
   *   credential from a credential category (e.g. `PassX` or `Username`). Preferences
   *   should not be used to hold navigation history. Use @bitwarden/generator-navigation
   *   instead.
   */
  async preferences(
    dependencies: SingleUserDependency,
  ): Promise<UserStateSubject<CredentialPreference>> {
    const singleUserId$ = new ReplaySubject<UserId>(1);
    dependencies.singleUserId$
      .pipe(
        filter((userId) => !!userId),
        distinctUntilChanged(),
      )
      .subscribe(singleUserId$);
    const singleUserEncryptor$ = this.encryptorProvider.userEncryptor$(OPTIONS_FRAME_SIZE, {
      singleUserId$,
    });
    const userId = await firstValueFrom(singleUserId$);

    // FIXME: enforce policy
    const subject = new UserStateSubject(
      PREFERENCES,
      (key) => this.stateProvider.getUser(userId, key),
      { singleUserEncryptor$ },
    );

    return subject;
  }

  /** Get a subject bound to a specific user's settings
   * @param configuration determines which generator's settings are loaded
   * @param dependencies.singleUserId$ identifies the user to which the settings are bound
   * @returns a promise that resolves with the subject once
   *  `dependencies.singleUserId$` becomes available.
   * @remarks the subject enforces policy for the settings
   */
  async settings<Settings extends object, Policy>(
    configuration: Readonly<Configuration<Settings, Policy>>,
    dependencies: SingleUserDependency,
  ) {
    const singleUserId$ = new ReplaySubject<UserId>(1);
    dependencies.singleUserId$
      .pipe(
        filter((userId) => !!userId),
        distinctUntilChanged(),
      )
      .subscribe(singleUserId$);
    const singleUserEncryptor$ = this.encryptorProvider.userEncryptor$(OPTIONS_FRAME_SIZE, {
      singleUserId$,
    });
    const userId = await firstValueFrom(singleUserId$);

    const constraints$ = this.policy$(configuration, { userId$: dependencies.singleUserId$ });

    const subject = new UserStateSubject(
      configuration.settings.account,
      (key) => this.stateProvider.getUser(userId, key),
      { constraints$, singleUserEncryptor$ },
    );

    return subject;
  }

  /** Get the policy constraints for the provided configuration
   *  @param dependencies.userId$ determines which user's policy is loaded
   *  @returns an observable that emits the policy once `dependencies.userId$`
   *   and the policy become available.
   */
  policy$<Settings, Policy>(
    configuration: Configuration<Settings, Policy>,
    dependencies: Policy$Dependencies,
  ): Observable<GeneratorConstraints<Settings>> {
    const email$ = dependencies.userId$.pipe(
      distinctUntilChanged(),
      withLatestFrom(this.accountService.accounts$),
      filter((accounts) => !!accounts),
      map(([userId, accounts]) => {
        if (userId in accounts) {
          return { userId, email: accounts[userId].email };
        }

        return { userId, email: null };
      }),
    );

    const constraints$ = email$.pipe(
      switchMap(({ userId, email }) => {
        // complete policy emissions otherwise `switchMap` holds `policies$` open indefinitely
        const policies$ = this.policyService
          .getAll$(configuration.policy.type, userId)
          .pipe(
            mapPolicyToConstraints(configuration.policy, email),
            takeUntil(anyComplete(email$)),
          );
        return policies$;
      }),
    );

    return constraints$;
  }
}
