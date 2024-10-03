import {
  BehaviorSubject,
  combineLatest,
  concat,
  concatMap,
  distinctUntilChanged,
  endWith,
  filter,
  first,
  firstValueFrom,
  ignoreElements,
  map,
  Observable,
  race,
  share,
  skipUntil,
  switchMap,
  takeUntil,
  withLatestFrom,
} from "rxjs";
import { Simplify } from "type-fest";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { StateProvider } from "@bitwarden/common/platform/state";
import {
  OnDependency,
  SingleUserDependency,
  UserDependency,
} from "@bitwarden/common/tools/dependencies";
import { isDynamic } from "@bitwarden/common/tools/state/state-constraints-dependency";
import { UserStateSubject } from "@bitwarden/common/tools/state/user-state-subject";

import { Randomizer } from "../abstractions";
import { SshKeyNativeGenerator } from "../abstractions/sshkey-native-generator.abstraction";
import { Generators } from "../data";
import { availableAlgorithms } from "../policies/available-algorithms-policy";
import { mapPolicyToConstraints } from "../rx";
import {
  CredentialAlgorithm,
  CredentialCategories,
  CredentialCategory,
  CredentialGeneratorInfo,
  CredentialPreference,
} from "../types";
import { CredentialGeneratorConfiguration as Configuration } from "../types/credential-generator-configuration";
import { GeneratorConstraints } from "../types/generator-constraints";

import { PREFERENCES } from "./credential-preferences";

type Policy$Dependencies = UserDependency;
type Settings$Dependencies = Partial<UserDependency>;
type Generate$Dependencies = Simplify<Partial<OnDependency> & Partial<UserDependency>> & {
  /** Emits the active website when subscribed.
   *
   *  The generator does not respond to emissions of this interface;
   *  If it is provided, the generator blocks until a value becomes available.
   *  When `website$` is omitted, the generator uses the empty string instead.
   *  When `website$` completes, the generator completes.
   *  When `website$` errors, the generator forwards the error.
   */
  website$?: Observable<string>;
};

type Algorithms$Dependencies = Partial<UserDependency>;

export class CredentialGeneratorService {
  constructor(
    private randomizer: Randomizer,
    private stateProvider: StateProvider,
    private policyService: PolicyService,
    private sshNativeGenerator: SshKeyNativeGenerator,
  ) {}

  // FIXME: the rxjs methods of this service can be a lot more resilient if
  // `Subjects` are introduced where sharing occurs

  /** Generates a stream of credentials
   * @param configuration determines which generator's settings are loaded
   * @param dependencies.on$ when specified, a new credential is emitted when
   *   this emits. Otherwise, a new credential is emitted when the settings
   *   update.
   */
  generate$<Settings extends object, Policy>(
    configuration: Readonly<Configuration<Settings, Policy>>,
    dependencies?: Generate$Dependencies,
  ) {
    // instantiate the engine
    const engine = configuration.engine.create(this.randomizer, this.sshNativeGenerator);

    // stream blocks until all of these values are received
    const website$ = dependencies?.website$ ?? new BehaviorSubject<string>(null);
    const request$ = website$.pipe(map((website) => ({ website })));
    const settings$ = this.settings$(configuration, dependencies);

    // monitor completion
    const requestComplete$ = request$.pipe(ignoreElements(), endWith(true));
    const settingsComplete$ = request$.pipe(ignoreElements(), endWith(true));
    const complete$ = race(requestComplete$, settingsComplete$);

    // if on$ triggers before settings are loaded, trigger as soon
    // as they become available.
    let readyOn$: Observable<any> = null;
    if (dependencies?.on$) {
      const NO_EMISSIONS = {};
      const ready$ = combineLatest([settings$, request$]).pipe(
        first(null, NO_EMISSIONS),
        filter((value) => value !== NO_EMISSIONS),
        share(),
      );
      readyOn$ = concat(
        dependencies.on$?.pipe(switchMap(() => ready$)),
        dependencies.on$.pipe(skipUntil(ready$)),
      );
    }

    // generation proper
    const generate$ = (readyOn$ ?? settings$).pipe(
      withLatestFrom(request$, settings$),
      concatMap(([, request, settings]) => engine.generate(request, settings)),
      takeUntil(complete$),
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
  ): Observable<CredentialGeneratorInfo[]>;
  algorithms$(
    category: CredentialCategory[],
    dependencies?: Algorithms$Dependencies,
  ): Observable<CredentialGeneratorInfo[]>;
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
        const filtered = algorithms.filter((c) => available.has(c.id));
        return filtered;
      }),
    );

    return algorithms$;
  }

  /** Lists metadata for the algorithms in a credential category
   *  @param category the category or categories of interest
   *  @returns A list containing the requested metadata.
   */
  algorithms(category: CredentialCategory): CredentialGeneratorInfo[];
  algorithms(category: CredentialCategory[]): CredentialGeneratorInfo[];
  algorithms(category: CredentialCategory | CredentialCategory[]): CredentialGeneratorInfo[] {
    const categories = Array.isArray(category) ? category : [category];
    const algorithms = categories
      .flatMap((c) => CredentialCategories[c])
      .map((c) => (c === "forwarder" ? null : Generators[c]))
      .filter((info) => info !== null);

    return algorithms;
  }

  /** Look up the metadata for a specific generator algorithm
   *  @param id identifies the algorithm
   *  @returns the requested metadata, or `null` if the metadata wasn't found.
   */
  algorithm(id: CredentialAlgorithm): CredentialGeneratorInfo {
    return (id === "forwarder" ? null : Generators[id]) ?? null;
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
    const completion$ = userId$.pipe(ignoreElements(), endWith(true));

    const state$ = userId$.pipe(
      filter((userId) => !!userId),
      distinctUntilChanged(),
      switchMap((userId) => {
        const state$ = this.stateProvider
          .getUserState$(configuration.settings.account, userId)
          .pipe(takeUntil(completion$));

        return state$;
      }),
      map((settings) => settings ?? structuredClone(configuration.settings.initial)),
    );

    const settings$ = combineLatest([state$, this.policy$(configuration, { userId$ })]).pipe(
      map(([settings, policy]) => {
        const calibration = isDynamic(policy) ? policy.calibrate(settings) : policy;
        const adjusted = calibration.adjust(settings);
        return adjusted;
      }),
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
    const userId = await firstValueFrom(
      dependencies.singleUserId$.pipe(filter((userId) => !!userId)),
    );

    // FIXME: enforce policy
    const state = this.stateProvider.getUser(userId, PREFERENCES);
    const subject = new UserStateSubject(state, { ...dependencies });

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
    const userId = await firstValueFrom(
      dependencies.singleUserId$.pipe(filter((userId) => !!userId)),
    );
    const state = this.stateProvider.getUser(userId, configuration.settings.account);
    const constraints$ = this.policy$(configuration, { userId$: dependencies.singleUserId$ });

    const subject = new UserStateSubject(state, { ...dependencies, constraints$ });

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
    const completion$ = dependencies.userId$.pipe(ignoreElements(), endWith(true));

    const constraints$ = dependencies.userId$.pipe(
      switchMap((userId) => {
        // complete policy emissions otherwise `mergeMap` holds `policies$` open indefinitely
        const policies$ = this.policyService
          .getAll$(configuration.policy.type, userId)
          .pipe(takeUntil(completion$));
        return policies$;
      }),
      mapPolicyToConstraints(configuration.policy),
    );

    return constraints$;
  }
}
