import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { MasterPasswordSalt } from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
// eslint-disable-next-line no-restricted-imports
import { DEFAULT_KDF_CONFIG } from "@bitwarden/legacy-crypto";

import { PasswordInputResult } from "../../input-password/password-input-result";

import { DefaultRegistrationFinishService } from "./default-registration-finish.service";

describe("DefaultRegistrationFinishService", () => {
  let service: DefaultRegistrationFinishService;

  let sdkService: MockProxy<SdkService>;

  beforeEach(() => {
    sdkService = mock<SdkService>();

    service = new DefaultRegistrationFinishService(sdkService);
  });

  it("instantiates", () => {
    expect(service).not.toBeFalsy();
  });

  describe("finishRegistration()", () => {
    let email: string;
    let emailVerificationToken: string;
    let salesAssistedToken: string;
    let salt: MasterPasswordSalt;
    let passwordInputResult: PasswordInputResult;

    let postKeysForUserPasswordRegistration: jest.Mock;
    let registrationClient: { post_keys_for_user_password_registration: jest.Mock };
    let authClient: { registration: jest.Mock };
    let sdkClient: { auth: jest.Mock };

    // web-only tokens/ids exercised by the SDK register request
    const orgSponsoredFreeFamilyPlanToken = "orgSponsoredFreeFamilyPlanToken";
    const acceptEmergencyAccessInviteToken = "acceptEmergencyAccessInviteToken";
    const emergencyAccessId = "00000000-0000-0000-0000-000000000001";
    const providerInviteToken = "providerInviteToken";
    const providerUserId = "00000000-0000-0000-0000-000000000002";

    beforeEach(() => {
      email = "test@email.com";
      emailVerificationToken = "emailVerificationToken";
      salesAssistedToken = "salesAssistedToken";
      salt = "test@email.com" as MasterPasswordSalt;

      passwordInputResult = {
        newPassword: "newPassword",
        kdfConfig: DEFAULT_KDF_CONFIG,
        newPasswordHint: "newPasswordHint",
        salt: salt,
      };

      postKeysForUserPasswordRegistration = jest.fn().mockResolvedValue(undefined);
      registrationClient = {
        post_keys_for_user_password_registration: postKeysForUserPasswordRegistration,
      };
      authClient = { registration: jest.fn().mockReturnValue(registrationClient) };
      sdkClient = { auth: jest.fn().mockReturnValue(authClient) };

      sdkService.client$ = of(sdkClient as any);
    });

    ["newPassword", "salt"].forEach((key) => {
      it(`should throw if ${key} is an empty string (falsy) on the PasswordInputResult object`, async () => {
        const invalidPasswordInputResult: PasswordInputResult = {
          ...passwordInputResult,
          [key]: "",
        };

        const promise = service.finishRegistration(email, invalidPasswordInputResult);

        await expect(promise).rejects.toThrow(`${key} is falsy. Could not finish registration.`);
        expect(postKeysForUserPasswordRegistration).not.toHaveBeenCalled();
      });
    });

    it("should throw if kdfConfig is undefined on the PasswordInputResult object", async () => {
      const invalidPasswordInputResult: PasswordInputResult = {
        ...passwordInputResult,
        kdfConfig: undefined,
      };

      const promise = service.finishRegistration(email, invalidPasswordInputResult);

      await expect(promise).rejects.toThrow(
        "kdfConfig is null or undefined. Could not finish registration.",
      );
      expect(postKeysForUserPasswordRegistration).not.toHaveBeenCalled();
    });

    it("throws an error if the SDK client is not available", async () => {
      sdkService.client$ = of(null as any);

      await expect(
        service.finishRegistration(email, passwordInputResult, emailVerificationToken),
      ).rejects.toThrow("SDK not available");

      expect(postKeysForUserPasswordRegistration).not.toHaveBeenCalled();
    });

    it("posts the user password registration keys via the SDK", async () => {
      await service.finishRegistration(email, passwordInputResult, emailVerificationToken);

      expect(postKeysForUserPasswordRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          salt: passwordInputResult.salt,
          master_password: passwordInputResult.newPassword,
          master_password_hint: passwordInputResult.newPasswordHint,
          email_verification_token: emailVerificationToken,
        }),
      );
    });

    it("does not pass the web-only tokens and ids through to the SDK register request", async () => {
      await service.finishRegistration(
        email,
        passwordInputResult,
        emailVerificationToken,
        orgSponsoredFreeFamilyPlanToken,
        acceptEmergencyAccessInviteToken,
        emergencyAccessId,
        providerInviteToken,
        providerUserId,
        salesAssistedToken,
      );

      expect(postKeysForUserPasswordRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          salt: passwordInputResult.salt,
          master_password: passwordInputResult.newPassword,
          master_password_hint: passwordInputResult.newPasswordHint,
          email_verification_token: emailVerificationToken,
          sales_assisted_token: undefined,
          organization_user_id: undefined,
          org_invite_token: undefined,
          org_sponsored_free_family_plan_token: undefined,
          accept_emergency_access_invite_token: undefined,
          accept_emergency_access_id: undefined,
          provider_invite_token: undefined,
          provider_user_id: undefined,
        }),
      );
    });

    it("leaves the emergency access and provider ids undefined when not provided", async () => {
      await service.finishRegistration(email, passwordInputResult, emailVerificationToken);

      expect(postKeysForUserPasswordRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          accept_emergency_access_id: undefined,
          provider_user_id: undefined,
        }),
      );
    });
  });
});
