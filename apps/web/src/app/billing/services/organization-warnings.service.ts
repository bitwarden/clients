import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import {
  filter,
  from,
  lastValueFrom,
  map,
  Observable,
  shareReplay,
  switchMap,
  takeWhile,
} from "rxjs";
import { take } from "rxjs/operators";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationBillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-billing-api.service.abstraction";
import { OrganizationWarningsResponse } from "@bitwarden/common/billing/models/response/organization-warnings.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { openChangePlanDialog } from "@bitwarden/web-vault/app/billing/organizations/change-plan-dialog.component";

const format = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

export type FreeTrialWarning = {
  organization: Pick<Organization, "id" & "name">;
  message: string;
};

export type ResellerRenewalWarning = {
  type: "info" | "warning";
  message: string;
};

@Injectable({ providedIn: "root" })
export class OrganizationWarningsService {
  private cache$ = new Map<OrganizationId, Observable<OrganizationWarningsResponse>>();

  constructor(
    private dialogService: DialogService,
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationBillingApiService: OrganizationBillingApiServiceAbstraction,
    private router: Router,
  ) {}

  getFreeTrialWarning$ = (organization: Organization): Observable<FreeTrialWarning> =>
    this.getWarning$(organization, (response) => response.freeTrial).pipe(
      map((warning) => {
        const { remainingTrialDays } = warning;

        if (remainingTrialDays >= 2) {
          return {
            organization,
            message: this.i18nService.t("freeTrialEndPromptCount", remainingTrialDays),
          };
        }

        if (remainingTrialDays == 1) {
          return {
            organization,
            message: this.i18nService.t("freeTrialEndPromptTomorrowNoOrgName"),
          };
        }

        return {
          organization,
          message: this.i18nService.t("freeTrialEndingTodayWithoutOrgName"),
        };
      }),
    );

  getResellerRenewalWarning$ = (organization: Organization): Observable<ResellerRenewalWarning> =>
    this.getWarning$(organization, (response) => response.resellerRenewal).pipe(
      map((warning): ResellerRenewalWarning | null => {
        switch (warning.type) {
          case "upcoming": {
            return {
              type: "info",
              message: this.i18nService.t(
                "resellerRenewalWarningMsg",
                organization.providerName,
                format(warning.upcoming!.renewalDate),
              ),
            };
          }
          case "issued": {
            return {
              type: "info",
              message: this.i18nService.t(
                "resellerOpenInvoiceWarningMgs",
                organization.providerName,
                format(warning.issued!.issuedDate),
                format(warning.issued!.dueDate),
              ),
            };
          }
          case "past_due": {
            return {
              type: "warning",
              message: this.i18nService.t(
                "resellerPastDueWarningMsg",
                organization.providerName,
                format(warning.pastDue!.suspensionDate),
              ),
            };
          }
        }
      }),
      filter((result): result is NonNullable<typeof result> => result !== null),
    );

  showInactiveSubscriptionDialog$ = (organization: Organization): Observable<void> =>
    this.getWarning$(organization, (response) => response.inactiveSubscription).pipe(
      switchMap(async (warning) => {
        switch (warning.resolution) {
          case "contact_provider": {
            await this.dialogService.openSimpleDialog({
              title: this.i18nService.t("suspendedOrganizationTitle", organization.name),
              content: {
                key: "suspendedManagedOrgMessage",
                placeholders: [organization.providerName],
              },
              type: "danger",
              acceptButtonText: this.i18nService.t("close"),
              cancelButtonText: null,
            });
            break;
          }
          case "add_payment_method": {
            const confirmed = await this.dialogService.openSimpleDialog({
              title: this.i18nService.t("suspendedOrganizationTitle", organization.name),
              content: { key: "suspendedOwnerOrgMessage" },
              type: "danger",
              acceptButtonText: this.i18nService.t("continue"),
              cancelButtonText: this.i18nService.t("close"),
            });
            if (confirmed) {
              await this.router.navigate(
                ["organizations", `${organization.id}`, "billing", "payment-method"],
                {
                  state: { launchPaymentModalAutomatically: true },
                },
              );
            }
            break;
          }
          case "resubscribe": {
            const subscription = await this.organizationApiService.getSubscription(organization.id);
            const dialogReference = openChangePlanDialog(this.dialogService, {
              data: {
                organizationId: organization.id,
                subscription: subscription,
                productTierType: organization.productTierType,
              },
            });
            await lastValueFrom(dialogReference.closed);
            break;
          }
          case "contact_owner": {
            await this.dialogService.openSimpleDialog({
              title: this.i18nService.t("suspendedOrganizationTitle", organization.name),
              content: { key: "suspendedUserOrgMessage" },
              type: "danger",
              acceptButtonText: this.i18nService.t("close"),
              cancelButtonText: null,
            });
            break;
          }
        }
      }),
    );

  private getResponse$ = (organization: Organization): Observable<OrganizationWarningsResponse> => {
    const existing = this.cache$.get(organization.id as OrganizationId);
    if (existing) {
      return existing;
    }
    const response$ = from(this.organizationBillingApiService.getWarnings(organization.id)).pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.cache$.set(organization.id as OrganizationId, response$);
    return response$;
  };

  private getWarning$ = <T>(
    organization: Organization,
    extract: (response: OrganizationWarningsResponse) => T | null | undefined,
  ): Observable<T> =>
    this.getResponse$(organization).pipe(
      map(extract),
      takeWhile((warning): warning is T => !!warning),
      take(1),
    );
}
