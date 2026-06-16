import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import {
  CipherFormConfigService,
  PasswordRepromptService,
  VaultItemDialogResult,
} from "@bitwarden/vault";

import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";

import { CipherReportComponent } from "./cipher-report.component";

// CipherReportComponent is an abstract class, so we create a concrete subclass for testing
class TestCipherReportComponent extends CipherReportComponent {}

describe("CipherReportComponent", () => {
  let component: TestCipherReportComponent;
  let mockAccountService: MockProxy<AccountService>;
  let mockAdminConsoleCipherFormConfigService: MockProxy<AdminConsoleCipherFormConfigService>;
  let mockSyncService: MockProxy<SyncService>;
  let mockLogService: MockProxy<LogService>;
  const mockCipher = {
    id: "122-333-444",
    type: CipherType.Login,
    orgId: "222-444-555",
    login: {
      username: "test-username",
      password: "test-password",
      totp: "123",
    },
    decrypt: jest.fn().mockResolvedValue({ id: "cipher1", name: "Updated" }),
  } as unknown as Cipher;
  const mockCipherService = mock<CipherService>();
  mockCipherService.get.mockResolvedValue(mockCipher as unknown as Cipher);
  mockCipherService.getKeyForCipherKeyDecryption.mockResolvedValue({});
  mockCipherService.deleteWithServer.mockResolvedValue(undefined);
  mockCipherService.softDeleteWithServer.mockResolvedValue(undefined);

  beforeEach(() => {
    mockAccountService = mock<AccountService>();
    mockAccountService.activeAccount$ = of({ id: "user1" } as any);
    mockAdminConsoleCipherFormConfigService = mock<AdminConsoleCipherFormConfigService>();
    mockSyncService = mock<SyncService>();
    mockLogService = mock<LogService>();

    // CipherReportComponent is an abstract class, so we create a concrete subclass for testing
    component = new TestCipherReportComponent(
      mockCipherService,
      mock<DialogService>(),
      mock<PasswordRepromptService>(),
      mock<OrganizationService>(),
      mockAccountService,
      mock<I18nService>(),
      mockSyncService,
      mock<CipherFormConfigService>(),
      mockAdminConsoleCipherFormConfigService,
      mockLogService,
    );
    component.ciphers = [];
    component.allCiphers = [];
  });

  it("should log an error and rethrow when fullSync fails during load", async () => {
    const syncError = new Error("sync failed");
    mockSyncService.fullSync.mockRejectedValue(syncError);

    await expect(component.load()).rejects.toThrow(syncError);

    expect(mockLogService.error).toHaveBeenCalledWith(expect.any(String), syncError);
    // Spinner state must still settle so the UI does not hang.
    expect(component.loading).toBe(false);
    // hasLoaded must remain false and loadFailed must be set on failure so the template renders
    // an error state instead of a misleading "success" (e.g. "no exposed passwords found") state.
    expect(component.hasLoaded).toBe(false);
    expect(component.loadFailed).toBe(true);
  });

  it("should log a completion info message that includes a count on a successful load", async () => {
    mockSyncService.fullSync.mockResolvedValue(true);

    await component.load();

    expect(mockLogService.error).not.toHaveBeenCalled();
    expect(mockLogService.info).toHaveBeenCalled();
    expect(component.loadFailed).toBe(false);
  });

  it("should log entry into setCiphers during load", async () => {
    mockSyncService.fullSync.mockResolvedValue(true);

    await component.load();

    expect(mockLogService.info).toHaveBeenCalledWith(expect.stringContaining("Setting ciphers"));
  });

  it("should log an error and rethrow when setCiphers fails during load", async () => {
    mockSyncService.fullSync.mockResolvedValue(true);
    const setCiphersError = new Error("setCiphers failed");
    jest.spyOn(component as any, "setCiphers").mockRejectedValue(setCiphersError);

    await expect(component.load()).rejects.toThrow(setCiphersError);

    expect(mockLogService.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to load report"),
      setCiphersError,
    );
    // Spinner state must still settle so the UI does not hang.
    expect(component.loading).toBe(false);
    // hasLoaded must remain false and loadFailed must be set on failure so the template renders
    // an error state instead of a misleading "success" (e.g. "no exposed passwords found") state.
    expect(component.hasLoaded).toBe(false);
    expect(component.loadFailed).toBe(true);
  });

  it("should remove the cipher from the report if it was deleted", async () => {
    const cipherToDelete = { id: "cipher1" } as any;
    component.ciphers = [cipherToDelete, { id: "cipher2" } as any];

    jest.spyOn(component, "determinedUpdatedCipherReportStatus").mockResolvedValue(null);

    await component.refresh(VaultItemDialogResult.Deleted, cipherToDelete);

    expect(component.ciphers).toEqual([{ id: "cipher2" }]);
    expect(component.determinedUpdatedCipherReportStatus).toHaveBeenCalledWith(
      VaultItemDialogResult.Deleted,
      cipherToDelete,
    );
  });

  it("should update the cipher in the report if it was saved", async () => {
    const cipherViewToUpdate = { ...mockCipher } as unknown as CipherView;
    const updatedCipher = { ...mockCipher, name: "Updated" } as unknown as Cipher;
    const updatedCipherView = { ...updatedCipher } as unknown as CipherView;

    component.ciphers = [cipherViewToUpdate];
    mockCipherService.get.mockResolvedValue(updatedCipher);
    mockCipherService.getKeyForCipherKeyDecryption.mockResolvedValue("key");

    jest.spyOn(updatedCipher, "decrypt").mockResolvedValue(updatedCipherView);

    jest
      .spyOn(component, "determinedUpdatedCipherReportStatus")
      .mockResolvedValue(updatedCipherView);

    await component.refresh(VaultItemDialogResult.Saved, updatedCipherView);

    expect(component.ciphers).toEqual([updatedCipherView]);
    expect(component.determinedUpdatedCipherReportStatus).toHaveBeenCalledWith(
      VaultItemDialogResult.Saved,
      updatedCipherView,
    );
  });

  it("should remove the cipher from the report if it no longer meets the criteria after saving", async () => {
    const cipherViewToUpdate = { ...mockCipher } as unknown as CipherView;
    const updatedCipher = { ...mockCipher, name: "Updated" } as unknown as Cipher;
    const updatedCipherView = { ...updatedCipher } as unknown as CipherView;

    component.ciphers = [cipherViewToUpdate];

    mockCipherService.get.mockResolvedValue(updatedCipher);
    mockCipherService.getKeyForCipherKeyDecryption.mockResolvedValue("key");

    jest.spyOn(updatedCipher, "decrypt").mockResolvedValue(updatedCipherView);

    jest.spyOn(component, "determinedUpdatedCipherReportStatus").mockResolvedValue(null);

    await component.refresh(VaultItemDialogResult.Saved, updatedCipherView);

    expect(component.ciphers).toEqual([]);
    expect(component.determinedUpdatedCipherReportStatus).toHaveBeenCalledWith(
      VaultItemDialogResult.Saved,
      updatedCipherView,
    );
  });
});
