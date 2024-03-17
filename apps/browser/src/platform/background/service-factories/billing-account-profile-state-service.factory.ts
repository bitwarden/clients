import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { DefaultBillingAccountProfileStateService } from "@bitwarden/common/billing/services/account/billing-account-profile-state.service";

import { activeUserStateProviderFactory } from "./active-user-state-provider.factory";
import { FactoryOptions, CachedServices, factory } from "./factory-options";
import { StateProviderInitOptions } from "./state-provider.factory";

type BillingAccountProfileStateServiceFactoryOptions = FactoryOptions;

export type BillingAccountProfileStateServiceInitOptions =
  BillingAccountProfileStateServiceFactoryOptions & StateProviderInitOptions;

export function billingAccountProfileStateServiceFactory(
  cache: {
    billingAccountProfileStateService?: BillingAccountProfileStateService;
  } & CachedServices,
  opts: BillingAccountProfileStateServiceInitOptions,
): Promise<BillingAccountProfileStateService> {
  return factory(
    cache,
    "billingAccountProfileStateService",
    opts,
    async () =>
      new DefaultBillingAccountProfileStateService(
        await activeUserStateProviderFactory(cache, opts),
      ),
  );
}
