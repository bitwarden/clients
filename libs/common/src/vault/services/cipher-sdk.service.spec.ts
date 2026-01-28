import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId, CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CipherType } from "../enums/cipher-type";

import { DefaultCipherSdkService } from "./cipher-sdk.service";

describe("DefaultCipherSdkService", () => {
  const sdkService = mock<SdkService>();
  const logService = mock<LogService>();
  const userId = "test-user-id" as UserId;
  const cipherId = "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as CipherId;
  const orgId = "4ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b21" as OrganizationId;

  let cipherSdkService: DefaultCipherSdkService;
  let mockSdkClient: any;
  let mockCiphersSdk: any;
  let mockAdminSdk: any;
  let mockVaultSdk: any;

  beforeEach(() => {
    // Mock the SDK client chain for admin operations
    mockAdminSdk = {
      create: jest.fn(),
      edit: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      delete_many: jest.fn().mockResolvedValue(undefined),
      soft_delete: jest.fn().mockResolvedValue(undefined),
      soft_delete_many: jest.fn().mockResolvedValue(undefined),
      restore: jest.fn().mockResolvedValue(undefined),
      restore_many: jest.fn().mockResolvedValue(undefined),
    };
    mockCiphersSdk = {
      create: jest.fn(),
      edit: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      delete_many: jest.fn().mockResolvedValue(undefined),
      soft_delete: jest.fn().mockResolvedValue(undefined),
      soft_delete_many: jest.fn().mockResolvedValue(undefined),
      restore: jest.fn().mockResolvedValue(undefined),
      restore_many: jest.fn().mockResolvedValue(undefined),
      admin: jest.fn().mockReturnValue(mockAdminSdk),
    };
    mockVaultSdk = {
      ciphers: jest.fn().mockReturnValue(mockCiphersSdk),
    };
    const mockSdkValue = {
      vault: jest.fn().mockReturnValue(mockVaultSdk),
    };
    mockSdkClient = {
      take: jest.fn().mockReturnValue({
        value: mockSdkValue,
        [Symbol.dispose]: jest.fn(),
      }),
    };

    // Mock sdkService to return the mock client
    sdkService.userClient$.mockReturnValue(of(mockSdkClient));

    cipherSdkService = new DefaultCipherSdkService(sdkService, logService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("createWithServer()", () => {
    it("should create cipher using SDK when orgAdmin is false", async () => {
      const cipherView = new CipherView();
      cipherView.id = cipherId;
      cipherView.type = CipherType.Login;
      cipherView.name = "Test Cipher";
      cipherView.organizationId = orgId;

      const mockSdkCipherView = cipherView.toSdkCipherView();
      mockCiphersSdk.create.mockResolvedValue(mockSdkCipherView);

      const result = await cipherSdkService.createWithServer(cipherView, userId, false);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: cipherView.name,
          organizationId: expect.anything(),
        }),
      );
      expect(result).toBeInstanceOf(CipherView);
      expect(result?.name).toBe(cipherView.name);
    });

    it("should create cipher using SDK admin API when orgAdmin is true", async () => {
      const cipherView = new CipherView();
      cipherView.id = cipherId;
      cipherView.type = CipherType.Login;
      cipherView.name = "Test Admin Cipher";
      cipherView.organizationId = orgId;

      const mockSdkCipherView = cipherView.toSdkCipherView();
      mockAdminSdk.create.mockResolvedValue(mockSdkCipherView);

      const result = await cipherSdkService.createWithServer(cipherView, userId, true);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.admin).toHaveBeenCalled();
      expect(mockAdminSdk.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: cipherView.name,
        }),
      );
      expect(result).toBeInstanceOf(CipherView);
      expect(result?.name).toBe(cipherView.name);
    });

    it("should throw error and log when SDK client is not available", async () => {
      sdkService.userClient$.mockReturnValue(of(null));
      const cipherView = new CipherView();
      cipherView.name = "Test Cipher";

      await expect(cipherSdkService.createWithServer(cipherView, userId)).rejects.toThrow();
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create cipher"),
      );
    });

    it("should throw error and log when SDK throws an error", async () => {
      const cipherView = new CipherView();
      cipherView.name = "Test Cipher";

      mockCiphersSdk.create.mockRejectedValue(new Error("SDK error"));

      await expect(cipherSdkService.createWithServer(cipherView, userId)).rejects.toThrow();
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create cipher"),
      );
    });
  });

  describe("updateWithServer()", () => {
    it("should update cipher using SDK when orgAdmin is false", async () => {
      const cipherView = new CipherView();
      cipherView.id = cipherId;
      cipherView.type = CipherType.Login;
      cipherView.name = "Updated Cipher";
      cipherView.organizationId = orgId;

      const mockSdkCipherView = cipherView.toSdkCipherView();
      mockCiphersSdk.edit.mockResolvedValue(mockSdkCipherView);

      const result = await cipherSdkService.updateWithServer(cipherView, userId, undefined, false);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.anything(),
          name: cipherView.name,
        }),
      );
      expect(result).toBeInstanceOf(CipherView);
      expect(result.name).toBe(cipherView.name);
    });

    it("should update cipher using SDK admin API when orgAdmin is true", async () => {
      const cipherView = new CipherView();
      cipherView.id = cipherId;
      cipherView.type = CipherType.Login;
      cipherView.name = "Updated Admin Cipher";
      cipherView.organizationId = orgId;

      const originalCipherView = new CipherView();
      originalCipherView.id = cipherId;
      originalCipherView.name = "Original Cipher";

      const mockSdkCipherView = cipherView.toSdkCipherView();
      mockAdminSdk.edit.mockResolvedValue(mockSdkCipherView);

      const result = await cipherSdkService.updateWithServer(
        cipherView,
        userId,
        originalCipherView,
        true,
      );

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.admin).toHaveBeenCalled();
      expect(mockAdminSdk.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.anything(),
          name: cipherView.name,
        }),
        originalCipherView.toSdkCipherView(),
      );
      expect(result).toBeInstanceOf(CipherView);
      expect(result.name).toBe(cipherView.name);
    });

    it("should update cipher using SDK admin API without originalCipherView", async () => {
      const cipherView = new CipherView();
      cipherView.id = cipherId;
      cipherView.type = CipherType.Login;
      cipherView.name = "Updated Admin Cipher";
      cipherView.organizationId = orgId;

      const mockSdkCipherView = cipherView.toSdkCipherView();
      mockAdminSdk.edit.mockResolvedValue(mockSdkCipherView);

      const result = await cipherSdkService.updateWithServer(cipherView, userId, undefined, true);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.admin).toHaveBeenCalled();
      expect(mockAdminSdk.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.anything(),
          name: cipherView.name,
        }),
        expect.anything(), // Empty CipherView - timestamps vary so we just verify it was called
      );
      expect(result).toBeInstanceOf(CipherView);
      expect(result.name).toBe(cipherView.name);
    });

    it("should throw error and log when SDK client is not available", async () => {
      sdkService.userClient$.mockReturnValue(of(null));
      const cipherView = new CipherView();
      cipherView.name = "Test Cipher";

      await expect(
        cipherSdkService.updateWithServer(cipherView, userId, undefined, false),
      ).rejects.toThrow();
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update cipher"),
      );
    });

    it("should throw error and log when SDK throws an error", async () => {
      const cipherView = new CipherView();
      cipherView.name = "Test Cipher";

      mockCiphersSdk.edit.mockRejectedValue(new Error("SDK error"));

      await expect(
        cipherSdkService.updateWithServer(cipherView, userId, undefined, false),
      ).rejects.toThrow();
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update cipher"),
      );
    });
  });

  describe("deleteWithServer()", () => {
    const testCipherId = "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as CipherId;

    it("should delete cipher using SDK when asAdmin is false", async () => {
      await cipherSdkService.deleteWithServer(testCipherId, userId, false);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.delete).toHaveBeenCalledWith(testCipherId);
      expect(mockCiphersSdk.admin).not.toHaveBeenCalled();
    });

    it("should delete cipher using SDK admin API when asAdmin is true", async () => {
      await cipherSdkService.deleteWithServer(testCipherId, userId, true);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.admin).toHaveBeenCalled();
      expect(mockAdminSdk.delete).toHaveBeenCalledWith(testCipherId);
    });

    it("should throw error and log when SDK client is not available", async () => {
      sdkService.userClient$.mockReturnValue(of(null));

      await expect(cipherSdkService.deleteWithServer(testCipherId, userId)).rejects.toThrow(
        "SDK not available",
      );
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete cipher"),
      );
    });

    it("should throw error and log when SDK throws an error", async () => {
      mockCiphersSdk.delete.mockRejectedValue(new Error("SDK error"));

      await expect(cipherSdkService.deleteWithServer(testCipherId, userId)).rejects.toThrow();
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete cipher"),
      );
    });
  });

  describe("deleteManyWithServer()", () => {
    const testCipherIds = [
      "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as CipherId,
      "6ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b23" as CipherId,
    ];

    it("should delete multiple ciphers using SDK when asAdmin is false", async () => {
      await cipherSdkService.deleteManyWithServer(testCipherIds, userId, false);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.delete_many).toHaveBeenCalledWith(testCipherIds);
      expect(mockCiphersSdk.admin).not.toHaveBeenCalled();
    });

    it("should delete multiple ciphers using SDK admin API when asAdmin is true", async () => {
      await cipherSdkService.deleteManyWithServer(testCipherIds, userId, true, orgId);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.admin).toHaveBeenCalled();
      expect(mockAdminSdk.delete_many).toHaveBeenCalledWith(testCipherIds, orgId);
    });

    it("should throw error when asAdmin is true but orgId is missing", async () => {
      await expect(
        cipherSdkService.deleteManyWithServer(testCipherIds, userId, true, undefined),
      ).rejects.toThrow("Organization ID is required for admin delete.");
    });

    it("should throw error and log when SDK client is not available", async () => {
      sdkService.userClient$.mockReturnValue(of(null));

      await expect(cipherSdkService.deleteManyWithServer(testCipherIds, userId)).rejects.toThrow(
        "SDK not available",
      );
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete multiple ciphers"),
      );
    });

    it("should throw error and log when SDK throws an error", async () => {
      mockCiphersSdk.delete_many.mockRejectedValue(new Error("SDK error"));

      await expect(cipherSdkService.deleteManyWithServer(testCipherIds, userId)).rejects.toThrow();
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete multiple ciphers"),
      );
    });
  });

  describe("softDeleteWithServer()", () => {
    const testCipherId = "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as CipherId;

    it("should soft delete cipher using SDK when asAdmin is false", async () => {
      await cipherSdkService.softDeleteWithServer(testCipherId, userId, false);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.soft_delete).toHaveBeenCalledWith(testCipherId);
      expect(mockCiphersSdk.admin).not.toHaveBeenCalled();
    });

    it("should soft delete cipher using SDK admin API when asAdmin is true", async () => {
      await cipherSdkService.softDeleteWithServer(testCipherId, userId, true);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.admin).toHaveBeenCalled();
      expect(mockAdminSdk.soft_delete).toHaveBeenCalledWith(testCipherId);
    });

    it("should throw error and log when SDK client is not available", async () => {
      sdkService.userClient$.mockReturnValue(of(null));

      await expect(cipherSdkService.softDeleteWithServer(testCipherId, userId)).rejects.toThrow(
        "SDK not available",
      );
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to soft delete cipher"),
      );
    });

    it("should throw error and log when SDK throws an error", async () => {
      mockCiphersSdk.soft_delete.mockRejectedValue(new Error("SDK error"));

      await expect(cipherSdkService.softDeleteWithServer(testCipherId, userId)).rejects.toThrow();
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to soft delete cipher"),
      );
    });
  });

  describe("softDeleteManyWithServer()", () => {
    const testCipherIds = [
      "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as CipherId,
      "6ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b23" as CipherId,
    ];

    it("should soft delete multiple ciphers using SDK when asAdmin is false", async () => {
      await cipherSdkService.softDeleteManyWithServer(testCipherIds, userId, false);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.soft_delete_many).toHaveBeenCalledWith(testCipherIds);
      expect(mockCiphersSdk.admin).not.toHaveBeenCalled();
    });

    it("should soft delete multiple ciphers using SDK admin API when asAdmin is true", async () => {
      await cipherSdkService.softDeleteManyWithServer(testCipherIds, userId, true, orgId);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.admin).toHaveBeenCalled();
      expect(mockAdminSdk.soft_delete_many).toHaveBeenCalledWith(testCipherIds, orgId);
    });

    it("should throw error when asAdmin is true but orgId is missing", async () => {
      await expect(
        cipherSdkService.softDeleteManyWithServer(testCipherIds, userId, true, undefined),
      ).rejects.toThrow("Organization ID is required for admin soft delete.");
    });

    it("should throw error and log when SDK client is not available", async () => {
      sdkService.userClient$.mockReturnValue(of(null));

      await expect(
        cipherSdkService.softDeleteManyWithServer(testCipherIds, userId),
      ).rejects.toThrow("SDK not available");
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to soft delete multiple ciphers"),
      );
    });

    it("should throw error and log when SDK throws an error", async () => {
      mockCiphersSdk.soft_delete_many.mockRejectedValue(new Error("SDK error"));

      await expect(
        cipherSdkService.softDeleteManyWithServer(testCipherIds, userId),
      ).rejects.toThrow();
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to soft delete multiple ciphers"),
      );
    });
  });

  describe("restoreWithServer()", () => {
    const testCipherId = "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as CipherId;

    it("should restore cipher using SDK when asAdmin is false", async () => {
      await cipherSdkService.restoreWithServer(testCipherId, userId, false);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.restore).toHaveBeenCalledWith(testCipherId);
      expect(mockCiphersSdk.admin).not.toHaveBeenCalled();
    });

    it("should restore cipher using SDK admin API when asAdmin is true", async () => {
      await cipherSdkService.restoreWithServer(testCipherId, userId, true);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.admin).toHaveBeenCalled();
      expect(mockAdminSdk.restore).toHaveBeenCalledWith(testCipherId);
    });

    it("should throw error and log when SDK client is not available", async () => {
      sdkService.userClient$.mockReturnValue(of(null));

      await expect(cipherSdkService.restoreWithServer(testCipherId, userId)).rejects.toThrow(
        "SDK not available",
      );
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to restore cipher"),
      );
    });

    it("should throw error and log when SDK throws an error", async () => {
      mockCiphersSdk.restore.mockRejectedValue(new Error("SDK error"));

      await expect(cipherSdkService.restoreWithServer(testCipherId, userId)).rejects.toThrow();
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to restore cipher"),
      );
    });
  });

  describe("restoreManyWithServer()", () => {
    const testCipherIds = [
      "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22" as CipherId,
      "6ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b23" as CipherId,
    ];

    it("should restore multiple ciphers using SDK when orgId is not provided", async () => {
      await cipherSdkService.restoreManyWithServer(testCipherIds, userId);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.restore_many).toHaveBeenCalledWith(testCipherIds);
      expect(mockCiphersSdk.admin).not.toHaveBeenCalled();
    });

    it("should restore multiple ciphers using SDK admin API when orgId is provided", async () => {
      const orgIdString = orgId as string;
      await cipherSdkService.restoreManyWithServer(testCipherIds, userId, orgIdString);

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(mockVaultSdk.ciphers).toHaveBeenCalled();
      expect(mockCiphersSdk.admin).toHaveBeenCalled();
      expect(mockAdminSdk.restore_many).toHaveBeenCalledWith(testCipherIds, orgIdString);
    });

    it("should throw error and log when SDK client is not available", async () => {
      sdkService.userClient$.mockReturnValue(of(null));

      await expect(cipherSdkService.restoreManyWithServer(testCipherIds, userId)).rejects.toThrow(
        "SDK not available",
      );
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to restore multiple ciphers"),
      );
    });

    it("should throw error and log when SDK throws an error", async () => {
      mockCiphersSdk.restore_many.mockRejectedValue(new Error("SDK error"));

      await expect(cipherSdkService.restoreManyWithServer(testCipherIds, userId)).rejects.toThrow();
      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to restore multiple ciphers"),
      );
    });
  });
});
