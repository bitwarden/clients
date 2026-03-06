import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { firstValueFrom, lastValueFrom, map, Observable } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DialogService } from "@bitwarden/components";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";
import { PurgeVaultComponent } from "../../../vault/settings/purge-vault.component";

import { ChangeEmailComponent } from "./change-email.component";
import { DangerZoneComponent } from "./danger-zone.component";
import { DeauthorizeSessionsComponent } from "./deauthorize-sessions.component";
import { DeleteAccountDialogComponent } from "./delete-account-dialog.component";
import { ProfileComponent } from "./profile.component";
import { SetAccountVerifyDevicesDialogComponent } from "./set-account-verify-devices-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "account.component.html",
  imports: [
    SharedModule,
    HeaderModule,
    ProfileComponent,
    ChangeEmailComponent,
    DangerZoneComponent,
  ],
})
export class AccountComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  showChangeEmail$: Observable<boolean> = new Observable();
  showPurgeVault$: Observable<boolean> = new Observable();
  showDeleteAccount$: Observable<boolean> = new Observable();
  verifyNewDeviceLogin: boolean = true;

  constructor(
    private accountService: AccountService,
    private dialogService: DialogService,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private organizationService: OrganizationService,
  ) {}

  async ngOnInit() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    const userIsManagedByOrganization$ = this.organizationService
      .organizations$(userId)
      .pipe(
        map((organizations) => organizations.some((o) => o.userIsManagedByOrganization === true)),
      );

    const hasMasterPassword$ = this.userDecryptionOptionsService.hasMasterPasswordById$(userId);

    this.showChangeEmail$ = hasMasterPassword$;

    this.showPurgeVault$ = userIsManagedByOrganization$.pipe(
      map((userIsManagedByOrganization) => !userIsManagedByOrganization),
    );

    this.showDeleteAccount$ = userIsManagedByOrganization$.pipe(
      map((userIsManagedByOrganization) => !userIsManagedByOrganization),
    );

    this.accountService.accountVerifyNewDeviceLogin$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((verifyDevices) => {
        this.verifyNewDeviceLogin = verifyDevices;
      });
  }

  deauthorizeSessions = async () => {
    const dialogRef = DeauthorizeSessionsComponent.open(this.dialogService);
    await lastValueFrom(dialogRef.closed);
  };

  purgeVault = async () => {
    const dialogRef = PurgeVaultComponent.open(this.dialogService);
    await lastValueFrom(dialogRef.closed);
  };

  deleteAccount = async () => {
    const dialogRef = DeleteAccountDialogComponent.open(this.dialogService);
    await lastValueFrom(dialogRef.closed);
  };

  setNewDeviceLoginProtection = async () => {
    const dialogRef = SetAccountVerifyDevicesDialogComponent.open(this.dialogService);
    await lastValueFrom(dialogRef.closed);
  };
}
