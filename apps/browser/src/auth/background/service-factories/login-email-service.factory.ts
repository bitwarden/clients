import { LoginEmailServiceAbstraction, LoginEmailService } from "@bitwarden/auth/common";

import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../../platform/background/service-factories/factory-options";
import {
  stateProviderFactory,
  StateProviderInitOptions,
} from "../../../platform/background/service-factories/state-provider.factory";

type LoginEmailServiceFactoryOptions = FactoryOptions;

export type LoginEmailServiceInitOptions = LoginEmailServiceFactoryOptions &
  StateProviderInitOptions;

export function loginEmailServiceFactory(
  cache: { loginEmailService?: LoginEmailServiceAbstraction } & CachedServices,
  opts: LoginEmailServiceInitOptions,
): Promise<LoginEmailServiceAbstraction> {
  return factory(
    cache,
    "loginEmailService",
    opts,
    async () => new LoginEmailService(await stateProviderFactory(cache, opts)),
  );
}
