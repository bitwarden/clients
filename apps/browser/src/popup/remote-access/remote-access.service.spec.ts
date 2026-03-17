import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { RemoteAccessService } from "./remote-access.service";

// ---------------------------------------------------------------------------
// Mock @bitwarden/sdk-internal
// ---------------------------------------------------------------------------

const mockGenerateIdentity = jest.fn(() => [1, 2, 3, 4]);
const mockSignProxyChallenge = jest.fn(() => "signed");
const mockListen = jest.fn();
const mockEnableRendezvous = jest.fn();
const mockEnablePsk = jest.fn();
const mockListenCachedOnly = jest.fn();
const mockGetSessionData = jest.fn(() => "session-data");
const mockGetIdentityData = jest.fn(() => [1, 2, 3, 4]);
const mockSendResponse = jest.fn();

jest.mock("@bitwarden/sdk-internal", () => ({
  RatUserClient: {
    generate_identity: mockGenerateIdentity,
    sign_proxy_challenge: mockSignProxyChallenge,
    listen: mockListen.mockResolvedValue({
      enable_rendezvous: mockEnableRendezvous,
      enable_psk: mockEnablePsk,
      listen_cached_only: mockListenCachedOnly,
      get_session_data: mockGetSessionData,
      get_identity_data: mockGetIdentityData,
      send_response: mockSendResponse,
    }),
  },
}));

// Mock BrowserRatProxyClient
jest.mock("./rat-proxy-client", () => ({
  BrowserRatProxyClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    request_rendezvous: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe("RemoteAccessService", () => {
  let service: RemoteAccessService;
  let storageService: jest.Mocked<AbstractStorageService>;
  let cipherService: jest.Mocked<CipherService>;

  beforeEach(() => {
    jest.clearAllMocks();

    storageService = {
      get: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      has: jest.fn().mockResolvedValue(false),
    } as any;

    cipherService = {
      getAllDecryptedForUrl: jest.fn().mockResolvedValue([]),
    } as any;

    const accountService = {
      activeAccount$: of({ id: "user-1" }),
    } as any;

    const environmentService = {} as any;

    TestBed.configureTestingModule({
      providers: [
        RemoteAccessService,
        { provide: AbstractStorageService, useValue: storageService },
        { provide: CipherService, useValue: cipherService },
        { provide: AccountService, useValue: accountService },
        { provide: EnvironmentService, useValue: environmentService },
      ],
    });

    service = TestBed.inject(RemoteAccessService);
  });

  // ---------------------------------------------------------------------------
  // Identity generation/loading
  // ---------------------------------------------------------------------------

  describe("startListening", () => {
    it("should generate identity when none is stored", async () => {
      storageService.get.mockResolvedValue(null);
      mockEnableRendezvous.mockResolvedValue(undefined);

      await service.startListening("rendezvous");

      expect(mockGenerateIdentity).toHaveBeenCalled();
      expect(mockListen).toHaveBeenCalled();
    });

    it("should load persisted identity from storage", async () => {
      // Base64 of [10, 20, 30]
      const b64 = btoa(String.fromCharCode(10, 20, 30));
      storageService.get.mockImplementation((key: string) => {
        if (key === "rat_identity") {
          return Promise.resolve(b64);
        }
        return Promise.resolve(null);
      });
      mockEnableRendezvous.mockResolvedValue(undefined);

      await service.startListening("rendezvous");

      // Should NOT generate new identity since one was loaded
      expect(mockGenerateIdentity).not.toHaveBeenCalled();
    });

    it("should persist state after starting", async () => {
      mockEnableRendezvous.mockResolvedValue(undefined);

      await service.startListening("rendezvous");

      expect(storageService.save).toHaveBeenCalledWith("rat_session_cache", "session-data");
      expect(storageService.save).toHaveBeenCalledWith("rat_identity", expect.any(String));
    });

    it("should dispatch to enable_psk for psk mode", async () => {
      mockEnablePsk.mockResolvedValue(undefined);

      await service.startListening("psk");

      expect(mockEnablePsk).toHaveBeenCalled();
      expect(mockEnableRendezvous).not.toHaveBeenCalled();
    });

    it("should dispatch to listen_cached_only for cached mode", async () => {
      mockListenCachedOnly.mockResolvedValue(undefined);

      await service.startListening("cached");

      expect(mockListenCachedOnly).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Response methods
  // ---------------------------------------------------------------------------

  describe("verifyFingerprint", () => {
    it("should send verify response and persist state", async () => {
      mockEnableRendezvous.mockResolvedValue(undefined);
      await service.startListening("rendezvous");

      await service.verifyFingerprint(true, "My Device");

      expect(mockSendResponse).toHaveBeenCalledWith({
        type: "verify_fingerprint",
        approved: true,
        name: "My Device",
      });
    });

    it("should not include name when not provided", async () => {
      mockEnableRendezvous.mockResolvedValue(undefined);
      await service.startListening("rendezvous");

      await service.verifyFingerprint(false);

      expect(mockSendResponse).toHaveBeenCalledWith({
        type: "verify_fingerprint",
        approved: false,
      });
    });

    it("should be a no-op when client is null", async () => {
      await service.verifyFingerprint(true);
      expect(mockSendResponse).not.toHaveBeenCalled();
    });
  });

  describe("respondToCredential", () => {
    it("should send credential response when approved", async () => {
      mockEnableRendezvous.mockResolvedValue(undefined);
      await service.startListening("rendezvous");

      const credential = { username: "user", password: "pass" };
      await service.respondToCredential("req-1", "sess-1", true, credential);

      expect(mockSendResponse).toHaveBeenCalledWith({
        type: "respond_credential",
        request_id: "req-1",
        session_id: "sess-1",
        approved: true,
        credential,
      });
    });

    it("should omit credential when denied", async () => {
      mockEnableRendezvous.mockResolvedValue(undefined);
      await service.startListening("rendezvous");

      await service.respondToCredential("req-1", "sess-1", false);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          approved: false,
          credential: undefined,
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Credential lookup
  // ---------------------------------------------------------------------------

  describe("lookupCredential", () => {
    it("should return matching credential from vault", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        {
          login: {
            username: "admin",
            password: "secret",
            totp: "TOTP123",
            uris: [{ uri: "https://example.com" }],
          },
        },
      ] as any);

      const result = await service.lookupCredential("example.com");

      expect(result).toEqual({
        username: "admin",
        password: "secret",
        totp: "TOTP123",
        uri: "https://example.com",
      });
    });

    it("should return null when no ciphers match", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([]);

      const result = await service.lookupCredential("nosite.com");
      expect(result).toBeNull();
    });

    it("should return null when no active account", async () => {
      // Reconfigure with null active account
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          RemoteAccessService,
          { provide: AbstractStorageService, useValue: storageService },
          { provide: CipherService, useValue: cipherService },
          { provide: AccountService, useValue: { activeAccount$: of(null) } },
          { provide: EnvironmentService, useValue: {} },
        ],
      });
      const svcNoAccount = TestBed.inject(RemoteAccessService);

      const result = await svcNoAccount.lookupCredential("example.com");
      expect(result).toBeNull();
    });

    it("should return null on error", async () => {
      cipherService.getAllDecryptedForUrl.mockRejectedValue(new Error("vault locked"));

      const result = await service.lookupCredential("example.com");
      expect(result).toBeNull();
    });

    it("should prepend https:// to bare domains", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([]);

      await service.lookupCredential("example.com");

      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(
        "https://example.com",
        "user-1",
      );
    });

    it("should not prepend https:// to domains starting with http", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([]);

      await service.lookupCredential("http://example.com");

      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(
        "http://example.com",
        "user-1",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  describe("disconnect", () => {
    it("should clear session cache on disconnect", async () => {
      mockEnableRendezvous.mockResolvedValue(undefined);
      await service.startListening("rendezvous");

      await service.disconnect();

      expect(storageService.remove).toHaveBeenCalledWith("rat_session_cache");
    });

    it("should be safe to call when not connected", async () => {
      await expect(service.disconnect()).resolves.not.toThrow();
    });
  });
});
