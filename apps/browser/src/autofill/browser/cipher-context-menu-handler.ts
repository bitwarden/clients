import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillCipherTypeId } from "../types";

import { MainContextMenuHandler } from "./main-context-menu-handler";

export class CipherContextMenuHandler {
  constructor(
    private mainContextMenuHandler: MainContextMenuHandler,
    private authService: AuthService,
    private cipherService: CipherService,
    private accountService: AccountService,
  ) {}

  async update(url: string, currentUriIsBlocked: boolean = false) {
    if (this.mainContextMenuHandler.initRunning) {
      return;
    }

    // a
    const authStatus = await this.authService.getAuthStatus();
    await MainContextMenuHandler.removeAll();
    if (authStatus !== AuthenticationStatus.Unlocked) {
      // Should I pass in the auth status or even have two separate methods for this
      // on MainContextMenuHandler
      await this.mainContextMenuHandler.noAccess();
      return;
    }

    const menuEnabled = await this.mainContextMenuHandler.init();
    if (!menuEnabled) {
      return;
    }

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    if (activeUserId == null) {
      return;
    }

    const ciphers = await this.cipherService.getAllDecryptedForUrl(url, activeUserId, [
      CipherType.Card,
      CipherType.Identity,
    ]);
    ciphers.sort((a, b) => this.cipherService.sortCiphersByLastUsedThenName(a, b));

    const groupedCiphers: Record<AutofillCipherTypeId, CipherView[]> = ciphers.reduce(
      (ciphersByType, cipher) => {
        if (!cipher?.type) {
          return ciphersByType;
        }

        const existingCiphersOfType = ciphersByType[cipher.type as AutofillCipherTypeId] || [];

        return {
          ...ciphersByType,
          [cipher.type]: [...existingCiphersOfType, cipher],
        };
      },
      {
        [CipherType.Login]: [],
        [CipherType.Card]: [],
        [CipherType.Identity]: [],
      },
    );

    if (groupedCiphers[CipherType.Login].length === 0) {
      await this.mainContextMenuHandler.noLogins();
    }

    if (groupedCiphers[CipherType.Identity].length === 0) {
      await this.mainContextMenuHandler.noIdentities();
    }

    if (groupedCiphers[CipherType.Card].length === 0) {
      await this.mainContextMenuHandler.noCards();
    }

    for (const cipher of ciphers) {
      await this.updateForCipher(cipher);
    }

    if (currentUriIsBlocked) {
      await this.mainContextMenuHandler.removeBlockedUriMenuItems();
    }
  }

  private async updateForCipher(cipher: CipherView) {
    if (
      cipher == null ||
      !new Set([CipherType.Login, CipherType.Card, CipherType.Identity] as CipherType[]).has(
        cipher.type,
      )
    ) {
      return;
    }

    let title = cipher.name;

    if (cipher.type === CipherType.Login && !Utils.isNullOrEmpty(title) && cipher.login?.username) {
      title += ` (${cipher.login.username})`;
    }

    if (cipher.type === CipherType.Card && cipher.card?.subTitle) {
      title += ` ${cipher.card.subTitle}`;
    }

    await this.mainContextMenuHandler.loadOptions(title, cipher.id, cipher);
  }
}
