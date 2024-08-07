import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Subject, concatMap, firstValueFrom, map, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { UserId } from "@bitwarden/common/types/guid";
import { AsyncActionsModule, ButtonModule, FormFieldModule } from "@bitwarden/components";

import { PinService } from "../../common";

@Component({
  selector: "bit-lock",
  templateUrl: "lock.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, ButtonModule, FormFieldModule, AsyncActionsModule],
})
export class LockV2Component implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private activeUserId: UserId;

  pinEnabled = false;
  masterPasswordEnabled = false;
  supportsBiometric: boolean;
  biometricLock: boolean;

  email: string;

  webVaultHostname = "";

  constructor(
    private accountService: AccountService,
    private authService: AuthService,
    private vaultTimeoutService: VaultTimeoutService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private pinService: PinService,
    private userVerificationService: UserVerificationService,
    private cryptoService: CryptoService,
    private platformUtilsService: PlatformUtilsService,
    private environmentService: EnvironmentService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.accountService.activeAccount$
      .pipe(
        // TODO: eval if concatMap is the right operator here; what about switchMap?
        // Does order of processing matter here?
        concatMap(async (account) => {
          // TODO: it will be cleaner to just load the active account
          this.activeUserId = account?.id;
          await this.load(account?.id);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  private async load(userId: UserId) {
    this.pinEnabled = await this.pinService.isPinDecryptionAvailable(userId);

    this.masterPasswordEnabled = await this.userVerificationService.hasMasterPassword();

    this.supportsBiometric = await this.platformUtilsService.supportsBiometric();
    this.biometricLock =
      (await this.vaultTimeoutSettingsService.isBiometricLockSet()) &&
      ((await this.cryptoService.hasUserKeyStored(KeySuffixOptions.Biometric)) ||
        !this.platformUtilsService.supportsSecureStorage());
    this.email = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.email)),
    );

    this.webVaultHostname = (await this.environmentService.getEnvironment()).getHostname();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
