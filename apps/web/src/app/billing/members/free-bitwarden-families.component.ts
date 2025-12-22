import { formatDate } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, map, Observable, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationSponsorshipApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-sponsorship-api.service.abstraction";
import { OrganizationSponsorshipInvitesResponse } from "@bitwarden/common/billing/models/response/organization-sponsorship-invites.response";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { AddSponsorshipDialogComponent } from "./add-sponsorship-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-free-bitwarden-families",
  templateUrl: "free-bitwarden-families.component.html",
  standalone: false,
})
export class FreeBitwardenFamiliesComponent implements OnInit {
  readonly loading = signal<boolean>(true);
  tabIndex = 0;
  sponsoredFamilies: OrganizationSponsorshipInvitesResponse[] = [];

  organizationId = "";
  organizationKey$: Observable<OrgKey>;

  private locale: string = "";

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
    private stateProvider: StateProvider,
  ) {
    this.organizationId = this.route.snapshot.params.organizationId || "";
    this.organizationKey$ = this.stateProvider.activeUserId$.pipe(
      switchMap(
        (userId) =>
          this.keyService.orgKeys$(userId as UserId) as Observable<Record<OrganizationId, OrgKey>>,
      ),
      map((organizationKeysById) => organizationKeysById[this.organizationId as OrganizationId]),
      takeUntilDestroyed(),
    );
  }

  async ngOnInit() {
    this.locale = await firstValueFrom(this.i18nService.locale$);
    await this.loadSponsorships();

    this.loading.set(false);
  }

  async loadSponsorships() {
    if (!this.organizationId) {
      return;
    }

    const [response, orgKey] = await Promise.all([
      this.organizationSponsorshipApiService.getOrganizationSponsorship(this.organizationId),
      firstValueFrom(this.organizationKey$),
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
          decryptedNote = await this.encryptService.decryptString(
            new EncString(family.notes),
            orgKey,
          );
        } catch (e) {
          this.logService.error(e);
        }

        const { statusMessage, statusClass } = this.getStatus(
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
          status: statusMessage || "",
        };

        return new OrganizationSponsorshipInvitesResponse(newFamily);
      }),
    );
  }

  async addSponsorship() {
    const addSponsorshipDialogRef: DialogRef = AddSponsorshipDialogComponent.open(
      this.dialogService,
      {
        data: {
          organizationId: this.organizationId,
          organizationKey: await firstValueFrom(this.organizationKey$),
        },
      },
    );

    await firstValueFrom(addSponsorshipDialogRef.closed);

    await this.loadSponsorships();
  }

  async removeSponsorship(sponsorship: OrganizationSponsorshipInvitesResponse) {
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
    await this.organizationSponsorshipApiService.postResendSponsorshipOffer(
      this.organizationId,
      sponsorship.friendlyName,
    );
    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t("emailSent"),
    });
  }

  private async doRevokeSponsorship(sponsorship: OrganizationSponsorshipInvitesResponse) {
    const content = sponsorship.validUntil
      ? this.i18nService.t(
          "revokeActiveSponsorshipConfirmation",
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

    await this.organizationSponsorshipApiService.deleteAdminInitiatedRevokeSponsorship(
      this.organizationId,
      sponsorship.friendlyName,
    );

    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t("reclaimedFreePlan"),
    });

    await this.loadSponsorships();
  }

  private getStatus(
    selfHosted: boolean,
    toDelete?: boolean,
    validUntil?: Date,
    lastSyncDate?: Date,
    locale: string = "",
  ): { statusMessage: string; statusClass: "tw-text-success" | "tw-text-danger" } {
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
      return {
        statusMessage: this.i18nService.t(
          "revokeWhenExpired",
          formatDate(validUntil, "MM/dd/yyyy", locale),
        ),
        statusClass: "tw-text-danger",
      };
    }

    if (toDelete) {
      // They want to delete and we don't have a valid until date so we can
      // this should only happen on a self-hosted install
      return {
        statusMessage: this.i18nService.t("requestRemoved"),
        statusClass: "tw-text-danger",
      };
    }

    if (validUntil) {
      // They don't want to delete and they have a valid until date
      // that means they are actively sponsoring someone
      return {
        statusMessage: this.i18nService.t("active"),
        statusClass: "tw-text-success",
      };
    }

    if (selfHosted && lastSyncDate) {
      // We are on a self-hosted install and it has been synced but we have not gotten
      // a valid until date so we can't know if they are actively sponsoring someone
      return {
        statusMessage: this.i18nService.t("sent"),
        statusClass: "tw-text-success",
      };
    }

    if (!selfHosted) {
      // We are in cloud and all other status checks have been false therefore we have
      // sent the request but it hasn't been accepted yet
      return {
        statusMessage: this.i18nService.t("sent"),
        statusClass: "tw-text-success",
      };
    }

    // We are on a self-hosted install and we have not synced yet
    return {
      statusMessage: this.i18nService.t("requested"),
      statusClass: "tw-text-success",
    };
  }
}
