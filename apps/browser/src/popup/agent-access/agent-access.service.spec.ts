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
const mockGetPskToken = jest.fn().mockResolvedValue("psk-token-123");
const mockGetRendezvousToken = jest.fn().mockResolvedValue("ABCDEF");
const mockGetIdentityData = jest.fn(() => [1, 2, 3, 4]);
const mockSendResponse = jest.fn();

function MockUserClient() {
  return {
    connect: mockConnect,
    set_audit_callback: mockSetAuditCallback,
    get_psk_token: mockGetPskToken,
    get_rendezvous_token: mockGetRendezvousToken,
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
    it("should get identity from identity service and connect", async () => {
      await service.startListening();

      expect(identityService.getIdentity).toHaveBeenCalledWith("user-1");
      expect(mockConnect).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Token generation
  // ---------------------------------------------------------------------------

  describe("getPskToken", () => {
    it("should call WASM get_psk_token", async () => {
      await service.startListening();
      const token = await service.getPskToken("My Agent");

      expect(mockGetPskToken).toHaveBeenCalledWith("My Agent");
      expect(token).toBe("psk-token-123");
    });
  });

  describe("getRendezvousToken", () => {
    it("should call WASM get_rendezvous_token", async () => {
      await service.startListening();
      const code = await service.getRendezvousToken();

      expect(mockGetRendezvousToken).toHaveBeenCalledWith(null);
      expect(code).toBe("ABCDEF");
    });
  });

  // ---------------------------------------------------------------------------
  // Response methods
  // ---------------------------------------------------------------------------

  describe("verifyFingerprint", () => {
    it("should send verify response with request_id", async () => {
      await service.startListening();

      await service.verifyFingerprint("req-0", true, "My Device");

      expect(mockSendResponse).toHaveBeenCalledWith({
        type: "verify_fingerprint",
        request_id: "req-0",
        approved: true,
        name: "My Device",
      });
    });

    it("should not include name when not provided", async () => {
      await service.startListening();

      await service.verifyFingerprint("req-1", false);

      expect(mockSendResponse).toHaveBeenCalledWith({
        type: "verify_fingerprint",
        request_id: "req-1",
        approved: false,
      });
    });

    it("should be a no-op when client is null", async () => {
      await service.verifyFingerprint("req-0", true);
      expect(mockSendResponse).not.toHaveBeenCalled();
    });
  });

  describe("respondToCredential", () => {
    it("should send credential response when approved", async () => {
      await service.startListening();

      const credential = {
        credentialId: "cipher-1",
        username: "user",
        password: "pass",
        domain: "example.com",
      };
      await service.respondToCredential("req-1", true, credential);

      expect(mockSendResponse).toHaveBeenCalledWith({
        type: "respond_credential",
        request_id: "req-1",
        approved: true,
        credential,
        credential_id: "cipher-1",
      });
    });

    it("should omit credential when denied", async () => {
      await service.startListening();

      await service.respondToCredential("req-1", false);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          approved: false,
          credential: undefined,
          credential_id: undefined,
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
