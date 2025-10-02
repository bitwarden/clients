import { Observable } from "rxjs";

import { OrganizationId } from "../../types/guid";
import { OrganizationBillingMetadataResponse } from "../models/response/organization-billing-metadata.response";

export abstract class OrganizationMetadataServiceAbstraction {
  abstract getOrganizationMetadata$(
    organizationId: OrganizationId,
  ): Observable<OrganizationBillingMetadataResponse>;
}
