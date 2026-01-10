// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { formatDate } from "@angular/common";
import { Component, EventEmitter, Input, Output, OnInit } from "@angular/core";
import { firstValueFrom, map, Observable, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationSponsorshipApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-sponsorship-api.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "[sponsoring-org-row]",
  templateUrl: "sponsoring-org-row.component.html",
  standalone: false,
})
export class SponsoringOrgRowComponent implements OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() sponsoringOrg: Organization = null;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() isSelfHosted = false;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() sponsorshipRemoved = new EventEmitter();

  statusMessage = "loading";
  statusClass: "tw-text-success" | "tw-text-danger" = "tw-text-success";
  isFreeFamilyPolicyEnabled$: Observable<boolean>;
  private locale = "";

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private logService: LogService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private policyService: PolicyService,
    private accountService: AccountService,
    private organizationSponsorshipApiService: OrganizationSponsorshipApiServiceAbstraction,
  ) {}

  async ngOnInit() {
    this.locale = await firstValueFrom(this.i18nService.locale$);

    this.setStatus(
      this.isSelfHosted,
      this.sponsoringOrg.familySponsorshipToDelete,
      this.sponsoringOrg.familySponsorshipValidUntil,
      this.sponsoringOrg.familySponsorshipLastSyncDate,
    );

    this.isFreeFamilyPolicyEnabled$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policiesByType$(PolicyType.FreeFamiliesSponsorshipPolicy, userId),
      ),
      map(
        (policies) =>
          Array.isArray(policies) &&
          policies.some(
            (policy) => policy.organizationId === this.sponsoringOrg.id && policy.enabled,
          ),
      ),
    );
  }

  async revokeSponsorship() {
    try {
      await this.doRevokeSponsorship();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async resendEmail() {
    await this.organizationSponsorshipApiService.postResendSponsorshipOffer(
      this.sponsoringOrg.id,
      this.sponsoringOrg.familySponsorshipFriendlyName,
    );
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("emailSent"),
    });
  }

  private async doRevokeSponsorship() {
    const content = this.sponsoringOrg.familySponsorshipValidUntil
      ? this.i18nService.t(
          "updatedRevokeSponsorshipConfirmationForAcceptedSponsorship",
          this.sponsoringOrg.familySponsorshipFriendlyName,
          formatDate(this.sponsoringOrg.familySponsorshipValidUntil, "MM/dd/yyyy", this.locale),
        )
      : this.i18nService.t(
          "updatedRevokeSponsorshipConfirmationForSentSponsorship",
          this.sponsoringOrg.familySponsorshipFriendlyName,
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

    await this.organizationSponsorshipApiService.deleteRevokeSponsorship(this.sponsoringOrg.id);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("reclaimedFreePlan"),
    });
    this.sponsorshipRemoved.emit();
  }

  private setStatus(
    selfHosted: boolean,
    toDelete?: boolean,
    validUntil?: Date,
    lastSyncDate?: Date,
  ) {
    /*
     * Possible Statuses:
     * Requested (self-hosted only)
     * Sent
     * Active
     * RequestRevoke
     * RevokeWhenExpired
     */

    if (toDelete && validUntil) {
      // They want to delete but there is a valid until date which means there is an active sponsorship
      this.statusMessage = this.i18nService.t(
        "revokeWhenExpired",
        formatDate(validUntil, "MM/dd/yyyy", this.locale),
      );
      this.statusClass = "tw-text-danger";
    } else if (toDelete) {
      // They want to delete and we don't have a valid until date so we can
      // this should only happen on a self-hosted install
      this.statusMessage = this.i18nService.t("requestRemoved");
      this.statusClass = "tw-text-danger";
    } else if (validUntil) {
      // They don't want to delete and they have a valid until date
      // that means they are actively sponsoring someone
      this.statusMessage = this.i18nService.t("active");
      this.statusClass = "tw-text-success";
    } else if (selfHosted && lastSyncDate) {
      // We are on a self-hosted install and it has been synced but we have not gotten
      // a valid until date so we can't know if they are actively sponsoring someone
      this.statusMessage = this.i18nService.t("sent");
      this.statusClass = "tw-text-success";
    } else if (!selfHosted) {
      // We are in cloud and all other status checks have been false therefore we have
      // sent the request but it hasn't been accepted yet
      this.statusMessage = this.i18nService.t("sent");
      this.statusClass = "tw-text-success";
    } else {
      // We are on a self-hosted install and we have not synced yet
      this.statusMessage = this.i18nService.t("requested");
      this.statusClass = "tw-text-success";
    }
  }
}
