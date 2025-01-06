import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { ToastService } from "@bitwarden/components";
import { CopyAction, CopyCipherFieldService, PasswordRepromptService } from "@bitwarden/vault";

describe("CopyCipherFieldService", () => {
  let service: CopyCipherFieldService;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let toastService: MockProxy<ToastService>;
  let eventCollectionService: MockProxy<EventCollectionService>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let totpService: MockProxy<TotpService>;
  let i18nService: MockProxy<I18nService>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let accountService: MockProxy<AccountService>;
  const userId = "userId";

  beforeEach(() => {
    platformUtilsService = mock<PlatformUtilsService>();
    toastService = mock<ToastService>();
    eventCollectionService = mock<EventCollectionService>();
    passwordRepromptService = mock<PasswordRepromptService>();
    totpService = mock<TotpService>();
    i18nService = mock<I18nService>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    accountService = mock<AccountService>();

    accountService.activeAccount$ = of({ id: userId } as Account);

    service = new CopyCipherFieldService(
      platformUtilsService,
      toastService,
      eventCollectionService,
      passwordRepromptService,
      totpService,
      i18nService,
      billingAccountProfileStateService,
      accountService,
    );
  });

  describe("copy", () => {
    let cipher: CipherView;
    let valueToCopy: string;
    let actionType: CopyAction;
    let skipReprompt: boolean;

    beforeEach(() => {
      cipher = mock<CipherView>();
      valueToCopy = "test";
      actionType = "username";
      skipReprompt = false;
    });

    it("should return early when valueToCopy is null", async () => {
      valueToCopy = null;
      const result = await service.copy(valueToCopy, actionType, cipher, skipReprompt);
      expect(result).toBeFalsy();
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
    });

    it("should copy value to clipboard", async () => {
      const result = await service.copy(valueToCopy, actionType, cipher, skipReprompt);
      expect(result).toBeTruthy();
      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(valueToCopy);
    });

    it("should show a success toast on copy", async () => {
      i18nService.t.mockReturnValueOnce("Username").mockReturnValueOnce("Username copied");
      const result = await service.copy(valueToCopy, actionType, cipher, skipReprompt);
      expect(result).toBeTruthy();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "Username copied",
        title: "",
      });
      expect(i18nService.t).toHaveBeenCalledWith("username");
      expect(i18nService.t).toHaveBeenCalledWith("valueCopied", "Username");
    });

    describe("password reprompt", () => {
      beforeEach(() => {
        actionType = "password";
        cipher.reprompt = CipherRepromptType.Password;
      });

      it("should show password prompt when actionType requires it", async () => {
        passwordRepromptService.showPasswordPrompt.mockResolvedValue(true);
        const result = await service.copy(valueToCopy, actionType, cipher, skipReprompt);
        expect(result).toBeTruthy();
        expect(passwordRepromptService.showPasswordPrompt).toHaveBeenCalled();
      });

      it("should skip password prompt when cipher.reprompt is 'None'", async () => {
        cipher.reprompt = CipherRepromptType.None;
        const result = await service.copy(valueToCopy, actionType, cipher, skipReprompt);
        expect(result).toBeTruthy();
        expect(passwordRepromptService.showPasswordPrompt).not.toHaveBeenCalled();
        expect(platformUtilsService.copyToClipboard).toHaveBeenCalled();
      });

      it("should skip password prompt when skipReprompt is true", async () => {
        skipReprompt = true;
        const result = await service.copy(valueToCopy, actionType, cipher, skipReprompt);
        expect(result).toBeTruthy();
        expect(passwordRepromptService.showPasswordPrompt).not.toHaveBeenCalled();
      });

      it("should return early when password prompt is not confirmed", async () => {
        passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);
        const result = await service.copy(valueToCopy, actionType, cipher, skipReprompt);
        expect(result).toBeFalsy();
        expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      });
    });

    describe("totp", () => {
      beforeEach(() => {
        actionType = "totp";
        cipher.login = new LoginView();
        cipher.login.totp = "secret-totp";
        cipher.reprompt = CipherRepromptType.None;
        cipher.organizationUseTotp = false;
      });

      it("should get TOTP code when allowed from premium", async () => {
        billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));
        totpService.getCode.mockResolvedValue("123456");
        const result = await service.copy(valueToCopy, actionType, cipher, skipReprompt);
        expect(result).toBeTruthy();
        expect(totpService.getCode).toHaveBeenCalledWith(valueToCopy);
        expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("123456");
        expect(billingAccountProfileStateService.hasPremiumFromAnySource$).toHaveBeenCalledWith(
          userId,
        );
      });

      it("should get TOTP code when allowed from organization", async () => {
        cipher.organizationUseTotp = true;
        totpService.getCode.mockResolvedValue("123456");
        const result = await service.copy(valueToCopy, actionType, cipher, skipReprompt);
        expect(result).toBeTruthy();
        expect(totpService.getCode).toHaveBeenCalledWith(valueToCopy);
        expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("123456");
      });

      it("should return early when the user is not allowed to use TOTP", async () => {
        billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(false));
        const result = await service.copy(valueToCopy, actionType, cipher, skipReprompt);
        expect(result).toBeFalsy();
        expect(totpService.getCode).not.toHaveBeenCalled();
        expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
        expect(billingAccountProfileStateService.hasPremiumFromAnySource$).toHaveBeenCalledWith(
          userId,
        );
      });

      it("should return early when TOTP is not set", async () => {
        cipher.login.totp = null;
        const result = await service.copy(valueToCopy, actionType, cipher, skipReprompt);
        expect(result).toBeFalsy();
        expect(totpService.getCode).not.toHaveBeenCalled();
        expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      });
    });

    it("should collect an event when actionType has one", async () => {
      actionType = "password";
      skipReprompt = true;
      await service.copy(valueToCopy, actionType, cipher, skipReprompt);
      expect(eventCollectionService.collect).toHaveBeenCalledWith(
        EventType.Cipher_ClientCopiedPassword,
        cipher.id,
        false,
        cipher.organizationId,
      );
    });
  });
});
