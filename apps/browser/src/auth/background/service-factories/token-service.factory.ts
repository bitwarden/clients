import { TokenService as AbstractTokenService } from "@bitwarden/common/abstractions/token.service";
import { TokenService } from "@bitwarden/common/services/token.service";

import {
  FactoryOptions,
  CachedServices,
  factory,
} from "../../../background/service_factories/factory-options";
import {
  stateServiceFactory,
  StateServiceInitOptions,
} from "../../../background/service_factories/state-service.factory";

type TokenServiceFactoryOptions = FactoryOptions;

export type TokenServiceInitOptions = TokenServiceFactoryOptions & StateServiceInitOptions;

export function tokenServiceFactory(
  cache: { tokenService?: AbstractTokenService } & CachedServices,
  opts: TokenServiceInitOptions
): Promise<AbstractTokenService> {
  return factory(
    cache,
    "tokenService",
    opts,
    async () => new TokenService(await stateServiceFactory(cache, opts))
  );
}
