import { mock, MockProxy } from "jest-mock-extended";

import { OrganizationUserService } from "../../abstractions/organization-user/organization-user.service";
import { OrganizationApiServiceAbstraction } from "../../admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationAutoEnrollStatusResponse } from "../../admin-console/models/response/organization-auto-enroll-status.response";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { StateService } from "../../platform/abstractions/state.service";

import { PasswordResetEnrollmentServiceImplementation } from "./password-reset-enrollment.service.implementation";

describe("PasswordResetEnrollmentServiceImplementation", () => {
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let stateService: MockProxy<StateService>;
  let cryptoService: MockProxy<CryptoService>;
  let organizationUserService: MockProxy<OrganizationUserService>;
  let i18nService: MockProxy<I18nService>;
  let service: PasswordResetEnrollmentServiceImplementation;

  beforeEach(() => {
    organizationApiService = mock<OrganizationApiServiceAbstraction>();
    stateService = mock<StateService>();
    cryptoService = mock<CryptoService>();
    organizationUserService = mock<OrganizationUserService>();
    i18nService = mock<I18nService>();
    service = new PasswordResetEnrollmentServiceImplementation(
      organizationApiService,
      stateService,
      cryptoService,
      organizationUserService,
      i18nService
    );
  });

  describe("enrollIfRequired", () => {
    it("should not enroll when user is already enrolled in password reset", async () => {
      const mockResponse = new OrganizationAutoEnrollStatusResponse({
        ResetPasswordEnabled: true,
        Id: "orgId",
      });
      organizationApiService.getAutoEnrollStatus.mockResolvedValue(mockResponse);

      const enrollSpy = jest.spyOn(service, "enroll");
      enrollSpy.mockResolvedValue();

      await service.enrollIfRequired("ssoId");

      expect(service.enroll).not.toHaveBeenCalled();
    });

    it("should enroll when user is not enrolled in password reset", async () => {
      const mockResponse = new OrganizationAutoEnrollStatusResponse({
        ResetPasswordEnabled: false,
        Id: "orgId",
      });
      organizationApiService.getAutoEnrollStatus.mockResolvedValue(mockResponse);

      const enrollSpy = jest.spyOn(service, "enroll");
      enrollSpy.mockResolvedValue();

      await service.enrollIfRequired("ssoId");

      expect(service.enroll).toHaveBeenCalled();
    });
  });

  describe("enroll", () => {
    it("should throw an error if the organization keys are not found", async () => {
      organizationApiService.getKeys.mockResolvedValue(null);
      i18nService.t.mockReturnValue("resetPasswordOrgKeysError");

      const result = () => service.enroll("orgId");

      await expect(result).rejects.toThrowError("resetPasswordOrgKeysError");
    });

    it("should enroll the user when no user id or key is provided", async () => {
      const orgKeyResponse = {
        publicKey: "publicKey",
        privateKey: "privateKey",
      };
      const encryptedKey = { encryptedString: "encryptedString" };
      organizationApiService.getKeys.mockResolvedValue(orgKeyResponse as any);
      stateService.getUserId.mockResolvedValue("userId");
      cryptoService.getUserKey.mockResolvedValue({ key: "key" } as any);
      cryptoService.rsaEncrypt.mockResolvedValue(encryptedKey as any);

      await service.enroll("orgId");

      expect(
        organizationUserService.putOrganizationUserResetPasswordEnrollment
      ).toHaveBeenCalledWith(
        "orgId",
        "userId",
        expect.objectContaining({
          resetPasswordKey: encryptedKey.encryptedString,
        })
      );
    });

    it("should enroll the user when a user id and key is provided", async () => {
      const orgKeyResponse = {
        publicKey: "publicKey",
        privateKey: "privateKey",
      };
      const encryptedKey = { encryptedString: "encryptedString" };
      organizationApiService.getKeys.mockResolvedValue(orgKeyResponse as any);
      cryptoService.rsaEncrypt.mockResolvedValue(encryptedKey as any);

      await service.enroll("orgId", "userId", { key: "key" } as any);

      expect(
        organizationUserService.putOrganizationUserResetPasswordEnrollment
      ).toHaveBeenCalledWith(
        "orgId",
        "userId",
        expect.objectContaining({
          resetPasswordKey: encryptedKey.encryptedString,
        })
      );
    });
  });
});
