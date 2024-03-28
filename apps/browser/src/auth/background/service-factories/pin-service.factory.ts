import { PinServiceAbstraction, PinService } from "@bitwarden/auth/common";

import {
  VaultTimeoutSettingsServiceInitOptions,
  vaultTimeoutSettingsServiceFactory,
} from "../../../background/service-factories/vault-timeout-settings-service.factory";
import {
  CryptoServiceInitOptions,
  cryptoServiceFactory,
} from "../../../platform/background/service-factories/crypto-service.factory";
import {
  FactoryOptions,
  CachedServices,
  factory,
} from "../../../platform/background/service-factories/factory-options";
import {
  LogServiceInitOptions,
  logServiceFactory,
} from "../../../platform/background/service-factories/log-service.factory";
import {
  StateServiceInitOptions,
  stateServiceFactory,
} from "../../../platform/background/service-factories/state-service.factory";

type PinServiceFactoryOptions = FactoryOptions;

export type PinServiceInitOptions = PinServiceFactoryOptions &
  StateServiceInitOptions &
  CryptoServiceInitOptions &
  VaultTimeoutSettingsServiceInitOptions &
  LogServiceInitOptions;

export function pinServiceFactory(
  cache: { pinService?: PinServiceAbstraction } & CachedServices,
  opts: PinServiceInitOptions,
): Promise<PinServiceAbstraction> {
  return factory(
    cache,
    "pinService",
    opts,
    async () =>
      new PinService(
        await stateServiceFactory(cache, opts),
        await cryptoServiceFactory(cache, opts),
        await vaultTimeoutSettingsServiceFactory(cache, opts),
        await logServiceFactory(cache, opts),
      ),
  );
}
