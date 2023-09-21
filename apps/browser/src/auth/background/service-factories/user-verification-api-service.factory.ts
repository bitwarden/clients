import { UserVerificationApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/user-verification/user-verification-api.service.abstraction";
import { UserVerificationApiService } from "@bitwarden/common/auth/services/user-verification/user-verification-api.service";

import {
  ApiServiceInitOptions,
  apiServiceFactory,
} from "../../../platform/background/service-factories/api-service.factory";
import {
  FactoryOptions,
  CachedServices,
  factory,
} from "../../../platform/background/service-factories/factory-options";

type UserVerificationApiServiceFactoryOptions = FactoryOptions;

export type UserVerificationApiServiceInitOptions = UserVerificationApiServiceFactoryOptions &
  ApiServiceInitOptions;

export function userVerificationApiServiceFactory(
  cache: { userVerificationApiService?: UserVerificationApiServiceAbstraction } & CachedServices,
  opts: UserVerificationApiServiceInitOptions
): Promise<UserVerificationApiServiceAbstraction> {
  return factory(
    cache,
    "userVerificationApiService",
    opts,
    async () => new UserVerificationApiService(await apiServiceFactory(cache, opts))
  );
}
