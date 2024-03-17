import { PolicyService as AbstractPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/services/policy/policy.service";

import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../../platform/background/service-factories/factory-options";
import {
  stateProviderFactory,
  StateProviderInitOptions,
} from "../../../platform/background/service-factories/state-provider.factory";

import {
  organizationServiceFactory,
  OrganizationServiceInitOptions,
} from "./organization-service.factory";

type PolicyServiceFactoryOptions = FactoryOptions;

export type PolicyServiceInitOptions = PolicyServiceFactoryOptions &
  StateProviderInitOptions &
  OrganizationServiceInitOptions;

export function policyServiceFactory(
  cache: { policyService?: AbstractPolicyService } & CachedServices,
  opts: PolicyServiceInitOptions,
): Promise<AbstractPolicyService> {
  return factory(
    cache,
    "policyService",
    opts,
    async () =>
      new PolicyService(
        await stateProviderFactory(cache, opts),
        await organizationServiceFactory(cache, opts),
      ),
  );
}
