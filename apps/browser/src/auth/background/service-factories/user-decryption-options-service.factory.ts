import {
  InternalUserDecryptionOptionsServiceAbstraction,
  UserDecryptionOptionsService,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";

import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../../platform/background/service-factories/factory-options";
import {
  stateProviderFactory,
  StateProviderInitOptions,
} from "../../../platform/background/service-factories/state-provider.factory";

type UserDecryptionOptionsServiceFactoryOptions = FactoryOptions;

export type UserDecryptionOptionsServiceInitOptions = UserDecryptionOptionsServiceFactoryOptions &
  StateProviderInitOptions;

export function userDecryptionOptionsServiceFactory(
  cache: {
    userDecryptionOptionsService?: InternalUserDecryptionOptionsServiceAbstraction;
  } & CachedServices,
  opts: UserDecryptionOptionsServiceInitOptions,
): Promise<UserDecryptionOptionsServiceAbstraction> {
  return factory(
    cache,
    "userDecryptionOptionsService",
    opts,
    async () => new UserDecryptionOptionsService(await stateProviderFactory(cache, opts)),
  );
}

export async function internalUserDecryptionOptionServiceFactory(
  cache: {
    userDecryptionOptionsService?: InternalUserDecryptionOptionsServiceAbstraction;
  } & CachedServices,
  opts: UserDecryptionOptionsServiceInitOptions,
): Promise<InternalUserDecryptionOptionsServiceAbstraction> {
  return (await userDecryptionOptionsServiceFactory(
    cache,
    opts,
  )) as InternalUserDecryptionOptionsServiceAbstraction;
}
