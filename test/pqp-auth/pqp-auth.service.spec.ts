import {
  isLoggedIn as isPqpLoggedIn,
  getUserInfo,
  authenticationService,
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
  authenticationService: {
    derivePasswordForBitwarden: jest.fn(),
    withPassword: jest.fn(),
  },
  ServiceLocator: {
    getMessaging: jest.fn(),
  },
}));

const mockIsPqpLoggedIn = isPqpLoggedIn as jest.Mock;
const mockGetUserInfo = getUserInfo as jest.Mock;
const mockDerivePassword = authenticationService.derivePasswordForBitwarden as jest.Mock;
const mockWithPassword = authenticationService.withPassword as jest.Mock;
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
      expect(service.isReady).toBe(false);
    });
  });

  describe("getState", () => {
    it("should return current state object", () => {
      const state = service.getState();

      expect(state).toEqual({
        networkLoggedIn: false,
        userEmail: null,
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

      const state = await service.checkStatus();

      expect(mockMessaging.sendWithResponse).toHaveBeenCalledWith("CHECK_STATUS");
      expect(state.networkLoggedIn).toBe(true);
    });

    it("should fetch user info when logged in", async () => {
      mockIsPqpLoggedIn.mockResolvedValue(true);
      mockGetUserInfo.mockResolvedValue({
        email: "test@example.com",
      });

      const state = await service.checkStatus();

      expect(mockGetUserInfo).toHaveBeenCalled();
      expect(state.userEmail).toBe("test@example.com");
      expect(state.isReady).toBe(true);
    });

    it("should clear stale data when logged out", async () => {
      // First, log in
      mockIsPqpLoggedIn.mockResolvedValue(true);
      mockGetUserInfo.mockResolvedValue({ email: "test@example.com" });
      await service.checkStatus();
      expect(service.userEmail).toBe("test@example.com");

      // Now simulate logout
      mockIsPqpLoggedIn.mockResolvedValue(false);
      const state = await service.checkStatus();

      expect(state.userEmail).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      mockIsPqpLoggedIn.mockRejectedValue(new Error("Network error"));

      const state = await service.checkStatus();

      // Should not throw, resets state
      expect(state.networkLoggedIn).toBe(false);
      expect(state.userEmail).toBeNull();
    });
  });

  describe("canDerivePassword", () => {
    it("should return true when password can be derived", async () => {
      mockDerivePassword.mockResolvedValue("hashed-password");

      const result = await service.canDerivePassword();

      expect(mockDerivePassword).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should return false if derivation fails", async () => {
      mockDerivePassword.mockRejectedValue(new Error("Derivation error"));

      const result = await service.canDerivePassword();

      expect(result).toBe(false);
    });
  });

  describe("withDerivedPassword", () => {
    it("should pass password to callback via authenticationService.withPassword", async () => {
      mockWithPassword.mockImplementation(async (cb: (pw: string) => Promise<string>) =>
        cb("hashed-password"),
      );

      const result = await service.withDerivedPassword(async (pw) => {
        return pw + "-used";
      });

      expect(mockWithPassword).toHaveBeenCalled();
      expect(result).toBe("hashed-password-used");
    });

    it("should throw when derivation fails", async () => {
      mockWithPassword.mockRejectedValue(new Error("Not logged in"));

      await expect(service.withDerivedPassword(async () => "anything")).rejects.toThrow(
        "Not logged in",
      );
    });
  });

  describe("buildPqpLoginCredentials", () => {
    it("should build credentials using withPassword", async () => {
      mockWithPassword.mockImplementation(async (cb: (pw: string) => Promise<any>) =>
        cb("hashed-password"),
      );

      const credentials = await service.buildPqpLoginCredentials("test@example.com");

      expect(mockWithPassword).toHaveBeenCalled();
      expect(credentials.email).toBe("test@example.com");
      expect(credentials.masterPassword).toBe("hashed-password");
    });

    it("should throw when password derivation fails", async () => {
      mockWithPassword.mockRejectedValue(new Error("Cannot derive"));

      await expect(service.buildPqpLoginCredentials("test@example.com")).rejects.toThrow(
        "Cannot derive",
      );
    });
  });

  describe("reset", () => {
    it("should reset all state to initial values", async () => {
      // First, set some state
      mockIsPqpLoggedIn.mockResolvedValue(true);
      mockGetUserInfo.mockResolvedValue({
        email: "test@example.com",
      });
      await service.checkStatus();

      expect(service.isReady).toBe(true);

      // Now reset
      service.reset();

      expect(service.networkLoggedIn).toBe(false);
      expect(service.userEmail).toBeNull();
      expect(service.isReady).toBe(false);
    });
  });

  describe("isReady", () => {
    it("should return true when network is logged in", async () => {
      expect(service.isReady).toBe(false);

      mockIsPqpLoggedIn.mockResolvedValue(true);
      mockGetUserInfo.mockResolvedValue({ email: "test@example.com" });
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
