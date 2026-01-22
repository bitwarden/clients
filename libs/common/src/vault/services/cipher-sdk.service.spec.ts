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
    };
    mockCiphersSdk = {
      create: jest.fn(),
      edit: jest.fn(),
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
});
