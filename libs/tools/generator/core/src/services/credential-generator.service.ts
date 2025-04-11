import {
  concatMap,
  distinctUntilChanged,
  filter,
  map,
  of,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BoundDependency, OnDependency } from "@bitwarden/common/tools/dependencies";
import { VendorId } from "@bitwarden/common/tools/extension";
import { SemanticLogger } from "@bitwarden/common/tools/log";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";
import { anyComplete, withLatestReady } from "@bitwarden/common/tools/rx";
import { UserStateSubject } from "@bitwarden/common/tools/state/user-state-subject";

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

export class DefaultCredentialGeneratorService implements CredentialGeneratorService {
  /** Instantiate the `DefaultCredentialGeneratorService`.
   *  @param provide application services required by the credential generator.
   *  @param system low-level services required by the credential generator.
   */
  constructor(
    private readonly provide: CredentialGeneratorProviders,
    private readonly system: SystemServiceProvider,
  ) {
    this.log = system.log({ type: "CredentialGeneratorService" });
  }

  private readonly log: SemanticLogger;

  generate$(dependencies: OnDependency<GenerateRequest> & BoundDependency<"account", Account>) {
    // `on$` is partitioned into several streams so that the generator
    // engine and settings refresh only when their respective inputs change
    const on$ = dependencies.on$.pipe(shareReplay({ refCount: true, bufferSize: 1 }));
    const account$ = dependencies.account$.pipe(shareReplay({ refCount: true, bufferSize: 1 }));

    // load algorithm metadata
    const algorithm$ = on$.pipe(
      switchMap((requested) => {
        if (isAlgorithmRequest(requested)) {
          return of(requested.algorithm);
        } else if (isTypeRequest(requested)) {
          return this.provide.metadata.preference$(requested.type, { account$ });
        } else {
          this.log.panic(requested, "algorithm or category required");
        }
      }),
      filter((algorithm): algorithm is CredentialAlgorithm => !!algorithm),
      map((algorithm) => this.provide.metadata.metadata(algorithm)),
      distinctUntilChanged((previous, current) => previous.id === current.id),
    );

    // load the active profile's algorithm settings
    const settings$ = on$.pipe(
      map((request) => request.profile ?? Profile.account),
      distinctUntilChanged(),
      withLatestReady(algorithm$),
      switchMap(([profile, meta]) => this.settings(meta, { account$ }, profile)),
    );

    // load the algorithm's engine
    const engine$ = algorithm$.pipe(
      tap((meta) => this.log.info({ algorithm: meta.id }, "engine selected")),
      map((meta) => meta.engine.create(this.provide.generator)),
    );

    // generation proper
    const generate$ = on$.pipe(
      withLatestReady(engine$),
      withLatestReady(settings$),
      concatMap(([[request, engine], settings]) => engine.generate(request, settings)),
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
      settings = this.system.extension.settings(activeProfile, vendor, dependencies);
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
