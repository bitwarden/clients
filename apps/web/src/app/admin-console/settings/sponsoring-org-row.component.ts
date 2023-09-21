import { formatDate } from "@angular/common";
import { Component, EventEmitter, Input, Output, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

@Component({
  selector: "[sponsoring-org-row]",
  templateUrl: "sponsoring-org-row.component.html",
})
export class SponsoringOrgRowComponent implements OnInit {
  @Input() sponsoringOrg: Organization = null;
  @Input() isSelfHosted = false;

  @Output() sponsorshipRemoved = new EventEmitter();

  statusMessage = "loading";
  statusClass: "text-success" | "text-danger" = "text-success";

  revokeSponsorshipPromise: Promise<any>;
  resendEmailPromise: Promise<any>;

  private locale = "";

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private logService: LogService,
    private platformUtilsService: PlatformUtilsService,
    private dialogService: DialogService
  ) {}

  async ngOnInit() {
    this.locale = await firstValueFrom(this.i18nService.locale$);

    this.setStatus(
      this.isSelfHosted,
      this.sponsoringOrg.familySponsorshipToDelete,
      this.sponsoringOrg.familySponsorshipValidUntil,
      this.sponsoringOrg.familySponsorshipLastSyncDate
    );
  }

  async revokeSponsorship() {
    try {
      this.revokeSponsorshipPromise = this.doRevokeSponsorship();
      await this.revokeSponsorshipPromise;
    } catch (e) {
      this.logService.error(e);
    }

    this.revokeSponsorshipPromise = null;
  }

  async resendEmail() {
    this.resendEmailPromise = this.apiService.postResendSponsorshipOffer(this.sponsoringOrg.id);
    await this.resendEmailPromise;
    this.platformUtilsService.showToast("success", null, this.i18nService.t("emailSent"));
    this.resendEmailPromise = null;
  }

  get isSentAwaitingSync() {
    return this.isSelfHosted && !this.sponsoringOrg.familySponsorshipLastSyncDate;
  }

  private async doRevokeSponsorship() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: `${this.i18nService.t("remove")} ${this.sponsoringOrg.familySponsorshipFriendlyName}?`,
      content: { key: "revokeSponsorshipConfirmation" },
      acceptButtonText: { key: "remove" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    await this.apiService.deleteRevokeSponsorship(this.sponsoringOrg.id);
    this.platformUtilsService.showToast("success", null, this.i18nService.t("reclaimedFreePlan"));
    this.sponsorshipRemoved.emit();
  }

  private setStatus(
    selfHosted: boolean,
    toDelete?: boolean,
    validUntil?: Date,
    lastSyncDate?: Date
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
        formatDate(validUntil, "MM/dd/yyyy", this.locale)
      );
      this.statusClass = "text-danger";
    } else if (toDelete) {
      // They want to delete and we don't have a valid until date so we can
      // this should only happen on a self-hosted install
      this.statusMessage = this.i18nService.t("requestRemoved");
      this.statusClass = "text-danger";
    } else if (validUntil) {
      // They don't want to delete and they have a valid until date
      // that means they are actively sponsoring someone
      this.statusMessage = this.i18nService.t("active");
      this.statusClass = "text-success";
    } else if (selfHosted && lastSyncDate) {
      // We are on a self-hosted install and it has been synced but we have not gotten
      // a valid until date so we can't know if they are actively sponsoring someone
      this.statusMessage = this.i18nService.t("sent");
      this.statusClass = "text-success";
    } else if (!selfHosted) {
      // We are in cloud and all other status checks have been false therefore we have
      // sent the request but it hasn't been accepted yet
      this.statusMessage = this.i18nService.t("sent");
      this.statusClass = "text-success";
    } else {
      // We are on a self-hosted install and we have not synced yet
      this.statusMessage = this.i18nService.t("requested");
      this.statusClass = "text-success";
    }
  }
}
