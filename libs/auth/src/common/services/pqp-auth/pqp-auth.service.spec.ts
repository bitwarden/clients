import {
  isGoogleDriveLoggedIn,
  isLoggedIn,
  getGoogleUserInfo,
  googleDriveLogin,
  localStateRepository,
  sha256,
} from "@ovrlab/pqp-network";

import { PqpAuthService, PqpAuthState } from "./pqp-auth.service";

// Mock the @ovrlab/pqp-network module
jest.mock("@ovrlab/pqp-network", () => ({
  isGoogleDriveLoggedIn: jest.fn(),
  isLoggedIn: jest.fn(),
  getGoogleUserInfo: jest.fn(),
  googleDriveLogin: jest.fn(),
  login: jest.fn(),
  localStateRepository: {
    getPrivateKey: jest.fn(),
  },
  sha256: jest.fn(),
}));

const mockIsGoogleDriveLoggedIn = isGoogleDriveLoggedIn as jest.Mock;
const mockIsPqpLoggedIn = isLoggedIn as jest.Mock;
const mockGetGoogleUserInfo = getGoogleUserInfo as jest.Mock;
const mockGoogleDriveLogin = googleDriveLogin as jest.Mock;
const mockGetPrivateKey = localStateRepository.getPrivateKey as jest.Mock;
const mockSha256 = sha256 as jest.Mock;

describe("PqpAuthService", () => {
  let service: PqpAuthService;

  beforeEach(() => {
    service = new PqpAuthService();
    jest.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have all properties set to false/null initially", () => {
      expect(service.googleDriveLoggedIn).toBe(false);
      expect(service.networkLoggedIn).toBe(false);
      expect(service.userEmail).toBeNull();
      expect(service.userName).toBeNull();
      expect(service.derivedPassword).toBeNull();
      expect(service.isReady).toBe(false);
    });
  });

  describe("getState", () => {
    it("should return current state object", () => {
      const state = service.getState();

      expect(state).toEqual({
        googleDriveLoggedIn: false,
        networkLoggedIn: false,
        userEmail: null,
        userName: null,
        derivedPassword: null,
        isReady: false,
      } as PqpAuthState);
    });
  });

  describe("checkStatus", () => {
    it("should check Google Drive and PqP login status", async () => {
      mockIsGoogleDriveLoggedIn.mockResolvedValue(false);
      mockIsPqpLoggedIn.mockResolvedValue(false);

      const state = await service.checkStatus();

      expect(mockIsGoogleDriveLoggedIn).toHaveBeenCalled();
      expect(mockIsPqpLoggedIn).toHaveBeenCalled();
      expect(state.googleDriveLoggedIn).toBe(false);
      expect(state.networkLoggedIn).toBe(false);
    });

    it("should fetch user info when Google Drive is logged in", async () => {
      mockIsGoogleDriveLoggedIn.mockResolvedValue(true);
      mockIsPqpLoggedIn.mockResolvedValue(false);
      mockGetGoogleUserInfo.mockResolvedValue({
        email: "test@example.com",
        name: "Test User",
      });

      const state = await service.checkStatus();

      expect(mockGetGoogleUserInfo).toHaveBeenCalled();
      expect(state.userEmail).toBe("test@example.com");
      expect(state.userName).toBe("Test User");
    });

    it("should derive password when both services are logged in", async () => {
      mockIsGoogleDriveLoggedIn.mockResolvedValue(true);
      mockIsPqpLoggedIn.mockResolvedValue(true);
      mockGetGoogleUserInfo.mockResolvedValue({ email: "test@example.com" });
      mockGetPrivateKey.mockResolvedValue("mock-private-key");
      mockSha256.mockResolvedValue("derived-password-hash");

      const state = await service.checkStatus();

      expect(state.isReady).toBe(true);
      expect(mockGetPrivateKey).toHaveBeenCalled();
      expect(mockSha256).toHaveBeenCalledWith("mock-private-key");
      expect(state.derivedPassword).toBe("derived-password-hash");
    });

    it("should handle errors gracefully", async () => {
      mockIsGoogleDriveLoggedIn.mockRejectedValue(new Error("Network error"));

      const state = await service.checkStatus();

      // Should not throw, just return current state
      expect(state.googleDriveLoggedIn).toBe(false);
    });
  });

  describe("loginToGoogleDrive", () => {
    it("should return true on successful login", async () => {
      mockGoogleDriveLogin.mockResolvedValue(true);
      mockGetGoogleUserInfo.mockResolvedValue({
        email: "user@example.com",
        name: "User Name",
      });

      const result = await service.loginToGoogleDrive();

      expect(result).toBe(true);
      expect(service.googleDriveLoggedIn).toBe(true);
      expect(service.userEmail).toBe("user@example.com");
      expect(service.userName).toBe("User Name");
    });

    it("should return false on failed login", async () => {
      mockGoogleDriveLogin.mockResolvedValue(false);

      const result = await service.loginToGoogleDrive();

      expect(result).toBe(false);
      expect(service.googleDriveLoggedIn).toBe(false);
    });

    it("should return false on error", async () => {
      mockGoogleDriveLogin.mockRejectedValue(new Error("Login failed"));

      const result = await service.loginToGoogleDrive();

      expect(result).toBe(false);
    });

    it("should derive password if both services become ready", async () => {
      // First, set network as logged in via checkStatus
      mockIsGoogleDriveLoggedIn.mockResolvedValue(false);
      mockIsPqpLoggedIn.mockResolvedValue(true);
      await service.checkStatus();

      // Now login to Google Drive
      mockGoogleDriveLogin.mockResolvedValue(true);
      mockGetGoogleUserInfo.mockResolvedValue({ email: "test@example.com" });
      mockGetPrivateKey.mockResolvedValue("private-key");
      mockSha256.mockResolvedValue("password-hash");

      await service.loginToGoogleDrive();

      expect(service.isReady).toBe(true);
      expect(service.derivedPassword).toBe("password-hash");
    });
  });

  describe("derivePassword", () => {
    it("should derive password from private key using SHA-256", async () => {
      mockGetPrivateKey.mockResolvedValue("my-private-key");
      mockSha256.mockResolvedValue("hashed-password");

      const result = await service.derivePassword();

      expect(mockGetPrivateKey).toHaveBeenCalled();
      expect(mockSha256).toHaveBeenCalledWith("my-private-key");
      expect(result).toBe("hashed-password");
      expect(service.derivedPassword).toBe("hashed-password");
    });

    it("should return null if no private key", async () => {
      mockGetPrivateKey.mockResolvedValue(null);

      const result = await service.derivePassword();

      expect(result).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      mockGetPrivateKey.mockRejectedValue(new Error("Storage error"));

      const result = await service.derivePassword();

      expect(result).toBeNull();
    });
  });

  describe("reset", () => {
    it("should reset all state to initial values", async () => {
      // First, set some state
      mockIsGoogleDriveLoggedIn.mockResolvedValue(true);
      mockIsPqpLoggedIn.mockResolvedValue(true);
      mockGetGoogleUserInfo.mockResolvedValue({
        email: "test@example.com",
        name: "Test",
      });
      mockGetPrivateKey.mockResolvedValue("key");
      mockSha256.mockResolvedValue("password");
      await service.checkStatus();

      expect(service.isReady).toBe(true);

      // Now reset
      service.reset();

      expect(service.googleDriveLoggedIn).toBe(false);
      expect(service.networkLoggedIn).toBe(false);
      expect(service.userEmail).toBeNull();
      expect(service.userName).toBeNull();
      expect(service.derivedPassword).toBeNull();
      expect(service.isReady).toBe(false);
    });
  });

  describe("isReady", () => {
    it("should return true only when both services are logged in", async () => {
      expect(service.isReady).toBe(false);

      // Only Google Drive
      mockIsGoogleDriveLoggedIn.mockResolvedValue(true);
      mockIsPqpLoggedIn.mockResolvedValue(false);
      mockGetGoogleUserInfo.mockResolvedValue({ email: "test@example.com" });
      await service.checkStatus();
      expect(service.isReady).toBe(false);

      // Both services
      mockIsPqpLoggedIn.mockResolvedValue(true);
      mockGetPrivateKey.mockResolvedValue("key");
      mockSha256.mockResolvedValue("pass");
      await service.checkStatus();
      expect(service.isReady).toBe(true);
    });
  });
});
