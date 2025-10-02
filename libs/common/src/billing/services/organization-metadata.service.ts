// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { from, Observable, shareReplay } from "rxjs";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { OrganizationId } from "../../types/guid";
import { OrganizationMetadataServiceAbstraction } from "../abstractions/organization-metadata.service.abstraction";
import { OrganizationBillingMetadataResponse } from "../models/response/organization-billing-metadata.response";

export class DefaultOrganizationMetadataService implements OrganizationMetadataServiceAbstraction {
  private metadataCache = new Map<
    OrganizationId,
    Observable<OrganizationBillingMetadataResponse>
  >();

  constructor(
    private billingApiService: BillingApiServiceAbstraction,
    private configService: ConfigService,
  ) {}

  getOrganizationMetadata$(
    organizationId: OrganizationId,
  ): Observable<OrganizationBillingMetadataResponse> {
    if (this.metadataCache.has(organizationId)) {
      return this.metadataCache.get(organizationId)!;
    }

    const metadata$ = from(this.fetchMetadata(organizationId)).pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.metadataCache.set(organizationId, metadata$);

    return metadata$;
  }

  private async fetchMetadata(
    organizationId: OrganizationId,
  ): Promise<OrganizationBillingMetadataResponse> {
    const useVNext = await this.configService.getFeatureFlag(
      FeatureFlag.PM25379_UseNewOrganizationMetadataStructure,
    );

    if (useVNext) {
      return await this.billingApiService.getOrganizationBillingMetadataVNext(organizationId);
    }

    return await this.billingApiService.getOrganizationBillingMetadata(organizationId);
  }
}
