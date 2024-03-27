import { CryptoService as AbstractCryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";

import {
  AccountServiceInitOptions,
  accountServiceFactory,
} from "../../../auth/background/service-factories/account-service.factory";
import {
  internalMasterPasswordServiceFactory,
  MasterPasswordServiceInitOptions,
} from "../../../auth/background/service-factories/master-password-service.factory";
import {
  StateServiceInitOptions,
  stateServiceFactory,
} from "../../../platform/background/service-factories/state-service.factory";
import {
  LogServiceInitOptions,
  logServiceFactory,
} from "../../background/service-factories/log-service.factory";
import { BrowserCryptoService } from "../../services/browser-crypto.service";

import { biometricStateServiceFactory } from "./biometric-state-service.factory";
import {
  cryptoFunctionServiceFactory,
  CryptoFunctionServiceInitOptions,
} from "./crypto-function-service.factory";
import { encryptServiceFactory, EncryptServiceInitOptions } from "./encrypt-service.factory";
import { FactoryOptions, CachedServices, factory } from "./factory-options";
import {
  KeyGenerationServiceInitOptions,
  keyGenerationServiceFactory,
} from "./key-generation-service.factory";
import {
  PlatformUtilsServiceInitOptions,
  platformUtilsServiceFactory,
} from "./platform-utils-service.factory";
import { StateProviderInitOptions, stateProviderFactory } from "./state-provider.factory";

type CryptoServiceFactoryOptions = FactoryOptions;

export type CryptoServiceInitOptions = CryptoServiceFactoryOptions &
  MasterPasswordServiceInitOptions &
  KeyGenerationServiceInitOptions &
  CryptoFunctionServiceInitOptions &
  EncryptServiceInitOptions &
  PlatformUtilsServiceInitOptions &
  LogServiceInitOptions &
  StateServiceInitOptions &
  AccountServiceInitOptions &
  StateProviderInitOptions;

export function cryptoServiceFactory(
  cache: { cryptoService?: AbstractCryptoService } & CachedServices,
  opts: CryptoServiceInitOptions,
): Promise<AbstractCryptoService> {
  return factory(
    cache,
    "cryptoService",
    opts,
    async () =>
      new BrowserCryptoService(
        await internalMasterPasswordServiceFactory(cache, opts),
        await keyGenerationServiceFactory(cache, opts),
        await cryptoFunctionServiceFactory(cache, opts),
        await encryptServiceFactory(cache, opts),
        await platformUtilsServiceFactory(cache, opts),
        await logServiceFactory(cache, opts),
        await stateServiceFactory(cache, opts),
        await accountServiceFactory(cache, opts),
        await stateProviderFactory(cache, opts),
        await biometricStateServiceFactory(cache, opts),
      ),
  );
}
