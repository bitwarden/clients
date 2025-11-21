import { mock, MockProxy } from "jest-mock-extended";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { IndividualVaultExportServiceAbstraction } from "./individual-vault-export.service.abstraction";
import { OrganizationVaultExportServiceAbstraction } from "./org-vault-export.service.abstraction";
import { VaultExportService } from "./vault-export.service";

/** Tests the vault export service which handles exporting both individual and organizational vaults */
describe("VaultExportService", () => {
  let service: VaultExportService;
  let individualVaultExportService: MockProxy<IndividualVaultExportServiceAbstraction>;
  let organizationVaultExportService: MockProxy<OrganizationVaultExportServiceAbstraction>;
  let accountService: FakeAccountService;
  const mockUserId = Utils.newGuid() as UserId;
  const mockOrganizationId = Utils.newGuid() as OrganizationId;

  beforeEach(() => {
    individualVaultExportService = mock<IndividualVaultExportServiceAbstraction>();
    organizationVaultExportService = mock<OrganizationVaultExportServiceAbstraction>();
    accountService = mockAccountServiceWith(mockUserId);

    service = new VaultExportService(
      individualVaultExportService,
      organizationVaultExportService,
      accountService,
    );
  });

  describe("getExport", () => {
    it("calls checkForImpersonation with userId", async () => {
      const spy = jest.spyOn(service as any, "checkForImpersonation");

      await service.getExport(mockUserId, "json", "");
      expect(spy).toHaveBeenCalledWith(mockUserId);
    });

    it("validates the given userId matches the current authenticated user", async () => {
      const anotherUserId = "another-user-id" as UserId;

      await expect(service.getExport(anotherUserId, "json", "")).rejects.toThrow(
        "UserId does not match the currently authenticated user",
      );

      expect(individualVaultExportService.getExport).not.toHaveBeenCalledWith(mockUserId, "json");
    });

    it("calls getExport when password is empty", async () => {
      await service.getExport(mockUserId, "json", "");
      expect(individualVaultExportService.getExport).toHaveBeenCalledWith(mockUserId, "json");
    });

    it("throws error if format is csv and password is provided", async () => {
      await expect(service.getExport(mockUserId, "csv", "secret")).rejects.toThrow(
        "CSV does not support password protected export",
      );
      expect(individualVaultExportService.getPasswordProtectedExport).not.toHaveBeenCalled();
      expect(individualVaultExportService.getExport).not.toHaveBeenCalled();
    });

    it("calls getPasswordProtectedExport when password is provided and format is not csv", async () => {
      await service.getExport(mockUserId, "json", "somePassword");
      expect(individualVaultExportService.getPasswordProtectedExport).toHaveBeenCalledWith(
        mockUserId,
        "somePassword",
      );
    });

    it("uses default format csv if not provided", async () => {
      await service.getExport(mockUserId);
      expect(individualVaultExportService.getExport).toHaveBeenCalledWith(mockUserId, "csv");
    });
  });

  describe("getOrganizationExport", () => {
    it("calls checkForImpersonation with userId", async () => {
      const spy = jest.spyOn(service as any, "checkForImpersonation");

      await service.getOrganizationExport(mockUserId, mockOrganizationId, "json", "");
      expect(spy).toHaveBeenCalledWith(mockUserId);
    });

    it("validates the given userId matches the current authenticated user", async () => {
      const anotherUserId = "another-user-id" as UserId;

      await expect(
        service.getOrganizationExport(anotherUserId, mockOrganizationId, "json", ""),
      ).rejects.toThrow("UserId does not match the currently authenticated user");

      expect(organizationVaultExportService.getOrganizationExport).not.toHaveBeenCalledWith(
        mockUserId,
        mockOrganizationId,
        "json",
      );
    });

    it("calls getOrganizationExport when password is empty", async () => {
      await service.getOrganizationExport(mockUserId, mockOrganizationId, "json", "");
      expect(organizationVaultExportService.getOrganizationExport).toHaveBeenCalledWith(
        mockUserId,
        mockOrganizationId,
        "json",
        false,
      );
    });

    it("throws error if format is csv and password is provided", async () => {
      await expect(
        service.getOrganizationExport(mockUserId, mockOrganizationId, "csv", "secret"),
      ).rejects.toThrow("CSV does not support password protected export");
      expect(organizationVaultExportService.getPasswordProtectedExport).not.toHaveBeenCalled();
      expect(organizationVaultExportService.getOrganizationExport).not.toHaveBeenCalled();
    });

    it("calls getPasswordProtectedExport when password is provided and format is not csv", async () => {
      await service.getOrganizationExport(mockUserId, mockOrganizationId, "json", "somePassword");
      expect(organizationVaultExportService.getPasswordProtectedExport).toHaveBeenCalledWith(
        mockUserId,
        mockOrganizationId,
        "somePassword",
        false,
      );
    });

    it("when calling getOrganizationExport without a password it passes onlyManagedCollection param on", async () => {
      await service.getOrganizationExport(mockUserId, mockOrganizationId, "json", "", true);
      expect(organizationVaultExportService.getOrganizationExport).toHaveBeenCalledWith(
        mockUserId,
        mockOrganizationId,
        "json",
        true,
      );
    });

    it("when calling getOrganizationExport with a password it passes onlyManagedCollection param on", async () => {
      await service.getOrganizationExport(
        mockUserId,
        mockOrganizationId,
        "json",
        "somePassword",
        true,
      );
      expect(organizationVaultExportService.getPasswordProtectedExport).toHaveBeenCalledWith(
        mockUserId,
        mockOrganizationId,
        "somePassword",
        true,
      );
    });
  });
});
