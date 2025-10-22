import { Component, OnInit, OnDestroy } from "@angular/core";
import { firstValueFrom, from, lastValueFrom, map, Observable, Subject, takeUntil } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
export class AccountComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  showChangeEmail$: Observable<boolean> = new Observable();
  showPurgeVault$: Observable<boolean> = new Observable();
  showDeleteAccount$: Observable<boolean> = new Observable();
  verifyNewDeviceLogin: boolean = true;

  constructor(
    private accountService: AccountService,
    private dialogService: DialogService,
    private userVerificationService: UserVerificationService,
    private configService: ConfigService,
    private organizationService: OrganizationService,
  ) {}

  async ngOnInit() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    const userIsManagedByOrganization$ = this.organizationService
      .organizations$(userId)
      .pipe(
        map((organizations) => organizations.some((o) => o.userIsManagedByOrganization === true)),
      );

    const hasMasterPassword$ = from(this.userVerificationService.hasMasterPassword());

    this.showChangeEmail$ = hasMasterPassword$;

    this.showPurgeVault$ = userIsManagedByOrganization$.pipe(
      map((userIsManagedByOrganization) => !userIsManagedByOrganization),
    );

    this.showDeleteAccount$ = userIsManagedByOrganization$.pipe(
      map((userIsManagedByOrganization) => !userIsManagedByOrganization),
    );

    this.accountService.accountVerifyNewDeviceLogin$
      .pipe(takeUntil(this.destroy$))
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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
