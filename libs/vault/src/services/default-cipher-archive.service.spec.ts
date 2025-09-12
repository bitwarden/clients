import { mock } from "jest-mock-extended";
import { of, firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  CipherBulkArchiveRequest,
  CipherBulkUnarchiveRequest,
} from "@bitwarden/common/vault/models/request/cipher-bulk-archive.request";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { CipherListView } from "@bitwarden/sdk-internal";

import { DecryptionFailureDialogComponent } from "../components/decryption-failure-dialog/decryption-failure-dialog.component";

import { DefaultCipherArchiveService } from "./default-cipher-archive.service";
import { PasswordRepromptService } from "./password-reprompt.service";

describe("DefaultCipherArchiveService", () => {
  let service: DefaultCipherArchiveService;
  let mockCipherService: jest.Mocked<CipherService>;
  let mockApiService: jest.Mocked<ApiService>;
  let mockDialogService: jest.Mocked<DialogService>;
  let mockPasswordRepromptService: jest.Mocked<PasswordRepromptService>;
  let mockBillingAccountProfileStateService: jest.Mocked<BillingAccountProfileStateService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  const userId = "user-id" as UserId;
  const cipherId = "123" as CipherId;

  beforeEach(() => {
    mockCipherService = mock<CipherService>();
    mockApiService = mock<ApiService>();
    mockDialogService = mock<DialogService>();
    mockPasswordRepromptService = mock<PasswordRepromptService>();
    mockBillingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    mockConfigService = mock<ConfigService>();

    service = new DefaultCipherArchiveService(
      mockCipherService,
      mockApiService,
      mockDialogService,
      mockPasswordRepromptService,
      mockBillingAccountProfileStateService,
      mockConfigService,
    );
  });

  describe("archivedCiphers$", () => {
    it("should return only archived ciphers", async () => {
      const mockCiphers: CipherListView[] = [
        {
          id: "1",
          archivedDate: "2024-01-15T10:30:00.000Z",
          type: "identity",
        } as CipherListView,
        {
          id: "2",
          type: "secureNote",
        } as CipherListView,
        {
          id: "3",
          archivedDate: "2024-01-15T10:30:00.000Z",
          deletedDate: "2024-01-16T10:30:00.000Z",
          type: "sshKey",
        } as CipherListView,
      ];

      mockCipherService.cipherListViews$.mockReturnValue(of(mockCiphers));

      const result = await firstValueFrom(service.archivedCiphers$(userId));

      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual("1");
    });

    it("should return empty array when no archived ciphers exist", async () => {
      const mockCiphers: CipherListView[] = [
        {
          id: "1",
          type: "identity",
        } as CipherListView,
      ];

      mockCipherService.cipherListViews$.mockReturnValue(of(mockCiphers));

      const result = await firstValueFrom(service.archivedCiphers$(userId));

      expect(result).toHaveLength(0);
    });
  });

  describe("userCanArchive$", () => {
    it("should return true when user has premium and feature flag is enabled", async () => {
      mockBillingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));
      mockConfigService.getFeatureFlag$.mockReturnValue(of(true));

      const result = await firstValueFrom(service.userCanArchive$(userId));

      expect(result).toBe(true);
      expect(mockBillingAccountProfileStateService.hasPremiumFromAnySource$).toHaveBeenCalledWith(
        userId,
      );
      expect(mockConfigService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.PM19148_InnovationArchive,
      );
    });

    it("should return false when feature flag is disabled", async () => {
      mockBillingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(false));
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

      const result = await firstValueFrom(service.userCanArchive$(userId));

      expect(result).toBe(false);
    });
  });

  describe("archiveWithServer", () => {
    const mockResponse = {
      data: [
        {
          id: cipherId,
          archivedDate: "2024-01-15T10:30:00.000Z",
          revisionDate: "2024-01-15T10:31:00.000Z",
        },
      ],
    };

    beforeEach(() => {
      mockApiService.send.mockResolvedValue(mockResponse);
      mockCipherService.ciphers$.mockReturnValue(
        of({
          [cipherId]: {
            id: cipherId,
            revisionDate: "2024-01-15T10:00:00.000Z",
          } as any,
        }),
      );
      mockCipherService.replace.mockResolvedValue(undefined);
    });

    it("should archive single cipher", async () => {
      await service.archiveWithServer(cipherId, userId);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "PUT",
        "/ciphers/archive",
        expect.any(CipherBulkArchiveRequest),
        true,
        true,
      );
      expect(mockCipherService.ciphers$).toHaveBeenCalledWith(userId);
      expect(mockCipherService.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          [cipherId]: expect.objectContaining({
            archivedDate: "2024-01-15T10:30:00.000Z",
            revisionDate: "2024-01-15T10:31:00.000Z",
          }),
        }),
        userId,
      );
    });

    it("should archive multiple ciphers", async () => {
      const cipherIds = [cipherId, "cipher-id-2" as CipherId];

      await service.archiveWithServer(cipherIds, userId);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "PUT",
        "/ciphers/archive",
        expect.objectContaining({
          ids: cipherIds,
        }),
        true,
        true,
      );
    });
  });

  describe("unarchiveWithServer", () => {
    const mockResponse = {
      data: [
        {
          id: cipherId,
          revisionDate: "2024-01-15T10:31:00.000Z",
        },
      ],
    };

    beforeEach(() => {
      mockApiService.send.mockResolvedValue(mockResponse);
      mockCipherService.ciphers$.mockReturnValue(
        of({
          [cipherId]: {
            id: cipherId,
            archivedDate: "2024-01-15T10:30:00.000Z",
            revisionDate: "2024-01-15T10:00:00.000Z",
          } as any,
        }),
      );
      mockCipherService.replace.mockResolvedValue(undefined);
    });

    it("should unarchive single cipher", async () => {
      await service.unarchiveWithServer(cipherId, userId);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "PUT",
        "/ciphers/unarchive",
        expect.any(CipherBulkUnarchiveRequest),
        true,
        true,
      );
      expect(mockCipherService.ciphers$).toHaveBeenCalledWith(userId);
      expect(mockCipherService.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          [cipherId]: expect.objectContaining({
            revisionDate: "2024-01-15T10:31:00.000Z",
          }),
        }),
        userId,
      );
    });

    it("should unarchive multiple ciphers", async () => {
      const cipherIds = [cipherId, "cipher-id-2" as CipherId];

      await service.unarchiveWithServer(cipherIds, userId);

      expect(mockApiService.send).toHaveBeenCalledWith(
        "PUT",
        "/ciphers/unarchive",
        expect.objectContaining({
          ids: cipherIds,
        }),
        true,
        true,
      );
    });
  });

  describe("canInteract", () => {
    let mockCipherView: CipherView;

    beforeEach(() => {
      mockCipherView = {
        id: cipherId,
        decryptionFailure: false,
      } as unknown as CipherView;
    });

    it("should return false and open dialog when cipher has decryption failure", async () => {
      mockCipherView.decryptionFailure = true;
      const openSpy = jest.spyOn(DecryptionFailureDialogComponent, "open").mockImplementation();

      const result = await service.canInteract(mockCipherView);

      expect(result).toBe(false);
      expect(openSpy).toHaveBeenCalledWith(mockDialogService, {
        cipherIds: [cipherId],
      });
    });

    it("should return password reprompt result when no decryption failure", async () => {
      mockPasswordRepromptService.passwordRepromptCheck.mockResolvedValue(true);

      const result = await service.canInteract(mockCipherView);

      expect(result).toBe(true);
      expect(mockPasswordRepromptService.passwordRepromptCheck).toHaveBeenCalledWith(
        mockCipherView,
      );
    });

    it("should return false when password reprompt fails", async () => {
      mockPasswordRepromptService.passwordRepromptCheck.mockResolvedValue(false);

      const result = await service.canInteract(mockCipherView);

      expect(result).toBe(false);
    });
  });
});
