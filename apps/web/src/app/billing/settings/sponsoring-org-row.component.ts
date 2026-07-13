import { CommonModule, CurrencyPipe, formatDate } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, output, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom, map, switchMap } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationSponsorshipApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-sponsorship-api.service.abstraction";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import { PersonalSubscriptionPricingTierIds } from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  DialogService,
  IconButtonModule,
  MenuModule,
  TableModule,
  ToastService,
  IconModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "[sponsoring-org-row]",
  templateUrl: "sponsoring-org-row.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, I18nPipe, TableModule, IconButtonModule, MenuModule, IconModule],
  providers: [CurrencyPipe],
})
export class SponsoringOrgRowComponent {
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly policyService = inject(PolicyService);
  private readonly accountService = inject(AccountService);
  private readonly organizationSponsorshipApiService = inject(
    OrganizationSponsorshipApiServiceAbstraction,
  );
  private readonly subscriptionPricingService = inject(SubscriptionPricingServiceAbstraction);
  private readonly currencyPipe = inject(CurrencyPipe);

  readonly sponsoringOrg = input.required<Organization>();
  readonly isSelfHosted = input(false);
  readonly sponsorshipRemoved = output();

  private readonly locale = toSignal(this.i18nService.locale$, { initialValue: "" });

  protected readonly isFreeFamilyPolicyEnabled$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      this.policyService.policiesByType$(PolicyType.FreeFamiliesSponsorship, userId),
    ),
    map(
      (policies) =>
        Array.isArray(policies) &&
        policies.some(
          (policy) => policy.organizationId === this.sponsoringOrg().id && policy.enabled,
        ),
    ),
  );

  /**
   * Possible statuses (in priority order):
   * - RevokeWhenExpired: marked for deletion while an active sponsorship exists — revokes at expiry
   * - RequestRemoved: marked for deletion before the offer was accepted
   * - Active: families subscription is actively paid for by this org
   * - Sent: self-hosted, synced at least once, awaiting valid-until from the sponsored org
   * - Requested: cloud offer sent but not yet accepted; or self-hosted not yet synced
   */
  protected readonly statusMessage = computed(() => {
    const {
      familySponsorshipToDelete: toBeDeleted,
      familySponsorshipValidUntil: validUntilDate,
      familySponsorshipLastSyncDate: lastSyncDate,
    } = this.sponsoringOrg();
    const locale = this.locale();

    // Pending deletion (either actively sponsoring and marked for deletion, or sponsorship offer sent but then marked for deletion before being accepted)
    if (toBeDeleted) {
      return validUntilDate
        ? this.i18nService.t("revokeWhenExpired", formatDate(validUntilDate, "MM/dd/yyyy", locale))
        : this.i18nService.t("requestRemoved");
    }
    // Actively sponsoring someone
    if (validUntilDate) {
      return this.i18nService.t("active");
    }
    // Cloud: offer sent but not yet accepted. Self-hosted: synced at least once but no valid-until yet.
    if (!this.isSelfHosted() || lastSyncDate) {
      return this.i18nService.t("sent");
    }
    // Self-hosted only: sponsorship offered but the install hasn't synced yet to pick it up
    return this.i18nService.t("requested");
  });

  protected readonly statusClass = computed<"tw-text-success" | "tw-text-danger">(() =>
    this.sponsoringOrg().familySponsorshipToDelete ? "tw-text-danger" : "tw-text-success",
  );

  protected async revokeSponsorship() {
    try {
      await this.doRevokeSponsorship();
    } catch (e) {
      this.logService.error(e);
    }
  }

  protected async resendEmail() {
    await this.organizationSponsorshipApiService.postResendSponsorshipOffer(
      this.sponsoringOrg().id,
      this.sponsoringOrg().familySponsorshipFriendlyName,
    );
    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t("emailSent"),
    });
  }

  private async doRevokeSponsorship() {
    const tiers = await firstValueFrom(
      this.subscriptionPricingService.getPersonalSubscriptionPricingTiers$(),
    );
    const familiesTier = tiers.find((t) => t.id === PersonalSubscriptionPricingTierIds.Families);
    const annualPrice = familiesTier?.passwordManager.annualPrice ?? 0;
    const digitsInfo = Number.isInteger(annualPrice) ? "1.0-0" : "1.2-2";
    const formattedPrice =
      this.currencyPipe.transform(annualPrice, "USD", "symbol", digitsInfo) ?? `$${annualPrice}`;

    const sponsoringOrg = this.sponsoringOrg();
    const content = sponsoringOrg.familySponsorshipValidUntil
      ? this.i18nService.t(
          "revokeSponsorshipAcceptedWithPriceConfirmation",
          sponsoringOrg.familySponsorshipFriendlyName,
          formattedPrice,
          formatDate(sponsoringOrg.familySponsorshipValidUntil, "MM/dd/yyyy", this.locale()),
        )
      : this.i18nService.t(
          "updatedRevokeSponsorshipConfirmationForSentSponsorship",
          sponsoringOrg.familySponsorshipFriendlyName,
        );

    const confirmed = await this.dialogService.openSimpleDialog({
      title: `${this.i18nService.t("removeSponsorship")}?`,
      content,
      acceptButtonText: { key: "remove" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    await this.organizationSponsorshipApiService.deleteRevokeSponsorship(this.sponsoringOrg().id);
    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t("reclaimedFreePlan"),
    });
    this.sponsorshipRemoved.emit();
  }
}
