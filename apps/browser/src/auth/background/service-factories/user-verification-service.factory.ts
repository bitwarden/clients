import { UserVerificationService as AbstractUserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/services/user-verification/user-verification.service";

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
  I18nServiceInitOptions,
  i18nServiceFactory,
} from "../../../platform/background/service-factories/i18n-service.factory";
import {
  StateServiceInitOptions,
  stateServiceFactory,
} from "../../../platform/background/service-factories/state-service.factory";

import {
  UserVerificationApiServiceInitOptions,
  userVerificationApiServiceFactory,
} from "./user-verification-api-service.factory";

type UserVerificationServiceFactoryOptions = FactoryOptions;

export type UserVerificationServiceInitOptions = UserVerificationServiceFactoryOptions &
  StateServiceInitOptions &
  CryptoServiceInitOptions &
  I18nServiceInitOptions &
  UserVerificationApiServiceInitOptions;

export function userVerificationServiceFactory(
  cache: { userVerificationService?: AbstractUserVerificationService } & CachedServices,
  opts: UserVerificationServiceInitOptions
): Promise<AbstractUserVerificationService> {
  return factory(
    cache,
    "userVerificationService",
    opts,
    async () =>
      new UserVerificationService(
        await stateServiceFactory(cache, opts),
        await cryptoServiceFactory(cache, opts),
        await i18nServiceFactory(cache, opts),
        await userVerificationApiServiceFactory(cache, opts)
      )
  );
}
