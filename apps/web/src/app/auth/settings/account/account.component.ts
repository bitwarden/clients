import { Component, OnInit, OnDestroy } from "@angular/core";
import {
  combineLatest,
  firstValueFrom,
  from,
  lastValueFrom,
  map,
  Observable,
  Subject,
  takeUntil,
} from "rxjs";

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
import { SetAccountVerifyDevicesDialogComponent } from "./set-account-verify-devices-dialog.component";

@Component({
  selector: "app-account",
  templateUrl: "account.component.html",
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

    const isAccountDeprovisioningEnabled$ = this.configService.getFeatureFlag$(
      FeatureFlag.AccountDeprovisioning,
    );

    const userIsManagedByOrganization$ = this.organizationService
      .organizations$(userId)
      .pipe(
        map((organizations) => organizations.some((o) => o.userIsManagedByOrganization === true)),
      );

    const hasMasterPassword$ = from(this.userVerificationService.hasMasterPassword());

    this.showChangeEmail$ = hasMasterPassword$;

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
