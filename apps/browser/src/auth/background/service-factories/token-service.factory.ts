import { TokenService as AbstractTokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TokenService } from "@bitwarden/common/auth/services/token.service";

import {
  EncryptServiceInitOptions,
  encryptServiceFactory,
} from "../../../platform/background/service-factories/encrypt-service.factory";
import {
  FactoryOptions,
  CachedServices,
  factory,
} from "../../../platform/background/service-factories/factory-options";
import {
  GlobalStateProviderInitOptions,
  globalStateProviderFactory,
} from "../../../platform/background/service-factories/global-state-provider.factory";
import {
  KeyGenerationServiceInitOptions,
  keyGenerationServiceFactory,
} from "../../../platform/background/service-factories/key-generation-service.factory";
import {
  LogServiceInitOptions,
  logServiceFactory,
} from "../../../platform/background/service-factories/log-service.factory";
import {
  PlatformUtilsServiceInitOptions,
  platformUtilsServiceFactory,
} from "../../../platform/background/service-factories/platform-utils-service.factory";
import {
  SingleUserStateProviderInitOptions,
  singleUserStateProviderFactory,
} from "../../../platform/background/service-factories/single-user-state-provider.factory";
import {
  SecureStorageServiceInitOptions,
  secureStorageServiceFactory,
} from "../../../platform/background/service-factories/storage-service.factory";

type TokenServiceFactoryOptions = FactoryOptions;

export type TokenServiceInitOptions = TokenServiceFactoryOptions &
  SingleUserStateProviderInitOptions &
  GlobalStateProviderInitOptions &
  PlatformUtilsServiceInitOptions &
  SecureStorageServiceInitOptions &
  KeyGenerationServiceInitOptions &
  EncryptServiceInitOptions &
  LogServiceInitOptions;

export function tokenServiceFactory(
  cache: { tokenService?: AbstractTokenService } & CachedServices,
  opts: TokenServiceInitOptions,
): Promise<AbstractTokenService> {
  return factory(
    cache,
    "tokenService",
    opts,
    async () =>
      new TokenService(
        await singleUserStateProviderFactory(cache, opts),
        await globalStateProviderFactory(cache, opts),
        (await platformUtilsServiceFactory(cache, opts)).supportsSecureStorage(),
        await secureStorageServiceFactory(cache, opts),
        await keyGenerationServiceFactory(cache, opts),
        await encryptServiceFactory(cache, opts),
        await logServiceFactory(cache, opts),
      ),
  );
}
