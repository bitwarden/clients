import { OrganizationService as AbstractOrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/services/organization/organization.service";

import {
  FactoryOptions,
  CachedServices,
  factory,
} from "../../../platform/background/service-factories/factory-options";
import { stateProviderFactory } from "../../../platform/background/service-factories/state-provider.factory";
import { StateServiceInitOptions } from "../../../platform/background/service-factories/state-service.factory";

type OrganizationServiceFactoryOptions = FactoryOptions;

export type OrganizationServiceInitOptions = OrganizationServiceFactoryOptions &
  StateServiceInitOptions;

export function organizationServiceFactory(
  cache: { organizationService?: AbstractOrganizationService } & CachedServices,
  opts: OrganizationServiceInitOptions,
): Promise<AbstractOrganizationService> {
  return factory(
    cache,
    "organizationService",
    opts,
    async () => new OrganizationService(await stateProviderFactory(cache, opts)),
  );
}
