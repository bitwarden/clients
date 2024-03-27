import { AuthService as AbstractAuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthService } from "@bitwarden/common/auth/services/auth.service";

import {
  ApiServiceInitOptions,
  apiServiceFactory,
} from "../../../platform/background/service-factories/api-service.factory";
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
  MessagingServiceInitOptions,
  messagingServiceFactory,
} from "../../../platform/background/service-factories/messaging-service.factory";
import {
  StateServiceInitOptions,
  stateServiceFactory,
} from "../../../platform/background/service-factories/state-service.factory";

import { AccountServiceInitOptions, accountServiceFactory } from "./account-service.factory";

type AuthServiceFactoryOptions = FactoryOptions;

export type AuthServiceInitOptions = AuthServiceFactoryOptions &
  AccountServiceInitOptions &
  MessagingServiceInitOptions &
  CryptoServiceInitOptions &
  ApiServiceInitOptions &
  StateServiceInitOptions;

export function authServiceFactory(
  cache: { authService?: AbstractAuthService } & CachedServices,
  opts: AuthServiceInitOptions,
): Promise<AbstractAuthService> {
  return factory(
    cache,
    "authService",
    opts,
    async () =>
      new AuthService(
        await accountServiceFactory(cache, opts),
        await messagingServiceFactory(cache, opts),
        await cryptoServiceFactory(cache, opts),
        await apiServiceFactory(cache, opts),
        await stateServiceFactory(cache, opts),
      ),
  );
}
