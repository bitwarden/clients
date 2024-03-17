import { KeyGenerationService as KeyGenerationServiceAbstraction } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { KeyGenerationService } from "@bitwarden/common/platform/services/key-generation.service";

import {
  cryptoFunctionServiceFactory,
  CryptoFunctionServiceInitOptions,
} from "./crypto-function-service.factory";
import { FactoryOptions, CachedServices, factory } from "./factory-options";

type KeyGenerationServiceFactoryOptions = FactoryOptions;

export type KeyGenerationServiceInitOptions = KeyGenerationServiceFactoryOptions &
  CryptoFunctionServiceInitOptions;

export function keyGenerationServiceFactory(
  cache: { keyGenerationService?: KeyGenerationServiceAbstraction } & CachedServices,
  opts: KeyGenerationServiceInitOptions,
): Promise<KeyGenerationServiceAbstraction> {
  return factory(
    cache,
    "keyGenerationService",
    opts,
    async () => new KeyGenerationService(await cryptoFunctionServiceFactory(cache, opts)),
  );
}
