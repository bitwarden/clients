// contains logic that constructs generator services dynamically given
// a generator id.

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { LegacyEncryptorProvider } from "@bitwarden/common/tools/cryptography/legacy-encryptor-provider";
import { RestClient } from "@bitwarden/common/tools/integration/rpc";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";
import { UserStateSubjectDependencyProvider } from "@bitwarden/common/tools/state/user-state-subject-dependency-provider";

import { CredentialGeneratorService, Randomizer } from "./abstractions";
import { PureCryptoRandomizer } from "./engine/purecrypto-randomizer";
import { BuiltIn } from "./metadata";
import {
  CredentialGeneratorProviders,
  GeneratorDependencyProvider,
  GeneratorMetadataProvider,
  GeneratorProfileProvider,
} from "./providers";
import { DefaultCredentialGeneratorService } from "./services";

export function createRandomizer(): Randomizer {
  return new PureCryptoRandomizer();
}

/** Instantiates a `CredentialGeneratorService` without Angular DI.
 *  @param system cross-cutting services required by the generator
 *  @param random randomness source
 *  @param encryptor encryption provider
 *  @param state state provider
 *  @param i18n internationalization service
 *  @param api API client
 */
export async function createCredentialGeneratorService(
  system: SystemServiceProvider,
  random: Randomizer,
  encryptor: LegacyEncryptorProvider,
  state: StateProvider,
  i18n: I18nService,
  api: ApiService,
): Promise<CredentialGeneratorService> {
  const userState: UserStateSubjectDependencyProvider = {
    encryptor,
    state,
    log: system.log,
    now: Date.now,
  };

  const log = system.log({ type: "createCredentialGeneratorService" });

  const featureFlag = await system.configService.getFeatureFlag(
    FeatureFlag.UseSdkPasswordGenerators,
  );
  const sdkService = featureFlag ? system.sdk : undefined;

  log.debug(
    { featureFlag, sdkAvailable: sdkService !== undefined },
    "credential generator service initialized",
  );

  const metadata = new GeneratorMetadataProvider(userState, system, Object.values(BuiltIn));
  const profile = new GeneratorProfileProvider(userState, system.policy);
  const generator: GeneratorDependencyProvider = {
    randomizer: random,
    client: new RestClient(api, i18n),
    i18nService: i18n,
    sdk: sdkService,
    now: Date.now,
  };

  const provide: CredentialGeneratorProviders = { userState, generator, profile, metadata };
  return new DefaultCredentialGeneratorService(provide, system);
}
