// contains logic that constructs generator services dynamically given
// a generator id.

import { firstValueFrom, shareReplay } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { LegacyEncryptorProvider } from "@bitwarden/common/tools/cryptography/legacy-encryptor-provider";
import { RestClient } from "@bitwarden/common/tools/integration/rpc";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";
import { UserStateSubjectDependencyProvider } from "@bitwarden/common/tools/state/user-state-subject-dependency-provider";

import { CredentialGeneratorService, Randomizer } from "./abstractions";
import { SdkRandomizer } from "./engine/sdk-randomizer";
import { BuiltIn } from "./metadata";
import {
  CredentialGeneratorProviders,
  GeneratorDependencyProvider,
  GeneratorMetadataProvider,
  GeneratorProfileProvider,
} from "./providers";
import { DefaultCredentialGeneratorService } from "./services";

export function createRandomizer(): Randomizer {
  return new SdkRandomizer();
}

/** Instantiates a `CredentialGeneratorService` without Angular DI.
 *  @param system cross-cutting services required by the generator
 *  @param random randomness source
 *  @param encryptor encryption provider
 *  @param state state provider
 *  @param i18n internationalization service
 *  @param api API client
 *  @param sdkService SDK service exposing the static (user-less) client
 */
export async function createCredentialGeneratorService(
  system: SystemServiceProvider,
  random: Randomizer,
  encryptor: LegacyEncryptorProvider,
  state: StateProvider,
  i18n: I18nService,
  api: ApiService,
  sdkService: SdkService,
): Promise<CredentialGeneratorService> {
  const userState: UserStateSubjectDependencyProvider = {
    encryptor,
    state,
    log: system.log,
    now: Date.now,
  };

  const metadata = new GeneratorMetadataProvider(userState, system, Object.values(BuiltIn));
  const profile = new GeneratorProfileProvider(userState, system.policy);

  // Hold a single warm subscription to `sdkService.client$` so each generator
  // invocation replays the cached client instead of re-running the inner
  // `concatMap` (which would re-pay `createSdkClient` and `loadFeatureFlags`).
  // `refCount: false` keeps the upstream subscription alive even when no
  // downstream subscribers exist between `firstValueFrom` calls. Environment
  // changes still propagate because the inner `client$` is wired to
  // `environmentService.environment$`. Trade-off: an SDK initialization
  // failure becomes sticky — every subsequent `sdk()` call resolves to the
  // cached error. This matches today's observable behavior (a broken SDK
  // already breaks every downstream consumer).
  const sharedClient$ = sdkService.client$.pipe(shareReplay({ refCount: false, bufferSize: 1 }));

  const generator: GeneratorDependencyProvider = {
    randomizer: random,
    client: new RestClient(api, i18n),
    i18nService: i18n,
    sdk: () => firstValueFrom(sharedClient$),
    now: Date.now,
  };

  const provide: CredentialGeneratorProviders = { userState, generator, profile, metadata };
  return new DefaultCredentialGeneratorService(provide, system);
}
