import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { lastValueFrom, Observable, shareReplay } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { isNotSelfUpgradable, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";

import { isFixedSeatPlan } from "../../../admin-console/organizations/members/components/member-dialog/validators/org-seat-limit-reached.validator";
import {
  ChangePlanDialogResultType,
  openChangePlanDialog,
} from "../../organizations/change-plan-dialog.component";

export interface SeatLimitResult {
  canAddUsers: boolean;
  reason?: "reseller-limit" | "fixed-seat-limit" | "no-billing-permission";
  shouldShowUpgradeDialog?: boolean;
}

@Injectable()
export class BillingConstraintService {
  constructor(
    private i18nService: I18nService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private organizationMetadataService: OrganizationMetadataServiceAbstraction,
    private router: Router,
  ) {}

  getBillingMetadata$(
    organizationId: OrganizationId,
  ): Observable<OrganizationBillingMetadataResponse> {
    return this.organizationMetadataService
      .getOrganizationMetadata$(organizationId)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
  }

  refreshBillingMetadata(): void {
    this.organizationMetadataService.refreshMetadataCache();
  }

  checkSeatLimit(
    organization: Organization,
    billingMetadata: OrganizationBillingMetadataResponse,
  ): SeatLimitResult {
    const occupiedSeats = billingMetadata?.organizationOccupiedSeats;
    if (occupiedSeats == null) {
      throw new Error("Cannot check seat limit: billingMetadata is null or undefined.");
    }
    const totalSeats = organization.seats;

    if (occupiedSeats < totalSeats) {
      return { canAddUsers: true };
    }

    if (organization.hasReseller) {
      return {
        canAddUsers: false,
        reason: "reseller-limit",
      };
    }

    if (isFixedSeatPlan(organization.productTierType)) {
      return {
        canAddUsers: false,
        reason: "fixed-seat-limit",
        shouldShowUpgradeDialog: organization.canEditSubscription,
      };
    }

    return { canAddUsers: true };
  }

  async seatLimitReached(result: SeatLimitResult, organization: Organization): Promise<boolean> {
    if (result.canAddUsers) {
      return false;
    }

    switch (result.reason) {
      case "reseller-limit":
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("seatLimitReached"),
          message: this.i18nService.t("contactYourProvider"),
        });
        return true;

      case "fixed-seat-limit":
        if (result.shouldShowUpgradeDialog) {
          return await this.handleFixedSeatLimitUpgrade(organization);
        } else {
          await this.showSeatLimitReachedDialog(organization);
          return true;
        }

      default:
        return true;
    }
  }

  private async handleFixedSeatLimitUpgrade(organization: Organization): Promise<boolean> {
    const reference = openChangePlanDialog(this.dialogService, {
      data: {
        organizationId: organization.id,
        productTierType: organization.productTierType,
      },
    });

    const result = await lastValueFrom(reference.closed);
    return result === ChangePlanDialogResultType.Submitted;
  }

  private async showSeatLimitReachedDialog(organization: Organization): Promise<void> {
    const dialogContent = this.getDialogContent(organization);
    const acceptButtonText = this.getAcceptButtonText(organization);

    const orgUpgradeSimpleDialogOpts = {
      title: this.i18nService.t("upgradeOrganization"),
      content: dialogContent,
      type: "primary" as const,
      acceptButtonText,
      cancelButtonText: organization.canEditSubscription ? undefined : (null as string | null),
    };

    const simpleDialog = this.dialogService.openSimpleDialogRef(orgUpgradeSimpleDialogOpts);
    const result = await lastValueFrom(simpleDialog.closed);

    if (result && organization.canEditSubscription) {
      await this.handleUpgradeNavigation(organization);
    }
  }

  private async handleUpgradeNavigation(organization: Organization): Promise<void> {
    const productType = organization.productTierType;

    if (isNotSelfUpgradable(productType)) {
      throw new Error(`Unsupported product type: ${organization.productTierType}`);
    }

    await this.router.navigate(["/organizations", organization.id, "billing", "subscription"], {
      queryParams: { upgrade: true },
    });
  }

  private getDialogContent(organization: Organization): string {
    const productKey = this.getProductKey(organization);
    return this.i18nService.t(productKey, organization.seats);
  }

  private getAcceptButtonText(organization: Organization): string {
    if (!organization.canEditSubscription) {
      return this.i18nService.t("ok");
    }

    const productType = organization.productTierType;

    if (isNotSelfUpgradable(productType)) {
      throw new Error(`Unsupported product type: ${productType}`);
    }

    return this.i18nService.t("upgrade");
  }

  private getProductKey(organization: Organization): string {
    const manageBillingText = organization.canEditSubscription
      ? "ManageBilling"
      : "NoManageBilling";

    let product = "";
    switch (organization.productTierType) {
      case ProductTierType.Free:
        product = "freeOrg";
        break;
      case ProductTierType.TeamsStarter:
        product = "teamsStarterPlan";
        break;
      case ProductTierType.Families:
        product = "familiesPlan";
        break;
      default:
        throw new Error(`Unsupported product type: ${organization.productTierType}`);
    }
    return `${product}InvLimitReached${manageBillingText}`;
  }

  async navigateToPaymentMethod(organization: Organization): Promise<void> {
    await this.router.navigate(
      ["organizations", `${organization.id}`, "billing", "payment-method"],
      {
        state: { launchPaymentModalAutomatically: true },
      },
    );
  }
}
