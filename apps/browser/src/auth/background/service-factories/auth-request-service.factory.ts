import { AuthRequestService, AuthRequestServiceAbstraction } from "@bitwarden/auth/common";

import {
  apiServiceFactory,
  ApiServiceInitOptions,
} from "../../../platform/background/service-factories/api-service.factory";
import {
  appIdServiceFactory,
  AppIdServiceInitOptions,
} from "../../../platform/background/service-factories/app-id-service.factory";
import {
  CryptoServiceInitOptions,
  cryptoServiceFactory,
} from "../../../platform/background/service-factories/crypto-service.factory";
import {
  CachedServices,
  FactoryOptions,
  factory,
} from "../../../platform/background/service-factories/factory-options";
import {
  stateServiceFactory,
  StateServiceInitOptions,
} from "../../../platform/background/service-factories/state-service.factory";

type AuthRequestServiceFactoryOptions = FactoryOptions;

export type AuthRequestServiceInitOptions = AuthRequestServiceFactoryOptions &
  AppIdServiceInitOptions &
  CryptoServiceInitOptions &
  ApiServiceInitOptions &
  StateServiceInitOptions;

export function authRequestServiceFactory(
  cache: { authRequestService?: AuthRequestServiceAbstraction } & CachedServices,
  opts: AuthRequestServiceInitOptions,
): Promise<AuthRequestServiceAbstraction> {
  return factory(
    cache,
    "authRequestService",
    opts,
    async () =>
      new AuthRequestService(
        await appIdServiceFactory(cache, opts),
        await cryptoServiceFactory(cache, opts),
        await apiServiceFactory(cache, opts),
        await stateServiceFactory(cache, opts),
      ),
  );
}
