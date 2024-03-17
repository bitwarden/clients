import { AvatarService as AvatarServiceAbstraction } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AvatarService } from "@bitwarden/common/auth/services/avatar.service";

import {
  ApiServiceInitOptions,
  apiServiceFactory,
} from "../../../platform/background/service-factories/api-service.factory";
import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../../platform/background/service-factories/factory-options";
import {
  stateProviderFactory,
  StateProviderInitOptions,
} from "../../../platform/background/service-factories/state-provider.factory";

type AvatarServiceFactoryOptions = FactoryOptions;

export type AvatarServiceInitOptions = AvatarServiceFactoryOptions &
  ApiServiceInitOptions &
  StateProviderInitOptions;

export function avatarServiceFactory(
  cache: { avatarService?: AvatarServiceAbstraction } & CachedServices,
  opts: AvatarServiceInitOptions,
): Promise<AvatarServiceAbstraction> {
  return factory(
    cache,
    "avatarService",
    opts,
    async () =>
      new AvatarService(
        await apiServiceFactory(cache, opts),
        await stateProviderFactory(cache, opts),
      ),
  );
}
