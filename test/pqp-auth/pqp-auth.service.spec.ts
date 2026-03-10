import {
  isLoggedIn as isPqpLoggedIn,
  getUserInfo,
  localStateRepository,
  sha256,
  ServiceLocator,
} from "@ovrlab/pqp-network";

import {
  PqpAuthService,
  PqpAuthState,
} from "../../libs/auth/src/common/services/pqp-auth/pqp-auth.service";

// Mock the @ovrlab/pqp-network module
jest.mock("@ovrlab/pqp-network", () => ({
  isLoggedIn: jest.fn(),
  getUserInfo: jest.fn(),
  login: jest.fn(),
  localStateRepository: {
    getPrivateKey: jest.fn(),
  },
  sha256: jest.fn(),
  ServiceLocator: {
    getMessaging: jest.fn(),
  },
}));

const mockIsPqpLoggedIn = isPqpLoggedIn as jest.Mock;
const mockGetUserInfo = getUserInfo as jest.Mock;
const mockGetPrivateKey = localStateRepository.getPrivateKey as jest.Mock;
const mockSha256 = sha256 as jest.Mock;
const mockGetMessaging = ServiceLocator.getMessaging as jest.Mock;

describe("PqpAuthService", () => {
  let service: PqpAuthService;

  beforeEach(() => {
    service = new PqpAuthService();
    jest.clearAllMocks();
    // Default: getMessaging throws (no messaging available — desktop/fallback path)
    mockGetMessaging.mockImplementation(() => {
      throw new Error("No messaging");
    });
  });

  describe("initial state", () => {
    it("should have all properties set to false/null initially", () => {
      expect(service.networkLoggedIn).toBe(false);
      expect(service.userEmail).toBeNull();
      expect(service.hasDerivedPassword).toBe(false);
      expect(service.isReady).toBe(false);
    });
  });

  describe("getState", () => {
    it("should return current state object", () => {
      const state = service.getState();

      expect(state).toEqual({
        networkLoggedIn: false,
        userEmail: null,
        hasDerivedPassword: false,
        isReady: false,
      } as PqpAuthState);
    });
  });

  describe("checkStatus", () => {
    it("should check PqP login status via direct API when messaging unavailable", async () => {
      mockIsPqpLoggedIn.mockResolvedValue(false);

      const state = await service.checkStatus();

      expect(mockIsPqpLoggedIn).toHaveBeenCalled();
      expect(state.networkLoggedIn).toBe(false);
    });

    it("should check PqP login status via messaging when available", async () => {
      const mockMessaging = {
        sendWithResponse: jest.fn().mockResolvedValue({ loggedIn: true }),
      };
      mockGetMessaging.mockReturnValue(mockMessaging);
      mockGetUserInfo.mockResolvedValue({ email: "test@example.com" });
      mockGetPrivateKey.mockResolvedValue("key");
      mockSha256.mockResolvedValue("hash");

      const state = await service.checkStatus();

      expect(mockMessaging.sendWithResponse).toHaveBeenCalledWith("CHECK_STATUS");
      expect(state.networkLoggedIn).toBe(true);
    });

    it("should fetch user info when logged in", async () => {
      mockIsPqpLoggedIn.mockResolvedValue(true);
      mockGetUserInfo.mockResolvedValue({
        email: "test@example.com",
      });
      mockGetPrivateKey.mockResolvedValue("key");
      mockSha256.mockResolvedValue("hash");

      const state = await service.checkStatus();

      expect(mockGetUserInfo).toHaveBeenCalled();
      expect(state.userEmail).toBe("test@example.com");
    });

    it("should derive password when logged in", async () => {
      mockIsPqpLoggedIn.mockResolvedValue(true);
      mockGetUserInfo.mockResolvedValue({ email: "test@example.com" });
      mockGetPrivateKey.mockResolvedValue("mock-private-key");
      mockSha256.mockResolvedValue("derived-password-hash");

      const state = await service.checkStatus();

      expect(state.isReady).toBe(true);
      expect(mockGetPrivateKey).toHaveBeenCalled();
      expect(mockSha256).toHaveBeenCalledWith("mock-private-key");
      expect(state.hasDerivedPassword).toBe(true);
    });

    it("should clear stale data when logged out", async () => {
      // First, log in
      mockIsPqpLoggedIn.mockResolvedValue(true);
      mockGetUserInfo.mockResolvedValue({ email: "test@example.com" });
      mockGetPrivateKey.mockResolvedValue("key");
      mockSha256.mockResolvedValue("password");
      await service.checkStatus();
      expect(service.userEmail).toBe("test@example.com");

      // Now simulate logout
      mockIsPqpLoggedIn.mockResolvedValue(false);
      const state = await service.checkStatus();

      expect(state.userEmail).toBeNull();
      expect(state.hasDerivedPassword).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      mockIsPqpLoggedIn.mockRejectedValue(new Error("Network error"));

      const state = await service.checkStatus();

      // Should not throw, resets state
      expect(state.networkLoggedIn).toBe(false);
      expect(state.userEmail).toBeNull();
      expect(state.hasDerivedPassword).toBe(false);
    });
  });

  describe("derivePassword", () => {
    it("should derive password from private key using SHA-256", async () => {
      mockGetPrivateKey.mockResolvedValue("my-private-key");
      mockSha256.mockResolvedValue("hashed-password");

      await service.derivePassword();

      expect(mockGetPrivateKey).toHaveBeenCalled();
      expect(mockSha256).toHaveBeenCalledWith("my-private-key");
      expect(service.hasDerivedPassword).toBe(true);
    });

    it("should set hasDerivedPassword to false if no private key", async () => {
      mockGetPrivateKey.mockResolvedValue(null);

      await service.derivePassword();

      expect(service.hasDerivedPassword).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      mockGetPrivateKey.mockRejectedValue(new Error("Storage error"));

      await service.derivePassword();

      expect(service.hasDerivedPassword).toBe(false);
    });
  });

  describe("reset", () => {
    it("should reset all state to initial values", async () => {
      // First, set some state
      mockIsPqpLoggedIn.mockResolvedValue(true);
      mockGetUserInfo.mockResolvedValue({
        email: "test@example.com",
      });
      mockGetPrivateKey.mockResolvedValue("key");
      mockSha256.mockResolvedValue("password");
      await service.checkStatus();

      expect(service.isReady).toBe(true);

      // Now reset
      service.reset();

      expect(service.networkLoggedIn).toBe(false);
      expect(service.userEmail).toBeNull();
      expect(service.hasDerivedPassword).toBe(false);
      expect(service.isReady).toBe(false);
    });
  });

  describe("buildPqpLoginCredentials", () => {
    it("should build credentials when derived password is available", async () => {
      mockGetPrivateKey.mockResolvedValue("my-private-key");
      mockSha256.mockResolvedValue("hashed-password");
      await service.derivePassword();

      const credentials = service.buildPqpLoginCredentials("test@example.com");

      expect(credentials.email).toBe("test@example.com");
      expect(credentials.masterPassword).toBe("hashed-password");
    });

    it("should throw when derived password is not available", () => {
      expect(() => service.buildPqpLoginCredentials("test@example.com")).toThrow(
        "PQP derived password is not available",
      );
    });
  });

  describe("isReady", () => {
    it("should return true when network is logged in", async () => {
      expect(service.isReady).toBe(false);

      mockIsPqpLoggedIn.mockResolvedValue(true);
      mockGetUserInfo.mockResolvedValue({ email: "test@example.com" });
      mockGetPrivateKey.mockResolvedValue("key");
      mockSha256.mockResolvedValue("pass");
      await service.checkStatus();
      expect(service.isReady).toBe(true);
    });

    it("should return false when network is not logged in", async () => {
      mockIsPqpLoggedIn.mockResolvedValue(false);
      await service.checkStatus();
      expect(service.isReady).toBe(false);
    });
  });
});
