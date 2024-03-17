import { AutofillSettingsService } from "@bitwarden/common/autofill/services/autofill-settings.service";

import {
  policyServiceFactory,
  PolicyServiceInitOptions,
} from "../../../admin-console/background/service-factories/policy-service.factory";
import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../../platform/background/service-factories/factory-options";
import {
  stateProviderFactory,
  StateProviderInitOptions,
} from "../../../platform/background/service-factories/state-provider.factory";

export type AutofillSettingsServiceInitOptions = FactoryOptions &
  StateProviderInitOptions &
  PolicyServiceInitOptions;

export function autofillSettingsServiceFactory(
  cache: { autofillSettingsService?: AutofillSettingsService } & CachedServices,
  opts: AutofillSettingsServiceInitOptions,
): Promise<AutofillSettingsService> {
  return factory(
    cache,
    "autofillSettingsService",
    opts,
    async () =>
      new AutofillSettingsService(
        await stateProviderFactory(cache, opts),
        await policyServiceFactory(cache, opts),
      ),
  );
}
