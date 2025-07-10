// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import {
  AUTOFILL_CARD_ID,
  AUTOFILL_ID,
  AUTOFILL_IDENTITY_ID,
  COPY_IDENTIFIER_ID,
  COPY_PASSWORD_ID,
  COPY_USERNAME_ID,
  COPY_VERIFICATION_CODE_ID,
  CREATE_CARD_ID,
  CREATE_IDENTITY_ID,
  CREATE_LOGIN_ID,
  ExtensionCommand,
  GENERATE_PASSWORD_ID,
  NOOP_COMMAND_SUFFIX,
} from "@bitwarden/common/autofill/constants";
import { EventType } from "@bitwarden/common/enums";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { openUnlockPopout } from "../../auth/popup/utils/auth-popout-window";
import { BrowserApi } from "../../platform/browser/browser-api";
// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import {
  openAddEditVaultItemPopout,
  openVaultItemPasswordRepromptPopout,
} from "../../vault/popup/utils/vault-popout-window";
import { LockedVaultPendingNotificationsData } from "../background/abstractions/notification.background";
import { AutofillCipherTypeId } from "../types";

export type CopyToClipboardOptions = { text: string; tab: chrome.tabs.Tab };
export type CopyToClipboardAction = (options: CopyToClipboardOptions) => void;
export type AutofillAction = (tab: chrome.tabs.Tab, cipher: CipherView) => Promise<void>;

export type GeneratePasswordToClipboardAction = (tab: chrome.tabs.Tab) => Promise<void>;

export class ContextMenuClickedHandler {
  constructor(
    private copyToClipboard: CopyToClipboardAction,
    private generatePasswordToClipboard: GeneratePasswordToClipboardAction,
    private autofillAction: AutofillAction,
    private authService: AuthService,
    private cipherService: CipherService,
    private totpService: TotpService,
    private eventCollectionService: EventCollectionService,
    private userVerificationService: UserVerificationService,
    private accountService: AccountService,
  ) {}

  async run(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
    if (!tab) {
      return;
    }

    switch (info.menuItemId) {
      case GENERATE_PASSWORD_ID:
        await this.generatePasswordToClipboard(tab);
        break;
      case COPY_IDENTIFIER_ID:
        this.copyToClipboard({ text: await this.getIdentifier(tab, info), tab: tab });
        break;
      default:
        await this.cipherAction(info, tab);
    }
  }

  async cipherAction(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
    if (!tab) {
      return;
    }

    if ((await this.authService.getAuthStatus()) < AuthenticationStatus.Unlocked) {
      const retryMessage: LockedVaultPendingNotificationsData = {
        commandToRetry: {
          message: { command: ExtensionCommand.NoopCommand, contextMenuOnClickData: info },
          sender: { tab: tab },
        },
        target: "contextmenus.background",
      };
      await BrowserApi.tabSendMessageData(
        tab,
        "addToLockedVaultPendingNotifications",
        retryMessage,
      );

      await openUnlockPopout(tab);
      return;
    }

    // NOTE: We don't actually use the first part of this ID, we further switch based on the parentMenuItemId
    // I would really love to not add it but that is a departure from how it currently works.
    const menuItemId = (info.menuItemId as string).split("_")[1]; // We create all the ids, we can guarantee they are strings
    let cipher: CipherView | undefined;
    const isCreateCipherAction = [CREATE_LOGIN_ID, CREATE_IDENTITY_ID, CREATE_CARD_ID].includes(
      menuItemId as string,
    );

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    if (activeUserId == null) {
      return;
    }

    if (isCreateCipherAction) {
      // pass; defer to logic below
    } else if (menuItemId === NOOP_COMMAND_SUFFIX) {
      const additionalCiphersToGet =
        info.parentMenuItemId === AUTOFILL_IDENTITY_ID
          ? [CipherType.Identity]
          : info.parentMenuItemId === AUTOFILL_CARD_ID
            ? [CipherType.Card]
            : [];

      // This NOOP item has come through which is generally only for no access state but since we got here
      // we are actually unlocked we will do our best to find a good match of an item to autofill this is useful
      // in scenarios like unlock on autofill
      const ciphers = await this.cipherService.getAllDecryptedForUrl(
        tab.url,
        activeUserId,
        additionalCiphersToGet,
      );

      cipher = ciphers[0];
    } else {
      const ciphers = await this.cipherService.getAllDecrypted(activeUserId);
      cipher = ciphers.find(({ id }) => id === menuItemId);
    }

    if (!cipher && !isCreateCipherAction) {
      return;
    }

    await this.accountService.setAccountActivity(activeUserId, new Date());
    switch (info.parentMenuItemId) {
      case AUTOFILL_ID:
      case AUTOFILL_IDENTITY_ID:
      case AUTOFILL_CARD_ID: {
        const cipherType = this.getCipherCreationType(menuItemId);

        if (cipherType) {
          await openAddEditVaultItemPopout(tab, { cipherType });
          break;
        }

        if (await this.isPasswordRepromptRequired(cipher)) {
          await openVaultItemPasswordRepromptPopout(tab, {
            cipherId: cipher.id,
            // The action here is passed on to the single-use reprompt window and doesn't change based on cipher type
            action: AUTOFILL_ID,
          });
        } else {
          await this.autofillAction(tab, cipher);
        }

        break;
      }
      case COPY_USERNAME_ID:
        if (menuItemId === CREATE_LOGIN_ID) {
          await openAddEditVaultItemPopout(tab, { cipherType: CipherType.Login });
          break;
        }

        this.copyToClipboard({ text: cipher.login.username, tab: tab });
        break;
      case COPY_PASSWORD_ID:
        if (menuItemId === CREATE_LOGIN_ID) {
          await openAddEditVaultItemPopout(tab, { cipherType: CipherType.Login });
          break;
        }

        if (await this.isPasswordRepromptRequired(cipher)) {
          await openVaultItemPasswordRepromptPopout(tab, {
            cipherId: cipher.id,
            action: COPY_PASSWORD_ID,
          });
        } else {
          this.copyToClipboard({ text: cipher.login.password, tab: tab });
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.eventCollectionService.collect(EventType.Cipher_ClientCopiedPassword, cipher.id);
        }

        break;
      case COPY_VERIFICATION_CODE_ID:
        if (menuItemId === CREATE_LOGIN_ID) {
          await openAddEditVaultItemPopout(tab, { cipherType: CipherType.Login });
          break;
        }

        if (await this.isPasswordRepromptRequired(cipher)) {
          await openVaultItemPasswordRepromptPopout(tab, {
            cipherId: cipher.id,
            action: COPY_VERIFICATION_CODE_ID,
          });
        } else {
          const totpResponse = await firstValueFrom(this.totpService.getCode$(cipher.login.totp));
          this.copyToClipboard({
            text: totpResponse.code,
            tab: tab,
          });
        }

        break;
    }
  }

  private async isPasswordRepromptRequired(cipher: CipherView): Promise<boolean> {
    return (
      cipher.reprompt === CipherRepromptType.Password &&
      (await this.userVerificationService.hasMasterPasswordAndMasterKeyHash())
    );
  }

  private getCipherCreationType(menuItemId?: string): AutofillCipherTypeId | null {
    return menuItemId === CREATE_IDENTITY_ID
      ? CipherType.Identity
      : menuItemId === CREATE_CARD_ID
        ? CipherType.Card
        : menuItemId === CREATE_LOGIN_ID
          ? CipherType.Login
          : null;
  }

  private async getIdentifier(tab: chrome.tabs.Tab, info: chrome.contextMenus.OnClickData) {
    return new Promise<string>((resolve, reject) => {
      BrowserApi.sendTabsMessage(
        tab.id,
        { command: "getClickedElement" },
        { frameId: info.frameId },
        (identifier: string) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          resolve(identifier);
        },
      );
    });
  }
}
