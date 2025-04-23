import { DialogRef } from "@angular/cdk/dialog";
import { formatDate } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, Subject, takeUntil } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationSponsorshipApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-sponsorship-api.service.abstraction";
import { OrganizationSponsorshipInvitesResponse } from "@bitwarden/common/billing/models/response/organization-sponsorship-invites.response";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import {
  AddSponsorshipDialogComponent,
  AddSponsorshipDialogResult,
} from "./add-sponsorship-dialog.component";

@Component({
  selector: "app-free-bitwarden-families",
  templateUrl: "free-bitwarden-families.component.html",
})
export class FreeBitwardenFamiliesComponent implements OnInit {
  loading = signal<boolean>(false);
  tabIndex = 0;
  sponsoredFamilies: OrganizationSponsorshipInvitesResponse[] = [];

  organizationId = "";

  private locale: string = "";

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private dialogService: DialogService,
    private apiService: ApiService,
    private encryptService: EncryptService,
    private keyService: KeyService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private logService: LogService,
    private toastService: ToastService,
    private organizationSponsorshipApiService: OrganizationSponsorshipApiServiceAbstraction,
  ) {}

  async ngOnInit() {
    this.locale = await firstValueFrom(this.i18nService.locale$);

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.organizationId = params.organizationId || "";
    });
    this.organizationId = this.route.snapshot.params.organizationId || "";

    this.loading.set(true);

    await this.loadSponsorships();

    this.loading.set(false);
  }

  async loadSponsorships() {
    if (!this.organizationId) {
      return;
    }

    const [response, orgKey] = await Promise.all([
      this.organizationSponsorshipApiService.getOrganizationSponsorship(this.organizationId),
      this.keyService.getOrgKey(this.organizationId),
    ]);

    if (!orgKey) {
      this.logService.error("Organization key not found");
      return;
    }

    const organizationFamilies = response.data;

    this.sponsoredFamilies = await Promise.all(
      organizationFamilies.map(async (family) => {
        let decryptedNote = "";
        try {
          decryptedNote = await this.encryptService.decryptToUtf8(
            new EncString(family.notes),
            orgKey,
          );
        } catch (e) {
          this.logService.error(e);
        }

        const { statusMessage, statusClass } = this.setStatus(
          this.isSelfHosted,
          family.toDelete,
          family.validUntil,
          family.lastSyncDate,
          this.locale,
        );

        const newFamily = {
          ...family,
          notes: decryptedNote,
          statusMessage: statusMessage || "",
          statusClass: statusClass || "tw-text-success",
        };

        return new OrganizationSponsorshipInvitesResponse(newFamily);
      }),
    );
  }

  async addSponsorship() {
    const addSponsorshipDialogRef: DialogRef<AddSponsorshipDialogResult> =
      AddSponsorshipDialogComponent.open(this.dialogService, {
        data: { organizationId: this.organizationId },
      });

    await firstValueFrom(addSponsorshipDialogRef.closed);

    await this.loadSponsorships();
  }

  async removeSponsorhip(sponsorship: OrganizationSponsorshipInvitesResponse) {
    try {
      await this.doRevokeSponsorship(sponsorship);
    } catch (e) {
      this.logService.error(e);
    }
  }

  get isSelfHosted(): boolean {
    return this.platformUtilsService.isSelfHost();
  }

  async resendEmail(sponsorship: OrganizationSponsorshipInvitesResponse) {
    await this.apiService.postResendSponsorshipOffer(sponsorship.sponsoringOrganizationUserId);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("emailSent"),
    });
  }

  private async doRevokeSponsorship(sponsorship: OrganizationSponsorshipInvitesResponse) {
    const content = sponsorship.validUntil
      ? this.i18nService.t(
          "updatedRevokeSponsorshipConfirmationForAcceptedSponsorship",
          sponsorship.friendlyName,
          formatDate(sponsorship.validUntil, "MM/dd/yyyy", this.locale),
        )
      : this.i18nService.t(
          "updatedRevokeSponsorshipConfirmationForSentSponsorship",
          sponsorship.friendlyName,
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

    await this.apiService.deleteRevokeSponsorship(sponsorship.sponsoringOrganizationUserId);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("reclaimedFreePlan"),
    });

    await this.loadSponsorships();
  }

  private setStatus(
    selfHosted: boolean,
    toDelete?: boolean,
    validUntil?: Date,
    lastSyncDate?: Date,
    locale: string = "",
  ): { statusMessage: string; statusClass: string } {
    /*
     * Possible Statuses:
     * Requested (self-hosted only)
     * Sent
     * Active
     * RequestRevoke
     * RevokeWhenExpired
     */

    let statusMessage = "loading";
    let statusClass: "tw-text-success" | "tw-text-danger" = "tw-text-success";

    if (toDelete && validUntil) {
      // They want to delete but there is a valid until date which means there is an active sponsorship
      statusMessage = this.i18nService.t(
        "revokeWhenExpired",
        formatDate(validUntil, "MM/dd/yyyy", locale),
      );
      statusClass = "tw-text-danger";
      return { statusMessage, statusClass };
    } else if (toDelete) {
      // They want to delete and we don't have a valid until date so we can
      // this should only happen on a self-hosted install
      statusMessage = this.i18nService.t("requestRemoved");
      statusClass = "tw-text-danger";
      return { statusMessage, statusClass };
    } else if (validUntil) {
      // They don't want to delete and they have a valid until date
      // that means they are actively sponsoring someone
      statusMessage = this.i18nService.t("active");
      statusClass = "tw-text-success";
      return { statusMessage, statusClass };
    } else if (selfHosted && lastSyncDate) {
      // We are on a self-hosted install and it has been synced but we have not gotten
      // a valid until date so we can't know if they are actively sponsoring someone
      statusMessage = this.i18nService.t("sent");
      statusClass = "tw-text-success";
      return { statusMessage, statusClass };
    } else if (!selfHosted) {
      // We are in cloud and all other status checks have been false therefore we have
      // sent the request but it hasn't been accepted yet
      statusMessage = this.i18nService.t("sent");
      statusClass = "tw-text-success";
      return { statusMessage, statusClass };
    } else {
      // We are on a self-hosted install and we have not synced yet
      statusMessage = this.i18nService.t("requested");
      statusClass = "tw-text-success";
      return { statusMessage, statusClass };
    }
  }
}
