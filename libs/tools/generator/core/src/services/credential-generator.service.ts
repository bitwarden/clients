// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { concatMap, distinctUntilChanged, map, Observable, switchMap, takeUntil } from "rxjs";
import { Simplify } from "type-fest";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BoundDependency, OnDependency } from "@bitwarden/common/tools/dependencies";
import { IntegrationMetadata } from "@bitwarden/common/tools/integration";
import { RestClient } from "@bitwarden/common/tools/integration/rpc";
import { anyComplete, withLatestReady } from "@bitwarden/common/tools/rx";
import { UserStateSubject } from "@bitwarden/common/tools/state/user-state-subject";
import { UserStateSubjectDependencyProvider } from "@bitwarden/common/tools/state/user-state-subject-dependency-provider";

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

type Generate$Dependencies = Simplify<
  OnDependency<GenerateRequest> & BoundDependency<"account", Account>
>;

export class CredentialGeneratorService {
  constructor(
    private readonly randomizer: Randomizer,
    private readonly policyService: PolicyService,
    private readonly apiService: ApiService,
    private readonly i18nService: I18nService,
    private readonly providers: UserStateSubjectDependencyProvider,
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
   *  @param dependences.account$ algorithms are filtered to only
   *   those matching the provided account's policy.
   *  @returns An observable that emits algorithm metadata.
   */
  algorithms$(
    category: CredentialCategory,
    dependencies: BoundDependency<"account", Account>,
  ): Observable<AlgorithmInfo[]>;
  algorithms$(
    category: CredentialCategory[],
    dependencies: BoundDependency<"account", Account>,
  ): Observable<AlgorithmInfo[]>;
  algorithms$(
    category: CredentialCategory | CredentialCategory[],
    dependencies: BoundDependency<"account", Account>,
  ) {
    // any cast required here because TypeScript fails to bind `category`
    // to the union-typed overload of `algorithms`.
    const algorithms = this.algorithms(category as any);

    // apply policy
    const algorithms$ = dependencies.account$.pipe(
      distinctUntilChanged(),
      switchMap((account) => {
        const policies$ = this.policyService.getAll$(PolicyType.PasswordGenerator, account.id).pipe(
          map((p) => new Set(availableAlgorithms(p))),
          // complete policy emissions otherwise `switchMap` holds `algorithms$` open indefinitely
          takeUntil(anyComplete(dependencies.account$)),
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
   * @param dependencies.account$ identifies the account to which the settings are bound.
   * @returns an observable that emits settings
   * @remarks the observable enforces policies on the settings
   */
  settings$<Settings extends object, Policy>(
    configuration: Configuration<Settings, Policy>,
    dependencies: BoundDependency<"account", Account>,
  ) {
    const constraints$ = this.policy$(configuration, dependencies);

    const settings = new UserStateSubject(configuration.settings.account, this.providers, {
      constraints$,
      account$: dependencies.account$,
    });

    const settings$ = settings.pipe(
      map((settings) => settings ?? structuredClone(configuration.settings.initial)),
    );

    return settings$;
  }

  /** Get a subject bound to credential generator preferences.
   *  @param dependencies.account$ identifies the account to which the preferences are bound
   *  @returns a subject bound to the user's preferences
   *  @remarks Preferences determine which algorithms are used when generating a
   *   credential from a credential category (e.g. `PassX` or `Username`). Preferences
   *   should not be used to hold navigation history. Use @bitwarden/generator-navigation
   *   instead.
   */
  preferences(
    dependencies: BoundDependency<"account", Account>,
  ): UserStateSubject<CredentialPreference> {
    // FIXME: enforce policy
    const subject = new UserStateSubject(PREFERENCES, this.providers, dependencies);

    return subject;
  }

  /** Get a subject bound to a specific user's settings
   * @param configuration determines which generator's settings are loaded
   * @param dependencies.account$ identifies the account to which the settings are bound
   * @returns a subject bound to the requested user's generator settings
   * @remarks the subject enforces policy for the settings
   */
  settings<Settings extends object, Policy>(
    configuration: Readonly<Configuration<Settings, Policy>>,
    dependencies: BoundDependency<"account", Account>,
  ) {
    const constraints$ = this.policy$(configuration, dependencies);

    const subject = new UserStateSubject(configuration.settings.account, this.providers, {
      constraints$,
      account$: dependencies.account$,
    });

    return subject;
  }

  /** Get the policy constraints for the provided configuration
   *  @param dependencies.account$ determines which user's policy is loaded
   *  @returns an observable that emits the policy once `dependencies.account$`
   *   and the policy become available.
   */
  policy$<Settings, Policy>(
    configuration: Configuration<Settings, Policy>,
    dependencies: BoundDependency<"account", Account>,
  ): Observable<GeneratorConstraints<Settings>> {
    const constraints$ = dependencies.account$.pipe(
      map((account) => {
        if (account.emailVerified) {
          return { userId: account.id, email: account.email };
        }

        return { userId: account.id, email: null };
      }),
      switchMap(({ userId, email }) => {
        // complete policy emissions otherwise `switchMap` holds `policies$` open indefinitely
        const policies$ = this.policyService
          .getAll$(configuration.policy.type, userId)
          .pipe(
            mapPolicyToConstraints(configuration.policy, email),
            takeUntil(anyComplete(dependencies.account$)),
          );
        return policies$;
      }),
    );

    return constraints$;
  }
}
