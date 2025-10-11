import { filter, from, merge, Observable, shareReplay, Subject, switchMap } from "rxjs";

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
  private refreshMetadataTrigger = new Subject<void>();

  refreshMetadataCache = () => this.refreshMetadataTrigger.next();

  getOrganizationMetadata$ = (
    organizationId: OrganizationId,
  ): Observable<OrganizationBillingMetadataResponse> =>
    this.configService
      .getFeatureFlag$(FeatureFlag.PM25379_UseNewOrganizationMetadataStructure)
      .pipe(
        switchMap((featureFlagEnabled) => {
          return merge(
            this.getOrganizationMetadataInternal$(organizationId, featureFlagEnabled),
            this.refreshMetadataTrigger.pipe(
              filter(() => featureFlagEnabled),
              switchMap(() =>
                this.getOrganizationMetadataInternal$(organizationId, featureFlagEnabled, true),
              ),
            ),
          );
        }),
      );

  private getOrganizationMetadataInternal$(
    organizationId: OrganizationId,
    featureFlagEnabled: boolean,
    bypassCache: boolean = false,
  ): Observable<OrganizationBillingMetadataResponse> {
    if (!bypassCache && featureFlagEnabled && this.metadataCache.has(organizationId)) {
      return this.metadataCache.get(organizationId)!;
    }

    const metadata$ = from(this.fetchMetadata(organizationId, featureFlagEnabled)).pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    if (featureFlagEnabled) {
      this.metadataCache.set(organizationId, metadata$);
    }

    return metadata$;
  }

  private async fetchMetadata(
    organizationId: OrganizationId,
    featureFlagEnabled: boolean,
  ): Promise<OrganizationBillingMetadataResponse> {
    if (featureFlagEnabled) {
      return await this.billingApiService.getOrganizationBillingMetadataVNext(organizationId);
    }

    return await this.billingApiService.getOrganizationBillingMetadata(organizationId);
  }
}
