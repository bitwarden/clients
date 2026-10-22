import { Observable, switchMap } from "rxjs";

import { OrganizationId as SdkOrganizationId } from "@bitwarden/sdk-internal";

import { asUuid, SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { OrganizationId, UserId } from "../../../types/guid";
import { OrganizationDomainsService } from "../../abstractions/organization-domain/organization-domains.service";

export class DefaultOrganizationDomainsService implements OrganizationDomainsService {
  constructor(private readonly sdkService: SdkService) {}

  verifiedDomains$(userId: UserId, organizationId: OrganizationId): Observable<string[]> {
    return this.sdkService.userClient$(userId).pipe(
      switchMap(async (sdk) => {
        using ref = sdk.take();
        return await ref.value
          .organization_domains()
          .get_verified_domains(asUuid<SdkOrganizationId>(organizationId));
      }),
    );
  }
}
