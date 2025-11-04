import { BehaviorSubject, combineLatest, from, Observable, shareReplay, switchMap } from "rxjs";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";

import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
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
    private configService: ConfigService,
  ) {}
  private refreshMetadataTrigger = new BehaviorSubject<void>(undefined);

  refreshMetadataCache = () => {
    this.metadataCache.clear();
    this.refreshMetadataTrigger.next();
  };

  getOrganizationMetadata$(orgId: OrganizationId): Observable<OrganizationBillingMetadataResponse> {
    return combineLatest([
      this.refreshMetadataTrigger,
      this.configService.getFeatureFlag$(FeatureFlag.PM25379_UseNewOrganizationMetadataStructure),
    ]).pipe(
      switchMap(([_, featureFlagEnabled]) =>
        featureFlagEnabled
          ? this.vNextGetOrganizationMetadataInternal$(orgId)
          : this.getOrganizationMetadataInternal$(orgId),
      ),
    );
  }

  private vNextGetOrganizationMetadataInternal$(
    orgId: OrganizationId,
  ): Observable<OrganizationBillingMetadataResponse> {
    const cacheHit = this.metadataCache.get(orgId);
    if (cacheHit) {
      return cacheHit;
    }

    const result = from(this.fetchMetadata(orgId, true)).pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.metadataCache.set(orgId, result);
    return result;
  }

  private getOrganizationMetadataInternal$(
    organizationId: OrganizationId,
  ): Observable<OrganizationBillingMetadataResponse> {
    return from(this.fetchMetadata(organizationId, false)).pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  private async fetchMetadata(
    organizationId: OrganizationId,
    featureFlagEnabled: boolean,
  ): Promise<OrganizationBillingMetadataResponse> {
    return featureFlagEnabled
      ? await this.billingApiService.getOrganizationBillingMetadataVNext(organizationId)
      : await this.billingApiService.getOrganizationBillingMetadata(organizationId);
  }
}
