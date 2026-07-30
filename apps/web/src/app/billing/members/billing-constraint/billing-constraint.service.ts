import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { lastValueFrom } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { isNotSelfUpgradable, ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { isFixedSeatPlan } from "../../../admin-console/organizations/members/components/member-dialog/validators/input-email-limit.validator";
import {
  ChangePlanDialogResultType,
  openChangePlanDialog,
} from "../../organizations/change-plan-dialog.component";

export interface SeatLimitResult {
  canAddUsers: boolean;
  reason?: "reseller-limit" | "fixed-seat-limit" | "no-billing-permission" | "no-payment-method";
  shouldShowUpgradeDialog?: boolean;
  /** Seats currently occupied, included whenever a seat limit reason is returned so the UI can
   *  show the user exactly how many of their seats are in use. */
  occupiedSeats?: number;
}

export type SeatLimitAction = "invite" | "restore";

@Injectable()
export class BillingConstraintService {
  constructor(
    private i18nService: I18nService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private router: Router,
  ) {}

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
        occupiedSeats,
      };
    }

    if (isFixedSeatPlan(organization.productTierType)) {
      return {
        canAddUsers: false,
        reason: "fixed-seat-limit",
        shouldShowUpgradeDialog: organization.canEditSubscription,
        occupiedSeats,
      };
    }

    // Dynamic-seat plans (Teams, Enterprise) can auto-purchase seats on demand, but only if
    // the organization has a payment method on file to charge for the new seats.
    if (!billingMetadata.hasPaymentMethod) {
      return {
        canAddUsers: false,
        reason: "no-payment-method",
        shouldShowUpgradeDialog: organization.canEditSubscription,
        occupiedSeats,
      };
    }

    return { canAddUsers: true };
  }

  async seatLimitReached(
    result: SeatLimitResult,
    organization: Organization,
    action: SeatLimitAction = "invite",
  ): Promise<boolean> {
    if (result.canAddUsers) {
      return false;
    }

    switch (result.reason) {
      case "reseller-limit":
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("seatLimitReached"),
          message: this.i18nService.t(
            "contactYourProvider",
            result.occupiedSeats,
            organization.seats,
          ),
        });
        return true;

      case "fixed-seat-limit":
        if (result.shouldShowUpgradeDialog) {
          const dialogResult = await this.showChangePlanDialog(organization);
          // If the plan was successfully changed, the seat limit is no longer blocking
          return dialogResult !== ChangePlanDialogResultType.Submitted;
        } else {
          await this.showSeatLimitReachedDialog(organization, action, result.occupiedSeats);
          return true;
        }

      case "no-payment-method":
        if (result.shouldShowUpgradeDialog) {
          await this.showNoPaymentMethodDialog(organization, result.occupiedSeats);
        } else {
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("seatLimitReached"),
            message: this.i18nService.t(
              "noPaymentMethodContactOwner",
              result.occupiedSeats,
              organization.seats,
            ),
          });
        }
        return true;

      default:
        return true;
    }
  }

  private async showChangePlanDialog(
    organization: Organization,
  ): Promise<ChangePlanDialogResultType> {
    const reference = openChangePlanDialog(this.dialogService, {
      data: {
        organizationId: organization.id,
        productTierType: organization.productTierType,
      },
    });

    const result = await lastValueFrom(reference.closed);
    if (result == null) {
      throw new Error("ChangePlanDialog result is null or undefined.");
    }

    return result;
  }

  private async showSeatLimitReachedDialog(
    organization: Organization,
    action: SeatLimitAction,
    occupiedSeats: number | undefined,
  ): Promise<void> {
    const dialogContent = this.getSeatLimitReachedDialogContent(
      organization,
      action,
      occupiedSeats,
    );
    const acceptButtonText = this.getSeatLimitReachedDialogAcceptButtonText(organization);

    const orgUpgradeSimpleDialogOpts = {
      title: this.i18nService.t(
        action === "restore" ? "cannotRestoreAccessError" : "upgradeOrganization",
      ),
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

  private async showNoPaymentMethodDialog(
    organization: Organization,
    occupiedSeats: number | undefined,
  ): Promise<void> {
    const simpleDialog = this.dialogService.openSimpleDialogRef({
      title: this.i18nService.t("seatLimitReached"),
      content: this.i18nService.t(
        "noPaymentMethodOnFileInviteLimitReached",
        occupiedSeats,
        organization.seats,
      ),
      type: "primary",
      acceptButtonText: this.i18nService.t("addPaymentMethod"),
    });

    const result = await lastValueFrom(simpleDialog.closed);
    if (result) {
      await this.navigateToPaymentMethod(organization);
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

  private getSeatLimitReachedDialogContent(
    organization: Organization,
    action: SeatLimitAction,
    occupiedSeats: number | undefined,
  ): string {
    const productKey = this.getProductKey(organization, action);
    return this.i18nService.t(productKey, occupiedSeats, organization.seats);
  }

  private getSeatLimitReachedDialogAcceptButtonText(organization: Organization): string {
    if (!organization.canEditSubscription) {
      return this.i18nService.t("ok");
    }

    const productType = organization.productTierType;

    if (isNotSelfUpgradable(productType)) {
      throw new Error(`Unsupported product type: ${productType}`);
    }

    return this.i18nService.t("upgrade");
  }

  private getProductKey(organization: Organization, action: SeatLimitAction): string {
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
    const actionText = action === "restore" ? "Restore" : "Inv";
    return `${product}${actionText}LimitReached${manageBillingText}`;
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
