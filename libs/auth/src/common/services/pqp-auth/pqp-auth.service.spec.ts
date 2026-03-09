import {
  isLoggedIn,
  getGoogleUserInfo,
  login,
  localStateRepository,
  sha256,
} from "@ovrlab/pqp-network";

import { PqpAuthService, PqpAuthState } from "./pqp-auth.service";

// Mock the @ovrlab/pqp-network module
jest.mock("@ovrlab/pqp-network", () => ({
  isLoggedIn: jest.fn(),
  getGoogleUserInfo: jest.fn(),
  login: jest.fn(),
  localStateRepository: {
    getPrivateKey: jest.fn(),
  },
  sha256: jest.fn(),
}));

const mockIsPqpLoggedIn = isLoggedIn as jest.Mock;
const mockGetGoogleUserInfo = getGoogleUserInfo as jest.Mock;
const mockPqpLogin = login as jest.Mock;
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
    it("should check PqP login status", async () => {
      mockIsPqpLoggedIn.mockResolvedValue(false);

      const state = await service.checkStatus();

      expect(mockIsPqpLoggedIn).toHaveBeenCalled();
      expect(state.networkLoggedIn).toBe(false);
    });

    it("should fetch user info and derive password when logged in", async () => {
      mockIsPqpLoggedIn.mockResolvedValue(true);
      mockGetGoogleUserInfo.mockResolvedValue({
        email: "test@example.com",
      });
      mockGetPrivateKey.mockResolvedValue("mock-private-key");
      mockSha256.mockResolvedValue("derived-password-hash");

      const state = await service.checkStatus();

      expect(mockIsPqpLoggedIn).toHaveBeenCalled();
      expect(mockGetGoogleUserInfo).toHaveBeenCalled();
      expect(mockGetPrivateKey).toHaveBeenCalled();
      expect(mockSha256).toHaveBeenCalledWith("mock-private-key");

      expect(state.networkLoggedIn).toBe(true);
      expect(state.userEmail).toBe("test@example.com");
      expect(state.hasDerivedPassword).toBe(true);
      expect(state.isReady).toBe(true);
    });

    it("should clear stale data when logged out", async () => {
      // First, log in
      mockIsPqpLoggedIn.mockResolvedValue(true);
      mockGetGoogleUserInfo.mockResolvedValue({ email: "test@example.com" });
      mockGetPrivateKey.mockResolvedValue("key");
      mockSha256.mockResolvedValue("password");
      await service.checkStatus();
      expect(service.userEmail).toBe("test@example.com");

      // Now simulate logout
      mockIsPqpLoggedIn.mockResolvedValue(false);
      const state = await service.checkStatus();

      expect(state.networkLoggedIn).toBe(false);
      expect(state.userEmail).toBeNull();
      expect(state.hasDerivedPassword).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      mockIsPqpLoggedIn.mockRejectedValue(new Error("Network error"));

      const state = await service.checkStatus();

      // Should not throw, just return default state
      expect(state.networkLoggedIn).toBe(false);
    });
  });

  describe("loginToPqpNetwork", () => {
    // Note: loginToPqpNetwork involves window events which are hard to fully test in JSDOM without more setup.
    // We'll test the basic invocation.

    it("should call pqpLogin", async () => {
      // interactions with window.addEventListener are implicit here or need spyOn
      const addEventListenerSpy = jest.spyOn(window, "addEventListener");
      void service.loginToPqpNetwork();

      expect(mockPqpLogin).toHaveBeenCalled();
      expect(addEventListenerSpy).toHaveBeenCalledWith("focus", expect.any(Function));

      // Cleanup to resolve the promise (simulating closure or toggle)
      // Since we can't easily trigger the exact logic inside the opaque promise without more hooks,
      // we might just let it float or mock the implementation of loginToPqpNetwork if we wanted to test the service logic itself.
      // But here we are unit testing the service method.
      // We can manually trigger the focus handler if we extract it, but it's defined inside closure.
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
      mockGetGoogleUserInfo.mockResolvedValue({
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
      mockGetGoogleUserInfo.mockResolvedValue({ email: "test@example.com" });
      mockGetPrivateKey.mockResolvedValue("key");
      mockSha256.mockResolvedValue("password");
      await service.checkStatus();

      expect(service.isReady).toBe(true);
    });
  });
});
