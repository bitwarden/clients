import { TestBed } from "@angular/core/testing";
import { Subject } from "rxjs";

import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";

import { AGENT_ACCESS_COMMAND } from "../../agent-access/agent-access.messages";

import { AgentAccessService } from "./agent-access.service";

describe("AgentAccessService (hybrid)", () => {
  let service: AgentAccessService;
  let messageSender: jest.Mocked<MessageSender>;
  let storageService: jest.Mocked<AbstractStorageService>;
  let messageSubject: Subject<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    messageSubject = new Subject();

    messageSender = {
      send: jest.fn(),
    } as any;

    const messageListener = {
      messages$: jest.fn().mockReturnValue(messageSubject.asObservable()),
    } as any;

    storageService = {
      get: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      has: jest.fn().mockResolvedValue(false),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        AgentAccessService,
        { provide: MessageSender, useValue: messageSender },
        { provide: MessageListener, useValue: messageListener },
        { provide: AbstractStorageService, useValue: storageService },
      ],
    });

    service = TestBed.inject(AgentAccessService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  // ---------------------------------------------------------------------------
  // Helper to simulate background response
  // ---------------------------------------------------------------------------

  function respondToNextCommand(result?: any, error?: string): void {
    const sendCall = messageSender.send.mock.calls.find((call) => call[0] === AGENT_ACCESS_COMMAND);
    if (!sendCall) {
      throw new Error("No AGENT_ACCESS_COMMAND was sent");
    }
    const requestId = sendCall[1].requestId;
    messageSubject.next({ requestId, result, error });
  }

  // ---------------------------------------------------------------------------
  // Direct storage reads
  // ---------------------------------------------------------------------------

  describe("listSessions", () => {
    it("should read sessions from storage", async () => {
      storageService.get.mockResolvedValue({
        abc: {
          fingerprint: [1, 2],
          name: "Test",
          createdAt: 0,
          lastConnected: 0,
          transportState: null,
        },
      });
      const result = await service.listSessions();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Test");
      expect(messageSender.send).not.toHaveBeenCalled();
    });
  });

  describe("listening toggle", () => {
    it("should read from storage directly", async () => {
      storageService.get.mockResolvedValue(false);
      const result = await service.getListeningEnabled();
      expect(result).toBe(false);
      expect(messageSender.send).not.toHaveBeenCalled();
    });

    it("should save to storage directly", async () => {
      await service.setListeningEnabled(false);
      expect(storageService.save).toHaveBeenCalledWith("agent_access_listening_enabled", false);
    });
  });

  // ---------------------------------------------------------------------------
  // WASM operations (messaging)
  // ---------------------------------------------------------------------------

  describe("getPskToken", () => {
    it("should send getPskToken command with name", async () => {
      const promise = service.getPskToken("My Agent");
      respondToNextCommand("psk-token-123");
      const result = await promise;

      expect(messageSender.send).toHaveBeenCalledWith(
        AGENT_ACCESS_COMMAND,
        expect.objectContaining({ type: "getPskToken", name: "My Agent" }),
      );
      expect(result).toBe("psk-token-123");
    });
  });

  describe("getRendezvousToken", () => {
    it("should send getRendezvousToken command", async () => {
      const promise = service.getRendezvousToken();
      respondToNextCommand("ABCDEF");
      const result = await promise;

      expect(messageSender.send).toHaveBeenCalledWith(
        AGENT_ACCESS_COMMAND,
        expect.objectContaining({ type: "getRendezvousToken" }),
      );
      expect(result).toBe("ABCDEF");
    });
  });

  describe("verifyFingerprint", () => {
    it("should send verifyFingerprint command", async () => {
      const promise = service.verifyFingerprint("req-0", true, "My Device");
      respondToNextCommand();
      await promise;

      expect(messageSender.send).toHaveBeenCalledWith(
        AGENT_ACCESS_COMMAND,
        expect.objectContaining({
          type: "verifyFingerprint",
          sdkRequestId: "req-0",
          approved: true,
          name: "My Device",
        }),
      );
    });
  });

  describe("respondToCredential", () => {
    it("should send respondToCredential command when approved", async () => {
      const credential = {
        credentialId: "cipher-1",
        username: "user",
        password: "pass",
        domain: "example.com",
      };
      const promise = service.respondToCredential("req-1", true, credential);
      respondToNextCommand();
      await promise;

      expect(messageSender.send).toHaveBeenCalledWith(
        AGENT_ACCESS_COMMAND,
        expect.objectContaining({
          type: "respondToCredential",
          approved: true,
          credential,
        }),
      );
    });
  });

  describe("lookupCredentials", () => {
    it("should send lookupCredentials command and return result", async () => {
      const matches = [
        { cipherId: "c1", name: "Login", username: "admin", uri: "https://example.com" },
      ];
      const promise = service.lookupCredentials("example.com");
      respondToNextCommand(matches);
      const result = await promise;

      expect(messageSender.send).toHaveBeenCalledWith(
        AGENT_ACCESS_COMMAND,
        expect.objectContaining({ type: "lookupCredentials", domain: "example.com" }),
      );
      expect(result).toEqual(matches);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe("error handling", () => {
    it("should throw when background returns an error", async () => {
      const promise = service.startListening();
      respondToNextCommand(undefined, "No active account");

      await expect(promise).rejects.toThrow("No active account");
    });
  });

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  describe("disconnect", () => {
    it("should send disconnect command", async () => {
      const promise = service.disconnect();
      respondToNextCommand();
      await promise;

      expect(messageSender.send).toHaveBeenCalledWith(
        AGENT_ACCESS_COMMAND,
        expect.objectContaining({ type: "disconnect" }),
      );
    });
  });
});
