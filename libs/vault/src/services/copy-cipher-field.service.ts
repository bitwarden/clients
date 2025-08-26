import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { ToastService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

/**
 * The types of fields that can be copied from a cipher.
 */
export type CopyAction =
  | "username"
  | "password"
  | "totp"
  | "cardNumber"
  | "securityCode"
  | "email"
  | "phone"
  | "address"
  | "secureNote"
  | "hiddenField"
  | "privateKey"
  | "publicKey"
  | "keyFingerprint";

type CopyActionInfo = {
  /**
   * The i18n key for the type of field being copied. Will be used to display a toast message.
   */
  typeI18nKey: string;

  /**
   * Whether the field is protected and requires password re-prompting before being copied.
   */
  protected: boolean;

  /**
   * Optional event to collect when the field is copied.
   */
  event?: EventType;
};

const CopyActions: Record<CopyAction, CopyActionInfo> = {
  username: { typeI18nKey: "username", protected: false },
  password: {
    typeI18nKey: "password",
    protected: true,
    event: EventType.Cipher_ClientCopiedPassword,
  },
  totp: { typeI18nKey: "verificationCodeTotp", protected: true },
  cardNumber: { typeI18nKey: "number", protected: true },
  securityCode: {
    typeI18nKey: "securityCode",
    protected: true,
    event: EventType.Cipher_ClientCopiedCardCode,
  },
  email: { typeI18nKey: "email", protected: true },
  phone: { typeI18nKey: "phone", protected: true },
  address: { typeI18nKey: "address", protected: true },
  secureNote: { typeI18nKey: "note", protected: true },
  privateKey: { typeI18nKey: "sshPrivateKey", protected: true },
  publicKey: { typeI18nKey: "sshPublicKey", protected: true },
  keyFingerprint: { typeI18nKey: "sshFingerprint", protected: true },
  hiddenField: {
    typeI18nKey: "value",
    protected: true,
    event: EventType.Cipher_ClientCopiedHiddenField,
  },
};

@Injectable({
  providedIn: "root",
})
export class CopyCipherFieldService {
  constructor(
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private eventCollectionService: EventCollectionService,
    private passwordRepromptService: PasswordRepromptService,
    private totpService: TotpService,
    private i18nService: I18nService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private accountService: AccountService,
  ) {}

  /**
   * Copy a field value from a cipher to the clipboard.
   * @param valueToCopy The value to copy.
   * @param actionType The type of field being copied.
   * @param cipher The cipher containing the field to copy.
   * @param skipReprompt Whether to skip password re-prompting.
   *
   * @returns Whether the field was copied successfully.
   */
  async copy(
    valueToCopy: string,
    actionType: CopyAction,
    cipher: CipherViewLike,
    skipReprompt: boolean = false,
  ): Promise<boolean> {
    const action = CopyActions[actionType];
    if (
      !skipReprompt &&
      cipher.reprompt !== CipherRepromptType.None &&
      action.protected &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      return false;
    }

    if (valueToCopy == null) {
      return false;
    }

    if (actionType === "totp") {
      if (!(await this.totpAllowed(cipher))) {
        return false;
      }
      const totpResponse = await firstValueFrom(this.totpService.getCode$(valueToCopy));
      if (!totpResponse?.code) {
        return false;
      }
      valueToCopy = totpResponse.code;
    }

    this.platformUtilsService.copyToClipboard(valueToCopy);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("valueCopied", this.i18nService.t(action.typeI18nKey)),
      title: "",
    });

    if (action.event !== undefined) {
      await this.eventCollectionService.collect(
        action.event,
        cipher.id as string,
        false,
        cipher.organizationId as string,
      );
    }

    return true;
  }

  /**
   * Determines if TOTP generation is allowed for a cipher and user.
   */
  async totpAllowed(cipher: CipherViewLike): Promise<boolean> {
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (!activeAccount?.id) {
      return false;
    }

    const login = CipherViewLikeUtils.getLogin(cipher);

    return (
      !!login?.totp &&
      (cipher.organizationUseTotp ||
        (await firstValueFrom(
          this.billingAccountProfileStateService.hasPremiumFromAnySource$(activeAccount.id),
        )))
    );
  }
}
