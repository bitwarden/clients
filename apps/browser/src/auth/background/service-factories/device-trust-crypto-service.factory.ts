import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { DeviceTrustCryptoService } from "@bitwarden/common/auth/services/device-trust-crypto.service.implementation";

import {
  DevicesApiServiceInitOptions,
  devicesApiServiceFactory,
} from "../../../background/service-factories/devices-api-service.factory";
import {
  AppIdServiceInitOptions,
  appIdServiceFactory,
} from "../../../platform/background/service-factories/app-id-service.factory";
import {
  CryptoFunctionServiceInitOptions,
  cryptoFunctionServiceFactory,
} from "../../../platform/background/service-factories/crypto-function-service.factory";
import {
  CryptoServiceInitOptions,
  cryptoServiceFactory,
} from "../../../platform/background/service-factories/crypto-service.factory";
import {
  EncryptServiceInitOptions,
  encryptServiceFactory,
} from "../../../platform/background/service-factories/encrypt-service.factory";
import {
  CachedServices,
  FactoryOptions,
  factory,
} from "../../../platform/background/service-factories/factory-options";
import {
  I18nServiceInitOptions,
  i18nServiceFactory,
} from "../../../platform/background/service-factories/i18n-service.factory";
import {
  PlatformUtilsServiceInitOptions,
  platformUtilsServiceFactory,
} from "../../../platform/background/service-factories/platform-utils-service.factory";
import {
  StateServiceInitOptions,
  stateServiceFactory,
} from "../../../platform/background/service-factories/state-service.factory";

type DeviceTrustCryptoServiceFactoryOptions = FactoryOptions;

export type DeviceTrustCryptoServiceInitOptions = DeviceTrustCryptoServiceFactoryOptions &
  CryptoFunctionServiceInitOptions &
  CryptoServiceInitOptions &
  EncryptServiceInitOptions &
  StateServiceInitOptions &
  AppIdServiceInitOptions &
  DevicesApiServiceInitOptions &
  I18nServiceInitOptions &
  PlatformUtilsServiceInitOptions;

export function deviceTrustCryptoServiceFactory(
  cache: { deviceTrustCryptoService?: DeviceTrustCryptoServiceAbstraction } & CachedServices,
  opts: DeviceTrustCryptoServiceInitOptions
): Promise<DeviceTrustCryptoServiceAbstraction> {
  return factory(
    cache,
    "deviceTrustCryptoService",
    opts,
    async () =>
      new DeviceTrustCryptoService(
        await cryptoFunctionServiceFactory(cache, opts),
        await cryptoServiceFactory(cache, opts),
        await encryptServiceFactory(cache, opts),
        await stateServiceFactory(cache, opts),
        await appIdServiceFactory(cache, opts),
        await devicesApiServiceFactory(cache, opts),
        await i18nServiceFactory(cache, opts),
        await platformUtilsServiceFactory(cache, opts)
      )
  );
}
