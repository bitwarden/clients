import { BehaviorSubject, from, Observable, shareReplay, switchMap } from "rxjs";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { OrganizationId } from "../../../types/guid";
import { OrganizationMetadataServiceAbstraction } from "../../abstractions/organization-metadata.service.abstraction";
import { OrganizationBillingMetadataResponse } from "../../models/response/organization-billing-metadata.response";

export class DefaultOrganizationMetadataService implements OrganizationMetadataServiceAbstraction {
  private metadataCache = new Map<
    OrganizationId,
    Observable<OrganizationBillingMetadataResponse>
  >();

  constructor(
    private billingApiService: BillingApiServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
  ) {}
  private refreshMetadataTrigger = new BehaviorSubject<void>(undefined);

  refreshMetadataCache = () => {
    this.metadataCache.clear();
    this.refreshMetadataTrigger.next();
  };

  getOrganizationMetadata$(orgId: OrganizationId): Observable<OrganizationBillingMetadataResponse> {
    return this.refreshMetadataTrigger.pipe(
      switchMap(() => {
        const cacheHit = this.metadataCache.get(orgId);
        if (cacheHit) {
          return cacheHit;
        }
        const result = from(this.fetchMetadata(orgId)).pipe(
          shareReplay({ bufferSize: 1, refCount: false }),
        );
        this.metadataCache.set(orgId, result);
        return result;
      }),
    );
  }

  private async fetchMetadata(
    organizationId: OrganizationId,
  ): Promise<OrganizationBillingMetadataResponse> {
    return this.platformUtilsService.isSelfHost()
      ? await this.billingApiService.getOrganizationBillingMetadataSelfHost(organizationId)
      : await this.billingApiService.getOrganizationBillingMetadata(organizationId);
  }
}
