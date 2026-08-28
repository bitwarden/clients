import { inject, Injectable } from "@angular/core";
import { Observable, distinctUntilChanged, from, map, of, switchMap } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationApiKeyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { OrganizationUserStatusType } from "@bitwarden/sdk-internal";
import { SubscriptionPreview } from "@bitwarden/subscription";

import { SubscriptionPreviewService } from "../services/subscription-preview.service";

@Injectable({ providedIn: "root" })
export class OrganizationSubscriptionDataService {
  private readonly organizationService = inject(OrganizationService);
  private readonly organizationApiService = inject(OrganizationApiServiceAbstraction);
  private readonly organizationUserApiService = inject(OrganizationUserApiService);
  private readonly subscriptionPreviewService = inject(SubscriptionPreviewService);
  private readonly accountService = inject(AccountService);

  /**
   * Returns the organization information for the given organization ID.
   */
  readonly organization$ = (organizationId: string): Observable<Organization | undefined> => {
    return getUserId(this.accountService.activeAccount$).pipe(
      switchMap((userId) =>
        this.organizationService
          .organizations$(userId)
          .pipe(map((organizations) => organizations.find((org) => org.id === organizationId))),
      ),
      distinctUntilChanged((a, b) => a?.id === b?.id),
    );
  };

  /**
   * Returns the subscription information for the given organization.
   */
  readonly organizationSubscription$ = (
    organizationId: string,
  ): Observable<OrganizationSubscriptionResponse | null> => {
    return this.organization$(organizationId).pipe(
      switchMap((org) => (org ? this.organizationApiService.getSubscription(org.id) : of(null))),
    );
  };

  /**
   * Returns whether the given organization has a billing sync token.
   */
  readonly hasBillingSyncToken$ = (organizationId: string): Observable<boolean> => {
    return this.organization$(organizationId).pipe(
      switchMap((org) =>
        org
          ? from(this.organizationApiService.getApiKeyInformation(org.id)).pipe(
              map((response) =>
                response.data.some((key) => key.keyType === OrganizationApiKeyType.BillingSync),
              ),
            )
          : of(false),
      ),
    );
  };

  /**
   * Returns the number of reseller seats remaining for the given organization.
   */
  readonly resellerSeatsRemaining$ = (organizationId: string): Observable<number | null> => {
    return this.organization$(organizationId).pipe(
      switchMap((org) =>
        org && org.hasReseller
          ? from(this.organizationUserApiService.getAllUsers(org.id)).pipe(
              map((response) => {
                const activeUserCount = response.data.filter((user) =>
                  [
                    OrganizationUserStatusType.Invited,
                    OrganizationUserStatusType.Accepted,
                    OrganizationUserStatusType.Confirmed,
                  ].includes(user.status),
                ).length;
                return org.seats - activeUserCount;
              }),
            )
          : of(null),
      ),
    );
  };

  /**
   * Returns a subscription preview for the given organization.
   * @param organizationId The ID of the organization for which to get the subscription preview.
   * @returns A promise that resolves to the subscription preview for the given organization.
   */
  async getSubscriptionPreview(organizationId: string): Promise<SubscriptionPreview> {
    return this.subscriptionPreviewService.getOrganizationSubscriptionPreview(organizationId);
  }
}
