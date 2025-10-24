// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import {
  AUTOFILL_CARD_ID,
  AUTOFILL_ID,
  AUTOFILL_IDENTITY_ID,
  COPY_IDENTIFIER_ID,
  COPY_ELEMENT_PATH_ID,
  COPY_PASSWORD_ID,
  COPY_USERNAME_ID,
  COPY_VERIFICATION_CODE_ID,
  CREATE_CARD_ID,
  CREATE_IDENTITY_ID,
  CREATE_LOGIN_ID,
  GENERATE_PASSWORD_ID,
  NOOP_COMMAND_SUFFIX,
  ROOT_ID,
  SEPARATOR_ID,
} from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";

import { InitContextMenuItems } from "./abstractions/main-context-menu-handler";

export class MainContextMenuHandler {
  static existingMenuItems: Set<string> = new Set();
  initRunning = false;
  private initContextMenuItems: InitContextMenuItems[] = [
    {
      id: ROOT_ID,
      title: "Bitwarden",
    },
    {
      id: AUTOFILL_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("autoFillLogin"),
      requiresUnblockedUri: true,
    },
    {
      id: COPY_USERNAME_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("copyUsername"),
    },
    {
      id: COPY_PASSWORD_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("copyPassword"),
    },
    {
      id: COPY_VERIFICATION_CODE_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("copyVerificationCode"),
      requiresPremiumAccess: true,
    },
    {
      id: SEPARATOR_ID + 1,
      type: "separator",
      parentId: ROOT_ID,
    },
    {
      id: AUTOFILL_IDENTITY_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("autoFillIdentity"),
      requiresUnblockedUri: true,
    },
    {
      id: AUTOFILL_CARD_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("autoFillCard"),
      requiresUnblockedUri: true,
    },
    {
      id: SEPARATOR_ID + 2,
      type: "separator",
      parentId: ROOT_ID,
      requiresUnblockedUri: true,
    },
    {
      id: GENERATE_PASSWORD_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("generatePasswordCopied"),
    },
    {
      id: COPY_IDENTIFIER_ID,
      parentId: ROOT_ID,
      title: this.i18nService.t("copyElementIdentifier"),
      requiresUnblockedUri: true,
    },
    {
      id: COPY_ELEMENT_PATH_ID,
      parentId: ROOT_ID,
      title: "Copy element path",
      requiresUnblockedUri: true,
    },
  ];
  private noCardsContextMenuItems: chrome.contextMenus.CreateProperties[] = [
    {
      id: `${AUTOFILL_CARD_ID}_NOTICE`,
      enabled: false,
      parentId: AUTOFILL_CARD_ID,
      title: this.i18nService.t("noCards"),
      type: "normal",
    },
    {
      id: `${AUTOFILL_CARD_ID}_${SEPARATOR_ID}`,
      parentId: AUTOFILL_CARD_ID,
      type: "separator",
    },
    {
      id: `${AUTOFILL_CARD_ID}_${CREATE_CARD_ID}`,
      parentId: AUTOFILL_CARD_ID,
      title: this.i18nService.t("addCardMenu"),
      type: "normal",
    },
  ];
  private noIdentitiesContextMenuItems: chrome.contextMenus.CreateProperties[] = [
    {
      id: `${AUTOFILL_IDENTITY_ID}_NOTICE`,
      enabled: false,
      parentId: AUTOFILL_IDENTITY_ID,
      title: this.i18nService.t("noIdentities"),
      type: "normal",
    },
    {
      id: `${AUTOFILL_IDENTITY_ID}_${SEPARATOR_ID}`,
      parentId: AUTOFILL_IDENTITY_ID,
      type: "separator",
    },
    {
      id: `${AUTOFILL_IDENTITY_ID}_${CREATE_IDENTITY_ID}`,
      parentId: AUTOFILL_IDENTITY_ID,
      title: this.i18nService.t("addIdentityMenu"),
      type: "normal",
    },
  ];
  private noLoginsContextMenuItems: chrome.contextMenus.CreateProperties[] = [
    {
      id: `${AUTOFILL_ID}_NOTICE`,
      enabled: false,
      parentId: AUTOFILL_ID,
      title: this.i18nService.t("noMatchingLogins"),
      type: "normal",
    },
    {
      id: `${AUTOFILL_ID}_${SEPARATOR_ID}1`,
      parentId: AUTOFILL_ID,
      type: "separator",
    },
  ];

  constructor(
    private tokenService: TokenService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private i18nService: I18nService,
    private logService: LogService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
    private restrictedItemTypesService: RestrictedItemTypesService,
  ) {}

  /**
   *
   * @returns a boolean showing whether or not items were created
   */
  async init(): Promise<boolean> {
    const menuEnabled = await firstValueFrom(this.autofillSettingsService.enableContextMenu$);
    if (!menuEnabled) {
      await MainContextMenuHandler.removeAll();
      return false;
    }

    if (this.initRunning) {
      return true;
    }
    this.initRunning = true;

    try {
      const account = await firstValueFrom(this.accountService.activeAccount$);
      const hasPremium = await firstValueFrom(
        this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
      );

      const isCardRestricted = (
        await firstValueFrom(this.restrictedItemTypesService.restricted$)
      ).some((rt) => rt.cipherType === CipherType.Card);

      for (const menuItem of this.initContextMenuItems) {
        const {
          requiresPremiumAccess,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          requiresUnblockedUri, // destructuring this out of being passed to `create`
          ...otherOptions
        } = menuItem;

        if (requiresPremiumAccess && !hasPremium) {
          continue;
        }
        if (menuItem.id.startsWith(AUTOFILL_CARD_ID) && isCardRestricted) {
          continue;
        }

        await MainContextMenuHandler.create({ ...otherOptions, contexts: ["all"] });
      }
    } catch (error) {
      this.logService.warning(error.message);
    } finally {
      this.initRunning = false;
    }
    return true;
  }

  /**
   * Creates a context menu item
   *
   * @param options - the options for the context menu item
   */
  private static create = async (options: chrome.contextMenus.CreateProperties) => {
    if (!chrome.contextMenus) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const itemId = chrome.contextMenus.create(options, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve();
      });

      this.existingMenuItems.add(`${itemId}`);

      return itemId;
    });
  };

  static async removeAll() {
    return new Promise<void>((resolve, reject) => {
      chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        resolve();
      });

      this.existingMenuItems = new Set();

      return;
    });
  }

  static remove(menuItemId: string) {
    return new Promise<void>((resolve, reject) => {
      const itemId = chrome.contextMenus.remove(menuItemId, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        resolve();
      });

      this.existingMenuItems.delete(`${itemId}`);

      return;
    });
  }

  async loadOptions(title: string, optionId: string, cipher?: CipherView) {
    try {
      const sanitizedTitle = MainContextMenuHandler.sanitizeContextMenuTitle(title);

      const createChildItem = async (parentId: string) => {
        const menuItemId = `${parentId}_${optionId}`;

        const itemAlreadyExists = MainContextMenuHandler.existingMenuItems.has(menuItemId);
        if (itemAlreadyExists) {
          return;
        }

        return await MainContextMenuHandler.create({
          type: "normal",
          id: menuItemId,
          parentId,
          title: sanitizedTitle,
          contexts: ["all"],
        });
      };

      if (
        !cipher ||
        (cipher.type === CipherType.Login &&
          (!Utils.isNullOrEmpty(cipher.login?.username) ||
            !Utils.isNullOrEmpty(cipher.login?.password) ||
            !Utils.isNullOrEmpty(cipher.login?.totp)))
      ) {
        await createChildItem(AUTOFILL_ID);
      }

      if (
        !cipher ||
        (cipher.type === CipherType.Login && !Utils.isNullOrEmpty(cipher.login?.password))
      ) {
        if (cipher?.viewPassword ?? true) {
          await createChildItem(COPY_PASSWORD_ID);
        }
      }

      if (
        !cipher ||
        (cipher.type === CipherType.Login && !Utils.isNullOrEmpty(cipher.login?.username))
      ) {
        await createChildItem(COPY_USERNAME_ID);
      }

      const account = await firstValueFrom(this.accountService.activeAccount$);
      const canAccessPremium = await firstValueFrom(
        this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
      );
      if (canAccessPremium && (!cipher || !Utils.isNullOrEmpty(cipher.login?.totp))) {
        await createChildItem(COPY_VERIFICATION_CODE_ID);
      }

      if ((!cipher || cipher.type === CipherType.Card) && optionId !== CREATE_LOGIN_ID) {
        await createChildItem(AUTOFILL_CARD_ID);
      }

      if ((!cipher || cipher.type === CipherType.Identity) && optionId !== CREATE_LOGIN_ID) {
        await createChildItem(AUTOFILL_IDENTITY_ID);
      }
    } catch (error) {
      this.logService.warning(error.message);
    }
  }

  static sanitizeContextMenuTitle(title: string): string {
    return title.replace(/&/g, "&&");
  }

  async noAccess() {
    if (await this.init()) {
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      const authed =
        userId != null && (await firstValueFrom(this.tokenService.hasAccessToken$(userId)));
      this.loadOptions(
        this.i18nService.t(authed ? "unlockVaultMenu" : "loginToVaultMenu"),
        NOOP_COMMAND_SUFFIX,
      ).catch((error) => this.logService.warning(error.message));
    }
  }

  async removeBlockedUriMenuItems() {
    try {
      for (const menuItem of this.initContextMenuItems) {
        if (menuItem.requiresUnblockedUri && menuItem.id) {
          await MainContextMenuHandler.remove(menuItem.id);
        }
      }
    } catch (error) {
      this.logService.warning(error.message);
    }
  }

  async noCards() {
    try {
      for (const menuItem of this.noCardsContextMenuItems) {
        await MainContextMenuHandler.create(menuItem);
      }
    } catch (error) {
      this.logService.warning(error.message);
    }
  }

  async noIdentities() {
    try {
      for (const menuItem of this.noIdentitiesContextMenuItems) {
        await MainContextMenuHandler.create(menuItem);
      }
    } catch (error) {
      this.logService.warning(error.message);
    }
  }

  async noLogins() {
    try {
      for (const menuItem of this.noLoginsContextMenuItems) {
        await MainContextMenuHandler.create(menuItem);
      }

      await this.loadOptions(this.i18nService.t("addLoginMenu"), CREATE_LOGIN_ID);
    } catch (error) {
      this.logService.warning(error.message);
    }
  }
}
