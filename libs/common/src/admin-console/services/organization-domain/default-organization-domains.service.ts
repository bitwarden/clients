import { concatMap, firstValueFrom } from "rxjs";

import { OrganizationId as SdkOrganizationId } from "@bitwarden/sdk-internal";

import { asUuid, SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { OrganizationId, UserId } from "../../../types/guid";
import { OrganizationDomainsService } from "../../abstractions/organization-domain/organization-domains.service";

export class DefaultOrganizationDomainsService implements OrganizationDomainsService {
  constructor(private readonly sdkService: SdkService) {}

  async verifiedDomains(userId: UserId, organizationId: OrganizationId): Promise<string[]> {
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value
            .organization_domains()
            .get_verified_domains(asUuid<SdkOrganizationId>(organizationId));
        }),
      ),
    );
  }
}
