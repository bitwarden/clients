import {
  ReplaySubject,
  concatMap,
  filter,
  first,
  map,
  of,
  share,
  shareReplay,
  switchAll,
  switchMap,
  takeUntil,
  tap,
  timer,
  zip,
} from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BoundDependency, OnDependency } from "@bitwarden/common/tools/dependencies";
import { VendorId } from "@bitwarden/common/tools/extension";
import { ExtensionService } from "@bitwarden/common/tools/extension/extension.service";
import { anyComplete, memoizedMap } from "@bitwarden/common/tools/rx";
import { UserStateSubject } from "@bitwarden/common/tools/state/user-state-subject";
import { LogProvider, SemanticLogger } from "@bitwarden/logging";

import { CredentialGeneratorService } from "../abstractions";
import {
  CredentialAlgorithm,
  Profile,
  GeneratorMetadata,
  GeneratorProfile,
  isForwarderProfile,
  toVendorId,
  CredentialType,
} from "../metadata";
import { CredentialGeneratorProviders } from "../providers";
import { GenerateRequest } from "../types";
import { isAlgorithmRequest, isTypeRequest } from "../types/metadata-request";

const ALGORITHM_CACHE_SIZE = 10;
const THREE_MINUTES = 3 * 60 * 1000;

export class DefaultCredentialGeneratorService implements CredentialGeneratorService {
  /** Instantiate the `DefaultCredentialGeneratorService`.
   *  @param provide application services required by the credential generator.
   *  @param extension service for managing forwarder extensions.
   *  @param log factory for creating semantic loggers.
   */
  constructor(
    private readonly provide: CredentialGeneratorProviders,
    private readonly extension: ExtensionService,
    log: LogProvider,
  ) {
    this.log = log({ type: "DefaultCredentialGeneratorService" });
  }

  private readonly log: SemanticLogger;

  generate$(dependencies: OnDependency<GenerateRequest> & BoundDependency<"account", Account>) {
    const request$ = dependencies.on$.pipe(shareReplay({ refCount: true, bufferSize: 1 }));
    const account$ = dependencies.account$.pipe(shareReplay({ refCount: true, bufferSize: 1 }));

    // load algorithm metadata
    const metadata$ = request$.pipe(
      switchMap((request) => {
        if (isAlgorithmRequest(request)) {
          return of(request.algorithm);
        } else if (isTypeRequest(request)) {
          return this.provide.metadata.preference$(request.type, { account$ }).pipe(first());
        } else {
          this.log.panic(request, "algorithm or category required");
        }
      }),
      filter((algorithm): algorithm is CredentialAlgorithm => !!algorithm),
      memoizedMap((algorithm) => this.provide.metadata.metadata(algorithm), {
        size: ALGORITHM_CACHE_SIZE,
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    // load the active profile's settings
    const settings$ = zip(request$, metadata$).pipe(
      map(
        ([request, metadata]) =>
          [{ ...request, profile: request.profile ?? Profile.account }, metadata] as const,
      ),
      memoizedMap(
        ([request, metadata]) => {
          const [profile, algorithm] = [request.profile, metadata.id];

          // settings$ stays hot and buffers the most recent value in the cache
          // for the next `request`
          const settings$ = this.settings(metadata, { account$ }, profile).pipe(
            tap(() => this.log.debug({ algorithm, profile }, "settings update received")),
            share({
              connector: () => new ReplaySubject<object>(1, THREE_MINUTES),
              resetOnRefCountZero: () => timer(THREE_MINUTES),
            }),
            tap({
              subscribe: () => this.log.debug({ algorithm, profile }, "settings hot"),
              complete: () => this.log.debug({ algorithm, profile }, "settings cold"),
            }),
            first(),
          );

          this.log.debug({ algorithm, profile }, "settings cached");
          return settings$;
        },
        { key: ([request, metadata]) => `${metadata.id}:${request.profile}` },
      ),
      switchAll(),
    );

    // load the algorithm's engine
    const engine$ = metadata$.pipe(
      memoizedMap(
        (metadata) => {
          const engine = metadata.engine.create(this.provide.generator);

          this.log.debug({ algorithm: metadata.id }, "engine cached");
          return engine;
        },
        { size: ALGORITHM_CACHE_SIZE },
      ),
    );

    // generation proper
    const generate$ = zip([request$, settings$, engine$]).pipe(
      tap(([request]) => this.log.debug(request, "generating credential")),
      concatMap(([request, settings, engine]) => engine.generate(request, settings)),
      takeUntil(anyComplete([settings$])),
    );

    return generate$;
  }

  algorithms$(type: CredentialType, dependencies: BoundDependency<"account", Account>) {
    return this.provide.metadata
      .algorithms$({ type }, dependencies)
      .pipe(map((algorithms) => algorithms.map((a) => this.algorithm(a))));
  }

  algorithms(type: CredentialType | CredentialType[]) {
    const types: CredentialType[] = Array.isArray(type) ? type : [type];
    const algorithms = types
      .flatMap((type) => this.provide.metadata.algorithms({ type }))
      .map((algorithm) => this.algorithm(algorithm));
    return algorithms;
  }

  algorithm(id: CredentialAlgorithm) {
    const metadata = this.provide.metadata.metadata(id);
    if (!metadata) {
      this.log.panic({ algorithm: id }, "invalid credential algorithm");
    }

    return metadata;
  }

  forwarder(id: VendorId) {
    const metadata = this.provide.metadata.metadata({ forwarder: id });
    if (!metadata) {
      this.log.panic({ algorithm: id }, "invalid vendor");
    }

    return metadata;
  }

  preferences(dependencies: BoundDependency<"account", Account>) {
    return this.provide.metadata.preferences(dependencies);
  }

  settings<Settings extends object>(
    metadata: Readonly<GeneratorMetadata<Settings>>,
    dependencies: BoundDependency<"account", Account>,
    profile: GeneratorProfile = Profile.account,
  ) {
    const activeProfile = metadata.profiles[profile];
    if (!activeProfile) {
      this.log.panic(
        { algorithm: metadata.id, profile },
        "failed to load settings; profile metadata not found",
      );
    }

    let settings: UserStateSubject<Settings>;
    if (isForwarderProfile(activeProfile)) {
      const vendor = toVendorId(metadata.id);
      if (!vendor) {
        this.log.panic(
          { algorithm: metadata.id, profile },
          "failed to load extension profile; vendor not specified",
        );
      }

      this.log.info({ profile, vendor, site: activeProfile.site }, "loading extension profile");
      settings = this.extension.settings(activeProfile, vendor, dependencies);
    } else {
      this.log.info({ profile, algorithm: metadata.id }, "loading generator profile");
      settings = this.provide.profile.settings(activeProfile, dependencies);
    }

    return settings;
  }

  policy$<Settings>(
    metadata: Readonly<GeneratorMetadata<Settings>>,
    dependencies: BoundDependency<"account", Account>,
    profile: GeneratorProfile = Profile.account,
  ) {
    const activeProfile = metadata.profiles[profile];
    if (!activeProfile) {
      this.log.panic(
        { algorithm: metadata.id, profile },
        "failed to load policy; profile metadata not found",
      );
    }

    return this.provide.profile.constraints$(activeProfile, dependencies);
  }
}
