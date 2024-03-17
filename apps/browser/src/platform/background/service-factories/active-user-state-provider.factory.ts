import { ActiveUserStateProvider } from "@bitwarden/common/platform/state";
// eslint-disable-next-line import/no-restricted-paths -- We need the implementation to inject, but generally this should not be accessed
import { DefaultActiveUserStateProvider } from "@bitwarden/common/platform/state/implementations/default-active-user-state.provider";

import {
  AccountServiceInitOptions,
  accountServiceFactory,
} from "../../../auth/background/service-factories/account-service.factory";

import { CachedServices, FactoryOptions, factory } from "./factory-options";
import {
  SingleUserStateProviderInitOptions,
  singleUserStateProviderFactory,
} from "./single-user-state-provider.factory";

type ActiveUserStateProviderFactory = FactoryOptions;

export type ActiveUserStateProviderInitOptions = ActiveUserStateProviderFactory &
  AccountServiceInitOptions &
  SingleUserStateProviderInitOptions;

export async function activeUserStateProviderFactory(
  cache: { activeUserStateProvider?: ActiveUserStateProvider } & CachedServices,
  opts: ActiveUserStateProviderInitOptions,
): Promise<ActiveUserStateProvider> {
  return factory(
    cache,
    "activeUserStateProvider",
    opts,
    async () =>
      new DefaultActiveUserStateProvider(
        await accountServiceFactory(cache, opts),
        await singleUserStateProviderFactory(cache, opts),
      ),
  );
}
