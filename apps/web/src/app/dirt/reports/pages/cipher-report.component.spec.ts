import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";

import { VaultItemDialogResult } from "../../../vault/components/vault-item-dialog/vault-item-dialog.component";
import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";

import { CipherReportComponent } from "./cipher-report.component";

describe("CipherReportComponent", () => {
  let component: CipherReportComponent;
  let mockAccountService: MockProxy<AccountService>;
  let mockAdminConsoleCipherFormConfigService: MockProxy<AdminConsoleCipherFormConfigService>;
  const mockCipher = {
    id: "122-333-444",
    type: CipherType.Login,
    orgId: "222-444-555",
    login: {
      username: "test-username",
      password: "test-password",
      totp: "123",
    },
    icon: "bwi-collection-shared",
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

    component = new CipherReportComponent(
      mockCipherService,
      mock<DialogService>(),
      mock<PasswordRepromptService>(),
      mock<OrganizationService>(),
      mockAccountService,
      mock<I18nService>(),
      mock<SyncService>(),
      mock<CipherFormConfigService>(),
      mockAdminConsoleCipherFormConfigService,
      mock<CollectionService>(),
    );
    component.ciphers = [];
    component.allCiphers = [];
  });

  it("should remove the cipher from the report if it was deleted", async () => {
    const cipherToDelete = { id: "cipher1" } as any;
    component.ciphers = [cipherToDelete, { id: "cipher2" } as any];

    jest.spyOn(component, "determinedUpdatedCipherReportStatus").mockResolvedValue(null);

    await component.refresh(VaultItemDialogResult.Deleted, cipherToDelete);

    expect(component.ciphers).toEqual([{ id: "cipher2", icon: "bwi-collection-shared" }]);
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
