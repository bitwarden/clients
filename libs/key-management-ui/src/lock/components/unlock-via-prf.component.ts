import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { AsyncActionsModule, ButtonModule, DialogService } from "@bitwarden/components";

import { WebAuthnPrfUnlockService } from "../services/webauthn-prf-unlock.service";

@Component({
  selector: "bit-unlock-via-prf",
  standalone: true,
  imports: [CommonModule, JslibModule, ButtonModule, AsyncActionsModule],
  template: `
    @if (isAvailable) {
      @if (formButton) {
        <button
          type="button"
          bitButton
          bitFormButton
          buttonType="secondary"
          block
          (click)="unlockViaPrf()"
          [disabled]="unlocking"
          [loading]="unlocking"
        >
          <i class="bwi bwi-passkey tw-mr-1" aria-hidden="true"></i>
          {{ "unlockWithPasskey" | i18n }}
        </button>
      }
      @if (!formButton) {
        <button
          type="button"
          bitButton
          buttonType="secondary"
          block
          (click)="unlockViaPrf()"
          [disabled]="unlocking"
          [loading]="unlocking"
        >
          <i class="bwi bwi-passkey tw-mr-1" aria-hidden="true"></i>
          {{ "unlockWithPasskey" | i18n }}
        </button>
      }
    }
  `,
})
export class UnlockViaPrfComponent implements OnInit {
  @Input() formButton = false;
  @Output() unlockSuccess = new EventEmitter<UserKey>();

  unlocking = false;
  isAvailable = false;
  private userId: UserId | null = null;

  constructor(
    private accountService: AccountService,
    private webAuthnPrfUnlockService: WebAuthnPrfUnlockService,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private logService: LogService,
  ) {}

  async ngOnInit(): Promise<void> {
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (activeAccount?.id) {
      this.userId = activeAccount.id;
      this.isAvailable = await this.webAuthnPrfUnlockService.isPrfUnlockAvailable(this.userId);
    }
  }

  async unlockViaPrf(): Promise<void> {
    if (!this.userId || !this.isAvailable) {
      return;
    }

    this.unlocking = true;

    try {
      const userKey = await this.webAuthnPrfUnlockService.unlockVaultWithPrf(this.userId);
      this.unlockSuccess.emit(userKey);
    } catch (error) {
      this.logService.error("[UnlockViaPrfComponent] Failed to unlock via PRF:", error);

      let errorMessage = this.i18nService.t("unexpectedError");

      // Handle specific PRF error cases
      if (error instanceof Error) {
        if (error.message.includes("No PRF credentials")) {
          errorMessage = this.i18nService.t("noPrfCredentialsAvailable");
        } else if (error.message.includes("canceled")) {
          // User canceled the operation, don't show error
          this.unlocking = false;
          return;
        }
      }

      await this.dialogService.openSimpleDialog({
        title: { key: "error" },
        content: errorMessage,
        acceptButtonText: { key: "ok" },
        type: "danger",
      });
    } finally {
      this.unlocking = false;
    }
  }
}
