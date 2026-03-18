import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { AgentAccessIdentityService } from "./agent-access-identity.service";
import { AgentAccessService } from "./agent-access.service";

// ---------------------------------------------------------------------------
// Mock @bitwarden/sdk-internal
// ---------------------------------------------------------------------------

const mockSignProxyChallenge = jest.fn(() => "signed");
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockSetAuditCallback = jest.fn();
const mockEnableRendezvous = jest.fn();
const mockEnablePsk = jest.fn();
const mockListenCachedOnly = jest.fn();
const mockGetIdentityData = jest.fn(() => [1, 2, 3, 4]);
const mockSendResponse = jest.fn();

function MockUserClient() {
  return {
    connect: mockConnect,
    set_audit_callback: mockSetAuditCallback,
    enable_rendezvous: mockEnableRendezvous,
    enable_psk: mockEnablePsk,
    listen_cached_only: mockListenCachedOnly,
    get_identity_data: mockGetIdentityData,
    send_response: mockSendResponse,
  };
}
MockUserClient.sign_proxy_challenge = mockSignProxyChallenge;

jest.mock("@bitwarden/sdk-internal", () => ({
  UserClient: MockUserClient,
}));

// Mock BrowserProxyClient
jest.mock("./proxy-client", () => ({
  BrowserProxyClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    request_rendezvous: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe("AgentAccessService", () => {
  let service: AgentAccessService;
  let storageService: jest.Mocked<AbstractStorageService>;
  let cipherService: jest.Mocked<CipherService>;
  let identityService: jest.Mocked<AgentAccessIdentityService>;

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

    identityService = {
      getIdentity: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
    } as any;

    const accountService = {
      activeAccount$: of({ id: "user-1" }),
    } as any;

    const environmentService = {} as any;

    TestBed.configureTestingModule({
      providers: [
        AgentAccessService,
        { provide: AbstractStorageService, useValue: storageService },
        { provide: CipherService, useValue: cipherService },
        { provide: AccountService, useValue: accountService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: AgentAccessIdentityService, useValue: identityService },
      ],
    });

    service = TestBed.inject(AgentAccessService);
  });

  // ---------------------------------------------------------------------------
  // Identity loading via identity service
  // ---------------------------------------------------------------------------

  describe("startListening", () => {
    it("should get identity from identity service", async () => {
      mockEnableRendezvous.mockResolvedValue(undefined);

      await service.startListening("rendezvous");

      expect(identityService.getIdentity).toHaveBeenCalledWith("user-1");
      expect(mockConnect).toHaveBeenCalled();
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
    it("should send verify response", async () => {
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

      const credential = {
        credentialId: "cipher-1",
        username: "user",
        password: "pass",
        domain: "example.com",
      };
      const query = { domain: "example.com" };
      await service.respondToCredential("req-1", "sess-1", true, credential, query);

      expect(mockSendResponse).toHaveBeenCalledWith({
        type: "respond_credential",
        request_id: "req-1",
        session_id: "sess-1",
        query: { domain: "example.com" },
        approved: true,
        credential,
        credential_id: "cipher-1",
      });
    });

    it("should omit credential when denied", async () => {
      mockEnableRendezvous.mockResolvedValue(undefined);
      await service.startListening("rendezvous");

      const query = { domain: "example.com" };
      await service.respondToCredential("req-1", "sess-1", false, undefined, query);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          approved: false,
          credential: undefined,
          credential_id: undefined,
          query: { domain: "example.com" },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Credential lookup
  // ---------------------------------------------------------------------------

  describe("lookupCredentials", () => {
    it("should return matching credentials from vault", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        {
          id: "cipher-1",
          name: "Example Login",
          login: {
            username: "admin",
            password: "secret",
            totp: "TOTP123",
            uris: [{ uri: "https://example.com" }],
          },
        },
      ] as any);

      const result = await service.lookupCredentials("example.com");

      expect(result).toEqual([
        {
          cipherId: "cipher-1",
          name: "Example Login",
          username: "admin",
          uri: "https://example.com",
        },
      ]);
    });

    it("should return empty array when no ciphers match", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([]);

      const result = await service.lookupCredentials("nosite.com");
      expect(result).toEqual([]);
    });

    it("should return empty array when no active account", async () => {
      // Reconfigure with null active account
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AgentAccessService,
          { provide: AbstractStorageService, useValue: storageService },
          { provide: CipherService, useValue: cipherService },
          { provide: AccountService, useValue: { activeAccount$: of(null) } },
          { provide: EnvironmentService, useValue: {} },
          { provide: AgentAccessIdentityService, useValue: identityService },
        ],
      });
      const svcNoAccount = TestBed.inject(AgentAccessService);

      const result = await svcNoAccount.lookupCredentials("example.com");
      expect(result).toEqual([]);
    });

    it("should return empty array on error", async () => {
      cipherService.getAllDecryptedForUrl.mockRejectedValue(new Error("vault locked"));

      const result = await service.lookupCredentials("example.com");
      expect(result).toEqual([]);
    });

    it("should prepend https:// to bare domains", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([]);

      await service.lookupCredentials("example.com");

      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(
        "https://example.com",
        "user-1",
      );
    });

    it("should not prepend https:// to domains starting with http", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([]);

      await service.lookupCredentials("http://example.com");

      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(
        "http://example.com",
        "user-1",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Session storage (via repository)
  // ---------------------------------------------------------------------------

  describe("session management", () => {
    it("should list sessions from repository", async () => {
      const result = await service.listSessions();
      expect(result).toEqual([]);
    });

    it("should remove session by id", async () => {
      await service.removeSession("abc123");
      // Verifies it doesn't throw — actual persistence is via the repository
      expect(storageService.get).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Listening toggle
  // ---------------------------------------------------------------------------

  describe("listening toggle", () => {
    it("should default to true when not set", async () => {
      const result = await service.getListeningEnabled();
      expect(result).toBe(true);
    });

    it("should save listening enabled state", async () => {
      await service.setListeningEnabled(false);

      expect(storageService.save).toHaveBeenCalledWith("agent_access_listening_enabled", false);
    });
  });

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  describe("disconnect", () => {
    it("should be safe to call when not connected", async () => {
      await expect(service.disconnect()).resolves.not.toThrow();
    });
  });
});
