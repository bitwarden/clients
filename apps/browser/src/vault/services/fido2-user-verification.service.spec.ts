import { MockProxy, mock } from "jest-mock-extended";

import { UserVerificationDialogComponent } from "@bitwarden/auth/angular";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { SetPinComponent } from "./../../auth/popup/components/set-pin.component";
import { Fido2UserVerificationService } from "./fido2-user-verification.service";

jest.mock("@bitwarden/auth/angular", () => ({
  UserVerificationDialogComponent: {
    open: jest.fn().mockResolvedValue({ userAction: "confirm", verificationSuccess: true }),
  },
}));

jest.mock("../../auth/popup/components/set-pin.component", () => {
  return {
    SetPinComponent: {
      open: jest.fn(),
    },
  };
});

describe("Fido2UserVerificationService", () => {
  let fido2UserVerificationService: Fido2UserVerificationService;

  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let userVerificationService: MockProxy<UserVerificationService>;
  let dialogService: MockProxy<DialogService>;
  let cipher: CipherView;

  beforeEach(() => {
    passwordRepromptService = mock<PasswordRepromptService>();
    userVerificationService = mock<UserVerificationService>();
    dialogService = mock<DialogService>();

    cipher = createCipherView();

    fido2UserVerificationService = new Fido2UserVerificationService(
      passwordRepromptService,
      userVerificationService,
      dialogService,
    );

    (UserVerificationDialogComponent.open as jest.Mock).mockResolvedValue({
      userAction: "confirm",
      verificationSuccess: true,
    });
  });

  describe("handleUserVerification", () => {
    describe("user verification requested is true", () => {
      it("should return true if user is redirected from lock screen and master password reprompt is not required", async () => {
        const result = await fido2UserVerificationService.handleUserVerification(
          true,
          cipher,
          true,
        );
        expect(result).toBe(true);
      });

      it("should call master password reprompt dialog if user is redirected from lock screen, has master password and master password reprompt is required", async () => {
        cipher.reprompt = CipherRepromptType.Password;
        userVerificationService.hasMasterPassword.mockResolvedValue(true);
        passwordRepromptService.showPasswordPrompt.mockResolvedValue(true);

        const result = await fido2UserVerificationService.handleUserVerification(
          true,
          cipher,
          true,
        );

        expect(passwordRepromptService.showPasswordPrompt).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it("should call user verification dialog if user is redirected from lock screen, does not have a master password and master password reprompt is required", async () => {
        cipher.reprompt = CipherRepromptType.Password;
        userVerificationService.hasMasterPassword.mockResolvedValue(false);

        const result = await fido2UserVerificationService.handleUserVerification(
          true,
          cipher,
          true,
        );

        expect(UserVerificationDialogComponent.open).toHaveBeenCalledWith(dialogService, {
          verificationType: "client",
        });
        expect(result).toBe(true);
      });

      it("should call user verification dialog if user is not redirected from lock screen, does not have a master password and master password reprompt is required", async () => {
        cipher.reprompt = CipherRepromptType.Password;
        userVerificationService.hasMasterPassword.mockResolvedValue(false);

        const result = await fido2UserVerificationService.handleUserVerification(
          true,
          cipher,
          false,
        );

        expect(UserVerificationDialogComponent.open).toHaveBeenCalledWith(dialogService, {
          verificationType: "client",
        });
        expect(result).toBe(true);
      });

      it("should call master password reprompt dialog if user is not redirected from lock screen, has a master password and master password reprompt is required", async () => {
        cipher.reprompt = CipherRepromptType.Password;
        userVerificationService.hasMasterPassword.mockResolvedValue(false);
        passwordRepromptService.showPasswordPrompt.mockResolvedValue(true);

        const result = await fido2UserVerificationService.handleUserVerification(
          true,
          cipher,
          false,
        );

        expect(UserVerificationDialogComponent.open).toHaveBeenCalledWith(dialogService, {
          verificationType: "client",
        });
        expect(result).toBe(true);
      });

      it("should call user verification dialog if user is not redirected from lock screen and no master password reprompt is required", async () => {
        const result = await fido2UserVerificationService.handleUserVerification(
          true,
          cipher,
          false,
        );

        expect(UserVerificationDialogComponent.open).toHaveBeenCalledWith(dialogService, {
          verificationType: "client",
        });
        expect(result).toBe(true);
      });

      it("should prompt user to set pin if user has no verification method", async () => {
        (UserVerificationDialogComponent.open as jest.Mock).mockResolvedValue({
          userAction: "confirm",
          verificationSuccess: false,
          noAvailableClientVerificationMethods: true,
        });

        await fido2UserVerificationService.handleUserVerification(true, cipher, false);

        expect(SetPinComponent.open).toHaveBeenCalledWith(dialogService);
      });
    });

    describe("user verification requested is false", () => {
      it("should return false if user is redirected from lock screen and master password reprompt is not required", async () => {
        const result = await fido2UserVerificationService.handleUserVerification(
          false,
          cipher,
          true,
        );
        expect(result).toBe(false);
      });

      it("should return false if user is not redirected from lock screen and master password reprompt is not required", async () => {
        const result = await fido2UserVerificationService.handleUserVerification(
          false,
          cipher,
          false,
        );
        expect(result).toBe(false);
      });

      it("should call master password reprompt dialog if user is redirected from lock screen, has master password and master password reprompt is required", async () => {
        cipher.reprompt = CipherRepromptType.Password;
        userVerificationService.hasMasterPassword.mockResolvedValue(true);
        passwordRepromptService.showPasswordPrompt.mockResolvedValue(true);

        const result = await fido2UserVerificationService.handleUserVerification(
          false,
          cipher,
          true,
        );

        expect(result).toBe(true);
        expect(passwordRepromptService.showPasswordPrompt).toHaveBeenCalled();
      });

      it("should call user verification dialog if user is redirected from lock screen, does not have a master password and master password reprompt is required", async () => {
        cipher.reprompt = CipherRepromptType.Password;
        userVerificationService.hasMasterPassword.mockResolvedValue(false);

        const result = await fido2UserVerificationService.handleUserVerification(
          false,
          cipher,
          true,
        );

        expect(UserVerificationDialogComponent.open).toHaveBeenCalledWith(dialogService, {
          verificationType: "client",
        });
        expect(result).toBe(true);
      });

      it("should call user verification dialog if user is not redirected from lock screen, does not have a master password and master password reprompt is required", async () => {
        cipher.reprompt = CipherRepromptType.Password;
        userVerificationService.hasMasterPassword.mockResolvedValue(false);

        const result = await fido2UserVerificationService.handleUserVerification(
          false,
          cipher,
          false,
        );

        expect(UserVerificationDialogComponent.open).toHaveBeenCalledWith(dialogService, {
          verificationType: "client",
        });
        expect(result).toBe(true);
      });

      it("should call master password reprompt dialog if user is not redirected from lock screen, has a master password and master password reprompt is required", async () => {
        cipher.reprompt = CipherRepromptType.Password;
        userVerificationService.hasMasterPassword.mockResolvedValue(false);
        passwordRepromptService.showPasswordPrompt.mockResolvedValue(true);

        const result = await fido2UserVerificationService.handleUserVerification(
          false,
          cipher,
          false,
        );

        expect(UserVerificationDialogComponent.open).toHaveBeenCalledWith(dialogService, {
          verificationType: "client",
        });
        expect(result).toBe(true);
      });
    });
  });
});

function createCipherView() {
  const cipher = new CipherView();
  cipher.id = Utils.newGuid();
  cipher.type = CipherType.Login;
  cipher.reprompt = CipherRepromptType.None;
  return cipher;
}
