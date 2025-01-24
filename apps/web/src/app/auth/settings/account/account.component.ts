// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { combineLatest, firstValueFrom, from, lastValueFrom, map, Observable } from "rxjs";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { DialogService } from "@bitwarden/components";

import { PurgeVaultComponent } from "../../../vault/settings/purge-vault.component";

import { DeauthorizeSessionsComponent } from "./deauthorize-sessions.component";
import { DeleteAccountDialogComponent } from "./delete-account-dialog.component";

@Component({
  selector: "app-account",
  templateUrl: "account.component.html",
})
export class AccountComponent implements OnInit {
  @ViewChild("deauthorizeSessionsTemplate", { read: ViewContainerRef, static: true })
  deauthModalRef: ViewContainerRef;

  showChangeEmail$: Observable<boolean>;
  showPurgeVault$: Observable<boolean>;
  showDeleteAccount$: Observable<boolean>;

  constructor(
    private modalService: ModalService,
    private dialogService: DialogService,
    private userVerificationService: UserVerificationService,
    private configService: ConfigService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    const isAccountDeprovisioningEnabled$ = this.configService.getFeatureFlag$(
      FeatureFlag.AccountDeprovisioning,
    );

    const userIsManagedByOrganization$ = this.organizationService
      .organizations$(userId)
      .pipe(
        map((organizations) => organizations.some((o) => o.userIsManagedByOrganization === true)),
      );

    const hasMasterPassword$ = from(this.userVerificationService.hasMasterPassword());

    this.showChangeEmail$ = combineLatest([
      hasMasterPassword$,
      isAccountDeprovisioningEnabled$,
      userIsManagedByOrganization$,
    ]).pipe(
      map(
        ([hasMasterPassword, isAccountDeprovisioningEnabled, userIsManagedByOrganization]) =>
          hasMasterPassword && (!isAccountDeprovisioningEnabled || !userIsManagedByOrganization),
      ),
    );

    this.showPurgeVault$ = combineLatest([
      isAccountDeprovisioningEnabled$,
      userIsManagedByOrganization$,
    ]).pipe(
      map(
        ([isAccountDeprovisioningEnabled, userIsManagedByOrganization]) =>
          !isAccountDeprovisioningEnabled || !userIsManagedByOrganization,
      ),
    );

    this.showDeleteAccount$ = combineLatest([
      isAccountDeprovisioningEnabled$,
      userIsManagedByOrganization$,
    ]).pipe(
      map(
        ([isAccountDeprovisioningEnabled, userIsManagedByOrganization]) =>
          !isAccountDeprovisioningEnabled || !userIsManagedByOrganization,
      ),
    );
  }

  async deauthorizeSessions() {
    await this.modalService.openViewRef(DeauthorizeSessionsComponent, this.deauthModalRef);
  }

  purgeVault = async () => {
    const dialogRef = PurgeVaultComponent.open(this.dialogService);
    await lastValueFrom(dialogRef.closed);
  };

  deleteAccount = async () => {
    const dialogRef = DeleteAccountDialogComponent.open(this.dialogService);
    await lastValueFrom(dialogRef.closed);
  };
}
