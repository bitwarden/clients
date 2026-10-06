/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { ipcMain } from "electron";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { agent_access, passwords } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";

import { MainAgentAccessService, sanitizeWindowsPipeUsername } from "./main-agent-access.service";

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  agent_access: {
    AgentAccessState: {
      serve: jest.fn(),
    },
  },
  passwords: {
    getPassword: jest.fn(),
    setPassword: jest.fn(),
    deletePassword: jest.fn(),
    PASSWORD_NOT_FOUND: "Password not found",
  },
}));

describe("MainAgentAccessService", () => {
  let mockLogService: jest.Mocked<LogService>;
  let mockMessagingService: jest.Mocked<MessagingService>;

  let ipcHandlers: Map<string, Function>;
  let mockAgentState: {
    isRunning: jest.Mock;
    stop: jest.Mock;
    getFingerprint: jest.Mock;
    generatePskToken: jest.Mock;
    generateRendezvousCode: jest.Mock;
    listConnections: jest.Mock;
    removeConnection: jest.Mock;
  };

  let capturedCredentialCb: (
    err: Error | null,
    data: agent_access.CredentialRequestData,
  ) => Promise<agent_access.CredentialResponseData>;
  let capturedFingerprintCb: (
    err: Error | null,
    data: agent_access.FingerprintVerificationData,
  ) => Promise<agent_access.FingerprintVerificationResponse>;
  let capturedStorageGetCb: (err: Error | null, key: string) => Promise<string | null>;
  let capturedStorageSetCb: (err: Error | null, entry: agent_access.StorageEntry) => Promise<void>;
  let capturedEventCb: (
    err: Error | null,
    event: agent_access.AgentAccessEvent,
  ) => Promise<undefined>;

  // Payload of the most recent `messagingService.send` on `channel`. Credential requests now emit
  // an `agentaccess.activity` message alongside `agentaccess.credentialrequest`, so tests have to
  // pick out the channel they mean rather than indexing off the end of the call list.
  const lastMessage = (channel: string) =>
    (mockMessagingService.send as jest.Mock).mock.calls
      .filter((call) => call[0] === channel)
      .at(-1)?.[1];

  const messagesOn = (channel: string) =>
    (mockMessagingService.send as jest.Mock).mock.calls
      .filter((call) => call[0] === channel)
      .map((call) => call[1]);

  beforeEach(async () => {
    ipcHandlers = new Map();

    mockLogService = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warning: jest.fn(),
    } as any;

    mockMessagingService = {
      send: jest.fn(),
    } as any;

    mockAgentState = {
      isRunning: jest.fn().mockReturnValue(true),
      stop: jest.fn(),
      getFingerprint: jest.fn().mockResolvedValue("abc123"),
      generatePskToken: jest.fn().mockResolvedValue("psk-token"),
      generateRendezvousCode: jest.fn().mockResolvedValue("ABC-DEF-GHI"),
      listConnections: jest.fn().mockResolvedValue([]),
      removeConnection: jest.fn().mockResolvedValue(undefined),
    };

    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: Function) => {
      ipcHandlers.set(channel, handler);
    });

    (agent_access.AgentAccessState.serve as jest.Mock).mockImplementation(
      (
        _config: agent_access.AgentAccessConfig,
        credentialCb: Function,
        fingerprintCb: Function,
        storageGetCb: Function,
        storageSetCb: Function,
        eventCb: Function,
      ) => {
        capturedCredentialCb = credentialCb as any;
        capturedFingerprintCb = fingerprintCb as any;
        capturedStorageGetCb = storageGetCb as any;
        capturedStorageSetCb = storageSetCb as any;
        capturedEventCb = eventCb as any;
        return Promise.resolve(mockAgentState);
      },
    );

    new MainAgentAccessService(mockLogService, mockMessagingService);
    await ipcHandlers.get("agentaccess.init")!({}, { relayUrl: "wss://relay.example" });
    await Promise.resolve(); // let agentState settle
  });

  describe("constructor", () => {
    it("should register agentaccess.init IPC handler", () => {
      expect(ipcHandlers.has("agentaccess.init")).toBe(true);
    });

    it("should register agentaccess.isloaded IPC handler", () => {
      expect(ipcHandlers.has("agentaccess.isloaded")).toBe(true);
    });

    it("should register the activity-log IPC handlers", () => {
      expect(ipcHandlers.has("agentaccess.getactivity")).toBe(true);
      expect(ipcHandlers.has("agentaccess.clearactivity")).toBe(true);
    });

    it("should register the grant store IPC handlers independent of INIT/run state", () => {
      expect(ipcHandlers.has("agentaccess.listgrants")).toBe(true);
      expect(ipcHandlers.has("agentaccess.findgrant")).toBe(true);
      expect(ipcHandlers.has("agentaccess.upsertgrant")).toBe(true);
      expect(ipcHandlers.has("agentaccess.removegrant")).toBe(true);
    });
  });

  describe("agentaccess.init IPC handler (registration)", () => {
    it("should register the remaining agentaccess IPC handlers", () => {
      expect(ipcHandlers.has("agentaccess.stop")).toBe(true);
      expect(ipcHandlers.has("agentaccess.getfingerprint")).toBe(true);
      expect(ipcHandlers.has("agentaccess.generatepsktoken")).toBe(true);
      expect(ipcHandlers.has("agentaccess.generaterendezvouscode")).toBe(true);
      expect(ipcHandlers.has("agentaccess.listconnections")).toBe(true);
      expect(ipcHandlers.has("agentaccess.removeconnection")).toBe(true);
      expect(ipcHandlers.has("agentaccess.credentialrequestresponse")).toBe(true);
      expect(ipcHandlers.has("agentaccess.fingerprintresponse")).toBe(true);
    });

    it("should not re-register handlers on a second INIT call", async () => {
      const handleCallCount = (ipcMain.handle as jest.Mock).mock.calls.length;

      await ipcHandlers.get("agentaccess.init")!({}, { relayUrl: "wss://relay.example" });

      expect((ipcMain.handle as jest.Mock).mock.calls.length).toBe(handleCallCount);
    });

    // A second INIT while the server is already running must not call serve() again: two
    // concurrent/redundant INITs (the renderer doesn't trust its own "not already running" check
    // across the IPC boundary) would otherwise orphan the first live server — its relay connection
    // and napi callbacks stay registered — and race the second instance for the same keychain keys
    // and local socket/pipe.
    it("should not call serve a second time when INIT is invoked again while already running", async () => {
      const serveCallCount = (agent_access.AgentAccessState.serve as jest.Mock).mock.calls.length;

      await ipcHandlers.get("agentaccess.init")!({}, { relayUrl: "wss://relay.example" });

      expect(agent_access.AgentAccessState.serve).toHaveBeenCalledTimes(serveCallCount);
    });

    it("should call serve again after STOP has cleared the previous agent state", async () => {
      await ipcHandlers.get("agentaccess.stop")!({});
      const serveCallCount = (agent_access.AgentAccessState.serve as jest.Mock).mock.calls.length;

      await ipcHandlers.get("agentaccess.init")!({}, { relayUrl: "wss://relay.example" });

      expect(agent_access.AgentAccessState.serve).toHaveBeenCalledTimes(serveCallCount + 1);
    });

    it("should call agent_access.AgentAccessState.serve with the relay URL, a default local socket path, and callbacks", () => {
      expect(agent_access.AgentAccessState.serve).toHaveBeenCalledWith(
        {
          relayUrl: "wss://relay.example",
          socketPath: expect.any(String),
        },
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      );
    });

    it("should compute a socket path independent of the userData dir", () => {
      const [config] = (agent_access.AgentAccessState.serve as jest.Mock).mock.calls[0];
      if (process.platform === "win32") {
        expect(config.socketPath).toMatch(/^\\\\\.\\pipe\\bitwarden\.agent-access\.[\w-]+$/);
      } else {
        expect(config.socketPath).toMatch(/\.bitwarden-agent-access\.sock$/);
      }
    });

    it("should log success after serve resolves", () => {
      expect(mockLogService.info).toHaveBeenCalledWith("Agent Access server started");
    });

    it("should log an error if serve rejects", async () => {
      const error = new Error("napi bind failed");
      (agent_access.AgentAccessState.serve as jest.Mock).mockRejectedValueOnce(error);

      new MainAgentAccessService(mockLogService, mockMessagingService);
      const initHandler = ipcHandlers.get("agentaccess.init")!;
      await expect(initHandler({}, { relayUrl: "wss://relay.example" })).rejects.toThrow(
        "napi bind failed",
      );

      expect(mockLogService.error).toHaveBeenCalledWith(
        "Agent Access server encountered an error: ",
        error,
      );
    });

    // Previously the catch block swallowed the rejection and let INIT resolve successfully, so
    // the renderer believed the server had started (an unbindable socket, a bad relay URL, ...)
    // when it hadn't. The rejection must propagate through `ipcMain.handle` so the renderer's own
    // `await ipc.agentAccess.init(...)` sees it.
    it("should reject the INIT call itself when serve rejects, not just log", async () => {
      const error = new Error("napi bind failed");
      (agent_access.AgentAccessState.serve as jest.Mock).mockRejectedValueOnce(error);

      new MainAgentAccessService(mockLogService, mockMessagingService);
      const initHandler = ipcHandlers.get("agentaccess.init")!;

      await expect(initHandler({}, { relayUrl: "wss://relay.example" })).rejects.toBe(error);
    });

    // A rejected INIT must not leave the guard from the "already running" test above permanently
    // blocking retries: `agentState` was never assigned, so a subsequent INIT should attempt
    // serve() again rather than treating the failed attempt as "already running".
    it("should allow a retry (calling serve again) after a prior INIT rejected", async () => {
      const error = new Error("napi bind failed");
      (agent_access.AgentAccessState.serve as jest.Mock).mockRejectedValueOnce(error);

      const service = new MainAgentAccessService(mockLogService, mockMessagingService);
      void service;
      const initHandler = ipcHandlers.get("agentaccess.init")!;
      await expect(initHandler({}, { relayUrl: "wss://relay.example" })).rejects.toThrow();

      const serveCallCount = (agent_access.AgentAccessState.serve as jest.Mock).mock.calls.length;
      await initHandler({}, { relayUrl: "wss://relay.example" });

      expect(agent_access.AgentAccessState.serve).toHaveBeenCalledTimes(serveCallCount + 1);
    });
  });

  describe("agentaccess.isloaded IPC handler", () => {
    it("should return false before agentaccess.init has resolved", async () => {
      new MainAgentAccessService(mockLogService, mockMessagingService);
      const handler = ipcHandlers.get("agentaccess.isloaded")!;
      expect(await handler({})).toBe(false);
    });

    it("should return agentState.isRunning() after init resolves", async () => {
      const handler = ipcHandlers.get("agentaccess.isloaded")!;
      expect(await handler({})).toBe(true);
    });

    it("should return false after agentaccess.stop is called", async () => {
      await ipcHandlers.get("agentaccess.stop")!({});
      const handler = ipcHandlers.get("agentaccess.isloaded")!;
      expect(await handler({})).toBe(false);
    });
  });

  describe("activity log", () => {
    const mockEvent: agent_access.AgentAccessEvent = {
      kind: "connection_established",
      timestampMs: "1700000000000",
      peerFingerprint: "fp-1",
      peerName: "My Laptop",
      detail: "rendezvous",
    };

    const getActivity = () => ipcHandlers.get("agentaccess.getactivity")!({});
    const clearActivity = () => ipcHandlers.get("agentaccess.clearactivity")!({});

    it("should return an empty buffer before anything has been recorded", async () => {
      expect(await getActivity()).toEqual([]);
    });

    it("should record a Rust lifecycle event as a lifecycle entry and push it to the renderer", async () => {
      await capturedEventCb(null, mockEvent);

      expect(await getActivity()).toEqual([
        {
          type: "lifecycle",
          id: expect.any(String),
          timestampMs: "1700000000000",
          agentName: "My Laptop",
          agentFingerprint: "fp-1",
          kind: "connection_established",
          detail: "rendezvous",
        },
      ]);
      expect(mockMessagingService.send).toHaveBeenCalledWith("agentaccess.activity", {
        entry: expect.objectContaining({ type: "lifecycle", kind: "connection_established" }),
      });
    });

    // Rust emits its own credential audit events for the same requests this service tracks with a
    // far richer entry; buffering both would render every request twice.
    it.each(["credential_requested", "credential_approved", "credential_denied"])(
      "should drop the Rust %s event in favor of its own credential_request entry",
      async (kind) => {
        await capturedEventCb(null, { ...mockEvent, kind });

        expect(await getActivity()).toEqual([]);
      },
    );

    it("should never throw from the event callback, even if forwarding fails", async () => {
      mockMessagingService.send.mockImplementationOnce(() => {
        throw new Error("boom");
      });

      await expect(capturedEventCb(null, mockEvent)).resolves.toBeUndefined();
    });

    it("should give each lifecycle entry a distinct id, even within the same millisecond", async () => {
      await capturedEventCb(null, mockEvent);
      await capturedEventCb(null, mockEvent);

      const [first, second] = await getActivity();
      expect(first.id).not.toEqual(second.id);
    });

    it("should return entries oldest to newest via agentaccess.getactivity", async () => {
      await capturedEventCb(null, mockEvent);
      await capturedEventCb(null, { ...mockEvent, kind: "session_refreshed" });

      const buffered = await getActivity();
      expect(buffered.map((entry: any) => entry.kind)).toEqual([
        "connection_established",
        "session_refreshed",
      ]);
    });

    it("should cap the buffer at 200 entries, dropping the oldest first", async () => {
      for (let i = 0; i < 205; i++) {
        await capturedEventCb(null, { ...mockEvent, detail: `event-${i}` });
      }

      const buffered = await getActivity();
      expect(buffered).toHaveLength(200);
      expect(buffered[0].detail).toBe("event-5");
      expect(buffered[199].detail).toBe("event-204");
    });

    describe("clearing", () => {
      const shareOneCredential = async () => {
        const credentialPromise = capturedCredentialCb(null, {
          queryType: "domain",
          queryValue: "example.com",
          requesterFingerprint: "fp-1",
          requesterName: "Test Agent",
          origin: "relay",
        });
        const { requestId } = lastMessage("agentaccess.credentialrequest");
        await ipcHandlers.get("agentaccess.credentialrequestresponse")!(
          {},
          {
            requestId,
            response: { approved: true, username: "u", password: "p" },
            outcome: { status: "shared", cipherId: "cipher-1", fieldsShared: ["username"] },
          },
        );
        await credentialPromise;
      };

      // Only the released item's id is recorded, so there is no decrypted name to survive a lock
      // and nothing lock-scoped to clear — see `CredentialRequestActivity`.
      it("should record the released item by id, never by name", async () => {
        await shareOneCredential();

        const [entry] = await getActivity();
        expect(entry).toMatchObject({ status: "shared", cipherId: "cipher-1" });
        expect(entry).not.toHaveProperty("cipherName");
      });

      it("should drop every entry when the account changes", async () => {
        await shareOneCredential();
        await capturedEventCb(null, mockEvent);

        await clearActivity();

        expect(await getActivity()).toEqual([]);
      });

      it("should tell the renderer to re-fetch after clearing", async () => {
        await clearActivity();

        expect(mockMessagingService.send).toHaveBeenCalledWith("agentaccess.activityreset", {});
      });
    });
  });

  describe("credential request correlation", () => {
    const mockCredentialData: agent_access.CredentialRequestData = {
      // CredentialQueryType/CredentialRequestOrigin/DeliveryMode are `const enum`s in the
      // ambient napi `.d.ts` with no runtime JS object backing them (the Rust side just sends
      // plain strings), so tests use literal strings rather than referencing the (non-existent
      // at runtime) enum members.
      queryType: "domain",
      queryValue: "example.com",
      requesterFingerprint: "fp-1",
      requesterName: "Test Agent",
      origin: "relay",
    };

    it("should send agentaccess.credentialrequest with a correlated requestId", () => {
      void capturedCredentialCb(null, mockCredentialData);

      expect(mockMessagingService.send).toHaveBeenCalledWith("agentaccess.credentialrequest", {
        requestId: expect.any(Number),
        queryType: "domain",
        queryValue: "example.com",
        requesterFingerprint: "fp-1",
        requesterName: "Test Agent",
        origin: "relay",
        localPeer: undefined,
        deliveryMode: undefined,
        resourceType: "credential",
        operation: "request",
        newSecretName: undefined,
        newSecretValue: undefined,
        newSecretNote: undefined,
        projectHint: undefined,
      });
    });

    it("should forward origin, localPeer, and deliveryMode for a local request", () => {
      const localCredentialData: agent_access.CredentialRequestData = {
        queryType: "domain",
        queryValue: "example.com",
        requesterFingerprint: undefined,
        requesterName: undefined,
        origin: "local",
        localPeer: { pid: 4242, processName: "cursor", exePath: "/Applications/Cursor.app" },
        deliveryMode: "inject",
      };

      void capturedCredentialCb(null, localCredentialData);

      expect(mockMessagingService.send).toHaveBeenCalledWith("agentaccess.credentialrequest", {
        requestId: expect.any(Number),
        queryType: "domain",
        queryValue: "example.com",
        requesterFingerprint: undefined,
        requesterName: undefined,
        origin: "local",
        localPeer: { pid: 4242, processName: "cursor", exePath: "/Applications/Cursor.app" },
        deliveryMode: "inject",
        resourceType: "credential",
        operation: "request",
        newSecretName: undefined,
        newSecretValue: undefined,
        newSecretNote: undefined,
        projectHint: undefined,
      });
    });

    it("should resolve with the renderer's response when credentialrequestresponse arrives", async () => {
      const credentialPromise = capturedCredentialCb(null, mockCredentialData);
      const { requestId } = lastMessage("agentaccess.credentialrequest");

      const responseHandler = ipcHandlers.get("agentaccess.credentialrequestresponse")!;
      const response: agent_access.CredentialResponseData = { approved: true, username: "u" };
      await responseHandler({}, { requestId, response });

      expect(await credentialPromise).toEqual(response);
    });

    it("should correlate two concurrent credential requests independently", async () => {
      const first = capturedCredentialCb(null, mockCredentialData);
      const second = capturedCredentialCb(null, mockCredentialData);
      const [firstId, secondId] = messagesOn("agentaccess.credentialrequest")
        .slice(-2)
        .map((message) => message.requestId);

      const responseHandler = ipcHandlers.get("agentaccess.credentialrequestresponse")!;
      await responseHandler({}, { requestId: secondId, response: { approved: false } });
      await responseHandler({}, { requestId: firstId, response: { approved: true } });

      expect(await first).toEqual({ approved: true });
      expect(await second).toEqual({ approved: false });
    });

    describe("activity entries", () => {
      const getActivity = () => ipcHandlers.get("agentaccess.getactivity")!({});
      const respond = (requestId: number, body: Record<string, unknown>) =>
        ipcHandlers.get("agentaccess.credentialrequestresponse")!({}, { requestId, ...body });

      it("should open a pending entry carrying the query as the request is dispatched", async () => {
        void capturedCredentialCb(null, mockCredentialData);

        expect(await getActivity()).toEqual([
          {
            type: "credential_request",
            id: expect.any(String),
            timestampMs: expect.any(String),
            agentName: "Test Agent",
            agentFingerprint: "fp-1",
            origin: "relay",
            queryType: "domain",
            queryValue: "example.com",
            status: "pending",
            resourceType: "credential",
            operation: "request",
          },
        ]);
      });

      // A local request carries no `requesterName` over the wire, so the row falls back to the
      // OS-attested parent process — the same name the approval dialog shows.
      it("should name a local request's agent from its attested peer", async () => {
        void capturedCredentialCb(null, {
          queryType: "search",
          queryValue: "bank",
          origin: "local",
          localPeer: {
            pid: 42,
            processName: "aac",
            exePath: "/usr/local/bin/aac",
            parent: { pid: 1, processName: "Cursor", exePath: "/Applications/Cursor.app" },
          },
        } as agent_access.CredentialRequestData);

        const [entry] = await getActivity();
        expect(entry).toMatchObject({ agentName: "Cursor", origin: "local", queryValue: "bank" });
      });

      it("should resolve the same entry in place rather than appending a second one", async () => {
        const credentialPromise = capturedCredentialCb(null, mockCredentialData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: true, username: "u", password: "p" },
          outcome: { status: "shared", cipherId: "c1", fieldsShared: ["username", "totp"] },
        });
        await credentialPromise;

        const entries = await getActivity();
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
          status: "shared",
          cipherId: "c1",
          fieldsShared: ["username", "totp"],
          queryValue: "example.com",
          resolvedAtMs: expect.any(String),
        });
      });

      it("should distinguish a no-match denial from a user denial", async () => {
        const notFound = capturedCredentialCb(null, mockCredentialData);
        const notFoundId = lastMessage("agentaccess.credentialrequest").requestId;
        await respond(notFoundId, {
          response: { approved: false },
          outcome: { status: "not_found" },
        });
        await notFound;

        const denied = capturedCredentialCb(null, mockCredentialData);
        const deniedId = lastMessage("agentaccess.credentialrequest").requestId;
        await respond(deniedId, { response: { approved: false }, outcome: { status: "denied" } });
        await denied;

        expect((await getActivity()).map((entry: any) => entry.status)).toEqual([
          "not_found",
          "denied",
        ]);
      });

      // Nothing was released, so pointing at an item would imply a share that never happened.
      it("should ignore an item id attached to a non-shared outcome", async () => {
        const credentialPromise = capturedCredentialCb(null, mockCredentialData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: false },
          outcome: { status: "denied", cipherId: "c1", fieldsShared: ["password"] },
        });
        await credentialPromise;

        const [entry] = await getActivity();
        expect(entry.cipherId).toBeUndefined();
        expect(entry.fieldsShared).toBeUndefined();
      });

      // An answer with no annotation hasn't told us how the request ended; guessing would put a
      // wrong answer into an audit trail.
      it("should leave the entry pending when the response carries no outcome", async () => {
        const credentialPromise = capturedCredentialCb(null, mockCredentialData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, { response: { approved: true, username: "u" } });
        await credentialPromise;

        expect((await getActivity())[0].status).toBe("pending");
      });

      it("should never copy a credential value out of the response payload", async () => {
        const credentialPromise = capturedCredentialCb(null, mockCredentialData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: true, username: "u", password: "hunter2", totp: "123456" },
          outcome: { status: "shared", cipherId: "c1", fieldsShared: ["username"] },
        });
        await credentialPromise;

        expect(JSON.stringify(await getActivity())).not.toContain("hunter2");
        expect(JSON.stringify(await getActivity())).not.toContain("123456");
      });

      // Only a Pending -> resolved transition is legitimate. A second response for a requestId
      // whose row is already resolved (a buggy or compromised renderer replaying/forging the
      // message) must not be able to silently rewrite a recorded audit outcome — e.g. flipping a
      // recorded "denied" into a "shared".
      it("should not let a second response overwrite an already-resolved activity entry", async () => {
        const credentialPromise = capturedCredentialCb(null, mockCredentialData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: false },
          outcome: { status: "denied" },
        });
        await credentialPromise;

        // A second, forged response for the same requestId tries to flip it to "shared".
        await respond(requestId, {
          response: { approved: true, username: "u", password: "p" },
          outcome: { status: "shared", cipherId: "c1", fieldsShared: ["username"] },
        });

        const [entry] = await getActivity();
        expect(entry.status).toBe("denied");
        expect(entry.cipherId).toBeUndefined();
      });
    });

    // Secrets Manager secrets over user auth (agent-access-architecture.md, "M4").
    describe("Secrets Manager (resourceType / name queryType)", () => {
      const getActivity = () => ipcHandlers.get("agentaccess.getactivity")!({});
      const respond = (requestId: number, body: Record<string, unknown>) =>
        ipcHandlers.get("agentaccess.credentialrequestresponse")!({}, { requestId, ...body });

      // toCredentialQueryType must map "name" to the CredentialQueryType.Name mirror rather than
      // degrading it to the generic Search fallback used for genuinely unknown query types.
      it("should map a `name` query type without degrading to the Search fallback", async () => {
        void capturedCredentialCb(null, {
          ...mockCredentialData,
          queryType: "name",
          resourceType: "secret",
        } as agent_access.CredentialRequestData);

        const [entry] = await getActivity();
        expect(entry).toMatchObject({ queryType: "name" });
        expect(entry).not.toMatchObject({ queryType: "search" });
      });

      it("should record resourceType: secret on the activity row when the request asks for a secret", async () => {
        void capturedCredentialCb(null, {
          ...mockCredentialData,
          queryType: "name",
          resourceType: "secret",
        } as agent_access.CredentialRequestData);

        const [entry] = await getActivity();
        expect(entry).toMatchObject({ resourceType: "secret" });
      });

      it("should default resourceType to credential when the napi payload carries an unrecognized value", async () => {
        void capturedCredentialCb(null, {
          ...mockCredentialData,
          resourceType: "not-a-real-resource-type",
        } as unknown as agent_access.CredentialRequestData);

        const [entry] = await getActivity();
        expect(entry).toMatchObject({ resourceType: "credential" });
      });

      it("should record secretId on a Shared resolution of a secret request", async () => {
        const credentialPromise = capturedCredentialCb(null, {
          ...mockCredentialData,
          queryType: "name",
          resourceType: "secret",
        } as agent_access.CredentialRequestData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: true, secretValue: "s3cr3t", secretId: "secret-1" },
          outcome: { status: "shared", secretId: "secret-1", fieldsShared: ["value"] },
        });
        await credentialPromise;

        const [entry] = await getActivity();
        expect(entry).toMatchObject({ status: "shared", secretId: "secret-1" });
      });

      it("should not record secretId when the request is denied", async () => {
        const credentialPromise = capturedCredentialCb(null, {
          ...mockCredentialData,
          queryType: "name",
          resourceType: "secret",
        } as agent_access.CredentialRequestData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: false, reason: "denied" },
          outcome: { status: "denied", secretId: "secret-1" },
        });
        await credentialPromise;

        const [entry] = await getActivity();
        expect(entry.status).toBe("denied");
        expect(entry.secretId).toBeUndefined();
      });

      it("should never copy a secret value out of the response payload", async () => {
        const credentialPromise = capturedCredentialCb(null, {
          ...mockCredentialData,
          queryType: "name",
          resourceType: "secret",
        } as agent_access.CredentialRequestData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: true, secretValue: "s3cr3t-value", secretId: "secret-1" },
          outcome: { status: "shared", secretId: "secret-1", fieldsShared: ["value"] },
        });
        await credentialPromise;

        expect(JSON.stringify(await getActivity())).not.toContain("s3cr3t-value");
      });
    });

    // M4b (agent-access-architecture.md, "M4b — secret creation"). HARD INVARIANT: the
    // main-process activity buffer stores ids only — a create request's native `queryValue`
    // field carries the *proposed secret name* (its struct field isn't optional), so it must
    // never be copied into a persisted row.
    describe("secret creation (operation: 'create')", () => {
      const getActivity = () => ipcHandlers.get("agentaccess.getactivity")!({});
      const respond = (requestId: number, body: Record<string, unknown>) =>
        ipcHandlers.get("agentaccess.credentialrequestresponse")!({}, { requestId, ...body });

      const createRequestData: agent_access.CredentialRequestData = {
        ...mockCredentialData,
        // The native layer is forced to populate `queryValue` even for a create request (its
        // struct field isn't optional) — it fills it with the proposed secret name. This fixture
        // deliberately uses a recognizable "leak" value so a regression that copies it into the
        // activity buffer is caught by the assertions below.
        queryValue: "DB_PASSWORD_LEAK_IF_STORED",
        resourceType: "secret",
        operation: "create",
        newSecretName: "DB_PASSWORD_LEAK_IF_STORED",
        newSecretValue: "hunter2",
        newSecretNote: "prod db",
        projectHint: "my-app",
      } as agent_access.CredentialRequestData;

      it("never stores queryType or queryValue on a create row — ids only", async () => {
        void capturedCredentialCb(null, createRequestData);

        const [entry] = await getActivity();
        expect(entry).not.toHaveProperty("queryType");
        expect(entry).not.toHaveProperty("queryValue");
        expect(JSON.stringify(entry)).not.toContain("DB_PASSWORD_LEAK_IF_STORED");
      });

      it("records operation: create on the opened row", async () => {
        void capturedCredentialCb(null, createRequestData);

        const [entry] = await getActivity();
        expect(entry).toMatchObject({ operation: "create", resourceType: "secret" });
      });

      it("defaults operation to request when the napi payload carries an unrecognized value", async () => {
        void capturedCredentialCb(null, {
          ...mockCredentialData,
          operation: "not-a-real-operation",
        } as unknown as agent_access.CredentialRequestData);

        const [entry] = await getActivity();
        expect(entry).toMatchObject({ operation: "request" });
      });

      it("defaults operation to request when the napi payload omits it entirely", async () => {
        void capturedCredentialCb(null, mockCredentialData);

        const [entry] = await getActivity();
        expect(entry).toMatchObject({ operation: "request" });
      });

      it("forwards operation and the proposed secret fields to the renderer's live request message", () => {
        void capturedCredentialCb(null, createRequestData);

        expect(mockMessagingService.send).toHaveBeenCalledWith(
          "agentaccess.credentialrequest",
          expect.objectContaining({
            operation: "create",
            newSecretName: "DB_PASSWORD_LEAK_IF_STORED",
            newSecretValue: "hunter2",
            newSecretNote: "prod db",
            projectHint: "my-app",
          }),
        );
      });

      it("records secretId on a Created resolution, like Shared", async () => {
        const credentialPromise = capturedCredentialCb(null, createRequestData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: true, secretId: "new-secret-1", itemName: "DB_PASSWORD" },
          outcome: { status: "created", secretId: "new-secret-1" },
        });
        await credentialPromise;

        const [entry] = await getActivity();
        expect(entry).toMatchObject({ status: "created", secretId: "new-secret-1" });
      });

      it("never copies the proposed secret name or value out of the response payload into the activity buffer", async () => {
        const credentialPromise = capturedCredentialCb(null, createRequestData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: true, secretId: "new-secret-1", itemName: "DB_PASSWORD" },
          outcome: { status: "created", secretId: "new-secret-1" },
        });
        await credentialPromise;

        const dump = JSON.stringify(await getActivity());
        expect(dump).not.toContain("DB_PASSWORD");
        expect(dump).not.toContain("hunter2");
      });

      it("does not record secretId when a create request is denied", async () => {
        const credentialPromise = capturedCredentialCb(null, createRequestData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: false, reason: "denied" },
          outcome: { status: "denied", secretId: "new-secret-1" },
        });
        await credentialPromise;

        const [entry] = await getActivity();
        expect(entry.status).toBe("denied");
        expect(entry.secretId).toBeUndefined();
      });
    });

    // M6 — Full Secrets Manager surface: update/delete/list (agent-access-architecture.md, "M6").
    // Same ids-only invariant as M4b's create, generalized: the Rust side force-fills napi's
    // non-optional `queryValue` with the *target id* for update/delete (rather than a proposed
    // name), but the row must omit queryType/queryValue for every non-"request" operation
    // regardless — an id would be tolerable on its own, but consistency across every non-lookup
    // operation is the pinned invariant, not "only names are dangerous".
    describe("M6 — update/delete/list", () => {
      const getActivity = () => ipcHandlers.get("agentaccess.getactivity")!({});
      const respond = (requestId: number, body: Record<string, unknown>) =>
        ipcHandlers.get("agentaccess.credentialrequestresponse")!({}, { requestId, ...body });

      const updateRequestData: agent_access.CredentialRequestData = {
        ...mockCredentialData,
        // Force-filled by the Rust side with the *target id* for update/delete (M6's invariant
        // guard extension) — a recognizable fixture so a regression copying it into the buffer
        // is caught below.
        queryValue: "secret-target-1",
        resourceType: "secret",
        operation: "update",
        targetId: "secret-target-1",
        generateValue: true,
        generateLength: 64,
        generateSymbols: false,
      } as agent_access.CredentialRequestData;

      const deleteRequestData: agent_access.CredentialRequestData = {
        ...mockCredentialData,
        queryValue: "secret-target-2",
        resourceType: "secret",
        operation: "delete",
        targetId: "secret-target-2",
      } as agent_access.CredentialRequestData;

      const listRequestData: agent_access.CredentialRequestData = {
        ...mockCredentialData,
        queryValue: "",
        resourceType: "project",
        operation: "list",
      } as agent_access.CredentialRequestData;

      describe("narrowing", () => {
        it.each(["update", "delete", "list"])(
          "narrows operation %s without degrading to the Request fallback",
          async (operation) => {
            void capturedCredentialCb(null, {
              ...mockCredentialData,
              operation,
            } as agent_access.CredentialRequestData);

            const [entry] = await getActivity();
            expect(entry).toMatchObject({ operation });
          },
        );

        it("narrows resourceType project without degrading to the Credential fallback", async () => {
          void capturedCredentialCb(null, listRequestData);

          const [entry] = await getActivity();
          expect(entry).toMatchObject({ resourceType: "project" });
        });

        // Regression test: an operation string outside the known contract must still narrow to
        // Request (never treated as a write/list) — and therefore keeps queryType/queryValue on
        // the row, exactly like a genuine "request" row.
        it("narrows an unrecognized operation string to Request and keeps queryType/queryValue on the row", async () => {
          void capturedCredentialCb(null, {
            ...mockCredentialData,
            operation: "not-a-real-operation",
          } as unknown as agent_access.CredentialRequestData);

          const [entry] = await getActivity();
          expect(entry).toMatchObject({
            operation: "request",
            queryType: "domain",
            queryValue: "example.com",
          });
        });
      });

      it("forwards targetId, generateValue, generateLength, and generateSymbols to the renderer's live request message", () => {
        void capturedCredentialCb(null, updateRequestData);

        expect(mockMessagingService.send).toHaveBeenCalledWith(
          "agentaccess.credentialrequest",
          expect.objectContaining({
            operation: "update",
            targetId: "secret-target-1",
            generateValue: true,
            generateLength: 64,
            generateSymbols: false,
          }),
        );
      });

      it.each([
        ["update", "updateRequestData"],
        ["delete", "deleteRequestData"],
        ["list", "listRequestData"],
      ])("never stores queryType or queryValue on a(n) %s row — ids only", async (operation) => {
        const data =
          operation === "update"
            ? updateRequestData
            : operation === "delete"
              ? deleteRequestData
              : listRequestData;

        void capturedCredentialCb(null, data);

        const [entry] = await getActivity();
        expect(entry).not.toHaveProperty("queryType");
        expect(entry).not.toHaveProperty("queryValue");
        expect(JSON.stringify(entry)).not.toContain("secret-target-1");
        expect(JSON.stringify(entry)).not.toContain("secret-target-2");
      });

      it("records secretId and projectId on an Updated resolution, like Created", async () => {
        const credentialPromise = capturedCredentialCb(null, updateRequestData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: {
            approved: true,
            secretId: "secret-target-1",
            projectId: "project-1",
            itemName: "DB_PASSWORD",
          },
          outcome: { status: "updated", secretId: "secret-target-1", projectId: "project-1" },
        });
        await credentialPromise;

        const [entry] = await getActivity();
        expect(entry).toMatchObject({
          status: "updated",
          secretId: "secret-target-1",
          projectId: "project-1",
        });
      });

      it("records secretId (without a projectId) on an Updated resolution when no project move happened", async () => {
        const credentialPromise = capturedCredentialCb(null, updateRequestData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: true, secretId: "secret-target-1", itemName: "DB_PASSWORD" },
          outcome: { status: "updated", secretId: "secret-target-1" },
        });
        await credentialPromise;

        const [entry] = await getActivity();
        expect(entry).toMatchObject({ status: "updated", secretId: "secret-target-1" });
        expect(entry.projectId).toBeUndefined();
      });

      it("records secretId on a Deleted resolution of a secret target", async () => {
        const credentialPromise = capturedCredentialCb(null, deleteRequestData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: true, secretId: "secret-target-2", itemName: "DB_PASSWORD" },
          outcome: { status: "deleted", secretId: "secret-target-2" },
        });
        await credentialPromise;

        const [entry] = await getActivity();
        expect(entry).toMatchObject({ status: "deleted", secretId: "secret-target-2" });
      });

      it("records projectId (without a secretId) on a Deleted resolution of a project target", async () => {
        const projectDeleteData: agent_access.CredentialRequestData = {
          ...mockCredentialData,
          queryValue: "project-target-1",
          resourceType: "project",
          operation: "delete",
          targetId: "project-target-1",
        } as agent_access.CredentialRequestData;
        const credentialPromise = capturedCredentialCb(null, projectDeleteData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: true, projectId: "project-target-1", itemName: "my-app" },
          outcome: { status: "deleted", projectId: "project-target-1" },
        });
        await credentialPromise;

        const [entry] = await getActivity();
        expect(entry).toMatchObject({ status: "deleted", projectId: "project-target-1" });
        expect(entry.secretId).toBeUndefined();
      });

      it("resolves a Listed outcome copying neither secretId nor projectId — the list itself was the release", async () => {
        const credentialPromise = capturedCredentialCb(null, listRequestData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: {
            approved: true,
            projects: [{ id: "project-1", name: "my-app", write: true, organization: "Acme" }],
          },
          outcome: { status: "listed" },
        });
        await credentialPromise;

        const [entry] = await getActivity();
        expect(entry.status).toBe("listed");
        expect(entry.secretId).toBeUndefined();
        expect(entry.projectId).toBeUndefined();
        expect(entry.resolvedAtMs).toEqual(expect.any(String));
      });

      it("never copies a project name out of the response payload into the activity buffer", async () => {
        const credentialPromise = capturedCredentialCb(null, listRequestData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: {
            approved: true,
            projects: [{ id: "project-1", name: "PROJECT_NAME_LEAK_IF_STORED", write: true }],
          },
          outcome: { status: "listed" },
        });
        await credentialPromise;

        expect(JSON.stringify(await getActivity())).not.toContain("PROJECT_NAME_LEAK_IF_STORED");
      });

      it("does not record secretId or projectId when an update request is denied", async () => {
        const credentialPromise = capturedCredentialCb(null, updateRequestData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: false, reason: "denied" },
          outcome: { status: "denied", secretId: "secret-target-1", projectId: "project-1" },
        });
        await credentialPromise;

        const [entry] = await getActivity();
        expect(entry.status).toBe("denied");
        expect(entry.secretId).toBeUndefined();
        expect(entry.projectId).toBeUndefined();
      });
    });

    // M7 (agent-access-architecture.md, "M7 — bws run parity: project-scoped bulk secret
    // injection"). `operation: "bulkRequest"` = the napi surface for `projectSecretsRequest`:
    // one approval releases a whole project's secret set for env injection. Same ids-only
    // activity-buffer invariant as every other write/list op (M4b/M6) — the row keeps
    // `secretIds` (ids only), never the `secrets` array of live values that only ever transits
    // the in-flight response.
    describe("M7 — bulkRequest (projectSecretsRequest)", () => {
      const getActivity = () => ipcHandlers.get("agentaccess.getactivity")!({});
      const respond = (requestId: number, body: Record<string, unknown>) =>
        ipcHandlers.get("agentaccess.credentialrequestresponse")!({}, { requestId, ...body });

      const bulkRequestByIdData: agent_access.CredentialRequestData = {
        ...mockCredentialData,
        // Force-filled by the Rust side with the target selector for bulkRequest (M7's
        // force-fill extension of update/delete's queryValue=targetId precedent) — a
        // recognizable fixture so a regression copying it into the buffer is caught below.
        queryValue: "project-1",
        resourceType: "secret",
        operation: "bulkRequest",
        targetId: "project-1",
      } as agent_access.CredentialRequestData;

      const bulkRequestByNameData: agent_access.CredentialRequestData = {
        ...mockCredentialData,
        queryValue: "my-app",
        resourceType: "secret",
        operation: "bulkRequest",
        projectName: "my-app",
      } as agent_access.CredentialRequestData;

      it("narrows operation bulkRequest without degrading to the Request fallback", async () => {
        void capturedCredentialCb(null, bulkRequestByIdData);

        const [entry] = await getActivity();
        expect(entry).toMatchObject({ operation: "bulkRequest", resourceType: "secret" });
      });

      it("forwards targetId and projectName to the renderer's live request message (id form)", () => {
        void capturedCredentialCb(null, bulkRequestByIdData);

        expect(mockMessagingService.send).toHaveBeenCalledWith(
          "agentaccess.credentialrequest",
          expect.objectContaining({
            operation: "bulkRequest",
            targetId: "project-1",
            projectName: undefined,
          }),
        );
      });

      it("forwards projectName to the renderer's live request message (name form)", () => {
        void capturedCredentialCb(null, bulkRequestByNameData);

        expect(mockMessagingService.send).toHaveBeenCalledWith(
          "agentaccess.credentialrequest",
          expect.objectContaining({
            operation: "bulkRequest",
            targetId: undefined,
            projectName: "my-app",
          }),
        );
      });

      it("never stores queryType or queryValue on a bulkRequest row — ids only", async () => {
        void capturedCredentialCb(null, bulkRequestByIdData);

        const [entry] = await getActivity();
        expect(entry).not.toHaveProperty("queryType");
        expect(entry).not.toHaveProperty("queryValue");
        expect(JSON.stringify(entry)).not.toContain("project-1");
      });

      it("records projectId and secretIds on a Shared resolution", async () => {
        const credentialPromise = capturedCredentialCb(null, bulkRequestByIdData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: {
            approved: true,
            projectId: "project-1",
            itemName: "my-app",
            secrets: [
              { id: "secret-1", name: "DB_PASSWORD", value: "hunter2" },
              { id: "secret-2", name: "API_KEY", value: "s3cr3t" },
            ],
          },
          outcome: {
            status: "shared",
            projectId: "project-1",
            secretIds: ["secret-1", "secret-2"],
          },
        });
        await credentialPromise;

        const [entry] = await getActivity();
        expect(entry).toMatchObject({
          status: "shared",
          projectId: "project-1",
          secretIds: ["secret-1", "secret-2"],
        });
      });

      it("does not record projectId or secretIds when a bulkRequest is denied", async () => {
        const credentialPromise = capturedCredentialCb(null, bulkRequestByIdData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: { approved: false, reason: "denied" },
          outcome: { status: "denied", projectId: "project-1", secretIds: ["secret-1"] },
        });
        await credentialPromise;

        const [entry] = await getActivity();
        expect(entry.status).toBe("denied");
        expect(entry.projectId).toBeUndefined();
        expect(entry.secretIds).toBeUndefined();
      });

      it("never copies the secrets array (names or live values) out of the response payload into the activity buffer", async () => {
        const credentialPromise = capturedCredentialCb(null, bulkRequestByIdData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await respond(requestId, {
          response: {
            approved: true,
            projectId: "project-1",
            itemName: "my-app",
            secrets: [
              { id: "secret-1", name: "DB_PASSWORD_LEAK_IF_STORED", value: "hunter2-leak" },
              { id: "secret-2", name: "API_KEY_LEAK_IF_STORED", value: "s3cr3t-leak" },
            ],
          },
          outcome: {
            status: "shared",
            projectId: "project-1",
            secretIds: ["secret-1", "secret-2"],
          },
        });
        await credentialPromise;

        const serialized = JSON.stringify(await getActivity());
        expect(serialized).not.toContain("DB_PASSWORD_LEAK_IF_STORED");
        expect(serialized).not.toContain("API_KEY_LEAK_IF_STORED");
        expect(serialized).not.toContain("hunter2-leak");
        expect(serialized).not.toContain("s3cr3t-leak");
        // Ids are expected to appear (secretIds is the intentional ids-only projection) — this
        // assertion is scoped to names/values only, not a blanket "no secret- string" check.
      });

      it("resolves with the renderer's full response, including the secrets array, on the in-flight callback (never buffered)", async () => {
        const credentialPromise = capturedCredentialCb(null, bulkRequestByIdData);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        const response: agent_access.CredentialResponseData = {
          approved: true,
          projectId: "project-1",
          itemName: "my-app",
          secrets: [{ id: "secret-1", name: "DB_PASSWORD", value: "hunter2" }],
        };
        await respond(requestId, {
          response,
          outcome: { status: "shared", projectId: "project-1", secretIds: ["secret-1"] },
        });

        expect(await credentialPromise).toEqual(response);
      });
    });
  });

  // Browser fill delivery (agent-access-architecture.md, "M5"): fill-delivery and
  // describeFillTarget requests ride the existing pending-request pipeline; describes open no
  // activity row, fill outcomes resolve rows to Filled/FillFailed with metadata only.
  describe("browser fill (M5)", () => {
    const getActivity = () => ipcHandlers.get("agentaccess.getactivity")!({});
    const respond = (requestId: number, body: Record<string, unknown>) =>
      ipcHandlers.get("agentaccess.credentialrequestresponse")!({}, { requestId, ...body });

    const fillRequestData: agent_access.CredentialRequestData = {
      queryType: "domain",
      queryValue: "example.com",
      requesterName: "Cursor",
      origin: "local",
      deliveryMode: "fill",
      fillFields: ["username", "password"],
      fillTargetToken: "ft_1",
    } as agent_access.CredentialRequestData;

    const describeRequestData: agent_access.CredentialRequestData = {
      // The napi struct's queryType/queryValue aren't optional, so the Rust side sends
      // placeholder values for a describe — nothing here may reach the activity buffer anyway,
      // since no row is ever opened for this operation.
      queryType: "domain",
      queryValue: "",
      requesterName: "Cursor",
      origin: "local",
      operation: "describeFillTarget",
    } as agent_access.CredentialRequestData;

    it("forwards fillFields and fillTargetToken to the renderer's live request message", () => {
      void capturedCredentialCb(null, fillRequestData);

      expect(mockMessagingService.send).toHaveBeenCalledWith(
        "agentaccess.credentialrequest",
        expect.objectContaining({
          deliveryMode: "fill",
          fillFields: ["username", "password"],
          fillTargetToken: "ft_1",
        }),
      );
    });

    it("never opens an activity row for a describeFillTarget request", async () => {
      void capturedCredentialCb(null, describeRequestData);

      expect(await getActivity()).toEqual([]);
      // The live request message is still dispatched to the renderer — only the audit row is
      // skipped.
      expect(mockMessagingService.send).toHaveBeenCalledWith(
        "agentaccess.credentialrequest",
        expect.objectContaining({ operation: "describeFillTarget" }),
      );
    });

    it("still round-trips a describeFillTarget response through the pending map", async () => {
      const describePromise = capturedCredentialCb(null, describeRequestData);
      const { requestId } = lastMessage("agentaccess.credentialrequest");

      await respond(requestId, {
        response: { approved: true, fillTarget: '{"origin":"https://example.com"}' },
      });

      expect(await describePromise).toEqual({
        approved: true,
        fillTarget: '{"origin":"https://example.com"}',
      });
      expect(await getActivity()).toEqual([]);
    });

    it("expires an unanswered describeFillTarget with reason error, not denied", async () => {
      jest.useFakeTimers();
      try {
        const describePromise = capturedCredentialCb(null, describeRequestData);

        jest.advanceTimersByTime(70_000);

        await expect(describePromise).resolves.toEqual({ approved: false, reason: "error" });
      } finally {
        jest.useRealTimers();
      }
    });

    it("resolves a Filled outcome with cipherId, fieldsShared, and fillOrigin — metadata only", async () => {
      const fillPromise = capturedCredentialCb(null, fillRequestData);
      const { requestId } = lastMessage("agentaccess.credentialrequest");

      await respond(requestId, {
        response: {
          approved: true,
          credentialId: "c1",
          itemName: "My Login",
          fillResult: '{"status":"filled"}',
          fillFieldsShared: ["username", "password"],
        },
        outcome: {
          status: "filled",
          cipherId: "c1",
          fieldsShared: ["username", "password"],
          fillOrigin: "https://example.com",
        },
      });
      await fillPromise;

      const [entry] = await getActivity();
      expect(entry).toMatchObject({
        status: "filled",
        cipherId: "c1",
        fieldsShared: ["username", "password"],
        fillOrigin: "https://example.com",
        resolvedAtMs: expect.any(String),
      });
    });

    it("resolves a FillFailed outcome without a cipherId but with the fill origin", async () => {
      const fillPromise = capturedCredentialCb(null, fillRequestData);
      const { requestId } = lastMessage("agentaccess.credentialrequest");

      await respond(requestId, {
        response: {
          approved: true,
          credentialId: "c1",
          fillResult: '{"status":"extension-unavailable"}',
          fillFieldsShared: [],
        },
        outcome: {
          status: "fill_failed",
          // A buggy renderer attaching an id to a failed fill must not persist it: nothing was
          // filled, so there is nothing to point at.
          cipherId: "c1",
          fieldsShared: [],
          fillOrigin: "https://example.com",
        },
      });
      await fillPromise;

      const [entry] = await getActivity();
      expect(entry.status).toBe("fill_failed");
      expect(entry.cipherId).toBeUndefined();
      expect(entry).toMatchObject({ fillOrigin: "https://example.com" });
    });

    it("never reads the fillResult pass-through into the activity buffer", async () => {
      const fillPromise = capturedCredentialCb(null, fillRequestData);
      const { requestId } = lastMessage("agentaccess.credentialrequest");

      await respond(requestId, {
        response: {
          approved: true,
          credentialId: "c1",
          fillResult: '{"status":"filled","canary":"FILL_RESULT_LEAK_IF_STORED"}',
          fillFieldsShared: ["username"],
        },
        outcome: {
          status: "filled",
          cipherId: "c1",
          fieldsShared: ["username"],
          fillOrigin: "https://example.com",
        },
      });
      await fillPromise;

      expect(JSON.stringify(await getActivity())).not.toContain("FILL_RESULT_LEAK_IF_STORED");
    });
  });

  describe("fingerprint request correlation", () => {
    const mockFingerprintData: agent_access.FingerprintVerificationData = {
      fingerprint: "AB12CD",
      identityFingerprint: "identity-fp",
    };

    it("should send agentaccess.fingerprintrequest with a correlated requestId", () => {
      void capturedFingerprintCb(null, mockFingerprintData);

      expect(mockMessagingService.send).toHaveBeenCalledWith("agentaccess.fingerprintrequest", {
        requestId: expect.any(Number),
        fingerprint: "AB12CD",
        identityFingerprint: "identity-fp",
      });
    });

    it("should resolve with the renderer's response when fingerprintresponse arrives", async () => {
      const fingerprintPromise = capturedFingerprintCb(null, mockFingerprintData);
      const requestId = (mockMessagingService.send as jest.Mock).mock.calls.slice(-1)[0][1]
        .requestId;

      const responseHandler = ipcHandlers.get("agentaccess.fingerprintresponse")!;
      const response: agent_access.FingerprintVerificationResponse = {
        approved: true,
        name: "My Laptop",
      };
      await responseHandler({}, { requestId, response });

      expect(await fingerprintPromise).toEqual(response);
    });
  });

  describe("pending request cleanup", () => {
    const mockCredentialData: agent_access.CredentialRequestData = {
      queryType: "domain",
      queryValue: "example.com",
      requesterFingerprint: "fp-1",
      requesterName: "Test Agent",
      origin: "relay",
    };
    const mockFingerprintData: agent_access.FingerprintVerificationData = {
      fingerprint: "AB12CD",
      identityFingerprint: "identity-fp",
    };

    describe("STOP", () => {
      // The underlying connection each pending callback was answering on is gone once the server
      // stops, so nothing should still be listening for its answer — and a stale response arriving
      // afterwards (a slow renderer, a race with STOP) must not throw.
      it("clears pending requests so a stale response afterwards is a no-op", async () => {
        const credentialPromise = capturedCredentialCb(null, mockCredentialData);
        const settledSpy = jest.fn();
        void credentialPromise.then(settledSpy);
        const { requestId } = lastMessage("agentaccess.credentialrequest");

        await ipcHandlers.get("agentaccess.stop")!({});

        await expect(
          ipcHandlers.get("agentaccess.credentialrequestresponse")!(
            {},
            { requestId, response: { approved: true, username: "u" } },
          ),
        ).resolves.not.toThrow();

        // Nothing resolves the original (now-orphaned) promise either.
        await Promise.resolve();
        await Promise.resolve();
        expect(settledSpy).not.toHaveBeenCalled();
      });

      it("clears pending fingerprint requests too", async () => {
        void capturedFingerprintCb(null, mockFingerprintData);
        const { requestId } = lastMessage("agentaccess.fingerprintrequest");

        await ipcHandlers.get("agentaccess.stop")!({});

        await expect(
          ipcHandlers.get("agentaccess.fingerprintresponse")!(
            {},
            { requestId, response: { approved: true, name: "x" } },
          ),
        ).resolves.not.toThrow();
      });
    });

    describe("expiry (backstop for a request the renderer never answers)", () => {
      afterEach(() => {
        jest.useRealTimers();
      });

      it("denies and drops a credential request once its expiry timer fires", async () => {
        jest.useFakeTimers();
        try {
          const credentialPromise = capturedCredentialCb(null, mockCredentialData);

          jest.advanceTimersByTime(70_000);

          await expect(credentialPromise).resolves.toEqual({
            approved: false,
            reason: "denied",
          });
        } finally {
          jest.useRealTimers();
        }
      });

      it("denies a fingerprint request once its expiry timer fires", async () => {
        jest.useFakeTimers();
        try {
          const fingerprintPromise = capturedFingerprintCb(null, mockFingerprintData);

          jest.advanceTimersByTime(70_000);

          await expect(fingerprintPromise).resolves.toEqual({ approved: false });
        } finally {
          jest.useRealTimers();
        }
      });

      it("does not fire for a request the renderer already answered", async () => {
        jest.useFakeTimers();
        try {
          const credentialPromise = capturedCredentialCb(null, mockCredentialData);
          const { requestId } = lastMessage("agentaccess.credentialrequest");

          await ipcHandlers.get("agentaccess.credentialrequestresponse")!(
            {},
            { requestId, response: { approved: true, username: "u" } },
          );
          const resolved = await credentialPromise;

          // Advancing past the expiry window must not change an already-settled result.
          jest.advanceTimersByTime(70_000);

          expect(resolved).toEqual({ approved: true, username: "u" });
        } finally {
          jest.useRealTimers();
        }
      });
    });
  });

  describe("storage callbacks", () => {
    it("should read from the keychain using the agent-access service name", async () => {
      (passwords.getPassword as jest.Mock).mockResolvedValueOnce("stored-value");

      const result = await capturedStorageGetCb(null, "identity");

      expect(passwords.getPassword).toHaveBeenCalledWith("Bitwarden_agent_access", "identity");
      expect(result).toBe("stored-value");
    });

    it("should return null when the keychain entry does not exist", async () => {
      (passwords.getPassword as jest.Mock).mockRejectedValueOnce(
        new Error(passwords.PASSWORD_NOT_FOUND),
      );

      const result = await capturedStorageGetCb(null, "identity");

      expect(result).toBeNull();
    });

    it("should write to the keychain when a value is provided", async () => {
      await capturedStorageSetCb(null, { key: "psks", value: "psk-blob" });

      expect(passwords.setPassword).toHaveBeenCalledWith(
        "Bitwarden_agent_access",
        "psks",
        "psk-blob",
      );
    });

    it("should delete the keychain entry when value is omitted", async () => {
      await capturedStorageSetCb(null, { key: "connections" });

      expect(passwords.deletePassword).toHaveBeenCalledWith(
        "Bitwarden_agent_access",
        "connections",
      );
    });

    it("should not throw when deleting a key that was never written", async () => {
      (passwords.deletePassword as jest.Mock).mockRejectedValueOnce(
        new Error(passwords.PASSWORD_NOT_FOUND),
      );

      await expect(capturedStorageSetCb(null, { key: "connections" })).resolves.not.toThrow();
    });
  });

  describe("grant store handlers", () => {
    let grantsBlob: string | null;

    beforeEach(() => {
      grantsBlob = null;
      (passwords.getPassword as jest.Mock).mockImplementation(
        async (_service: string, key: string) => {
          if (key === "grants") {
            if (grantsBlob == null) {
              throw new Error(passwords.PASSWORD_NOT_FOUND);
            }
            return grantsBlob;
          }
          throw new Error(passwords.PASSWORD_NOT_FOUND);
        },
      );
      (passwords.setPassword as jest.Mock).mockImplementation(
        async (_service: string, key: string, value: string) => {
          if (key === "grants") {
            grantsBlob = value;
          }
        },
      );
    });

    it("returns an empty list before any grant has been created", async () => {
      const handler = ipcHandlers.get("agentaccess.listgrants")!;
      expect(await handler({})).toEqual([]);
    });

    it("creates a grant via upsertgrant and persists it under the agent-access keychain service", async () => {
      const upsertHandler = ipcHandlers.get("agentaccess.upsertgrant")!;
      const grant = await upsertHandler(
        {},
        {
          signatureKind: "macosTeamId",
          signatureIdentity: "TEAMID:com.anysphere.cursor",
          displayName: "Cursor",
          exePath: "/Applications/Cursor.app",
          scope: "allLogins",
        },
      );

      expect(grant.id).toEqual(expect.any(String));
      expect(passwords.setPassword).toHaveBeenCalledWith(
        "Bitwarden_agent_access",
        "grants",
        expect.any(String),
      );

      const listHandler = ipcHandlers.get("agentaccess.listgrants")!;
      expect(await listHandler({})).toEqual([grant]);
    });

    it("finds a previously-created grant by its attestation key via findgrant", async () => {
      const upsertHandler = ipcHandlers.get("agentaccess.upsertgrant")!;
      const grant = await upsertHandler(
        {},
        {
          signatureKind: "macosTeamId",
          signatureIdentity: "TEAMID:com.anysphere.cursor",
          displayName: "Cursor",
          scope: "allLogins",
        },
      );

      const findHandler = ipcHandlers.get("agentaccess.findgrant")!;
      expect(
        await findHandler(
          {},
          { signatureKind: "macosTeamId", signatureIdentity: "TEAMID:com.anysphere.cursor" },
        ),
      ).toEqual(grant);
      expect(
        await findHandler({}, { signatureKind: "macosTeamId", signatureIdentity: "unknown" }),
      ).toBeNull();
    });

    it("removes a grant by id via removegrant", async () => {
      const upsertHandler = ipcHandlers.get("agentaccess.upsertgrant")!;
      const grant = await upsertHandler(
        {},
        {
          signatureKind: "macosTeamId",
          signatureIdentity: "TEAMID:com.anysphere.cursor",
          displayName: "Cursor",
          scope: "allLogins",
        },
      );

      const removeHandler = ipcHandlers.get("agentaccess.removegrant")!;
      await removeHandler({}, { id: grant.id });

      const listHandler = ipcHandlers.get("agentaccess.listgrants")!;
      expect(await listHandler({})).toEqual([]);
    });

    // Fail-closed validation at the IPC boundary (the renderer is a distrusted caller here): an
    // empty `signatureIdentity` is the degenerate "no attestable identity" case (no valid
    // signature AND no resolvable exe path), which must never collapse into a single catch-all
    // grant that would cover every future fully-unattestable process.
    describe("fail-closed input validation", () => {
      it("upsertgrant refuses to persist a grant with an empty signatureIdentity", async () => {
        const upsertHandler = ipcHandlers.get("agentaccess.upsertgrant")!;

        const result = await upsertHandler(
          {},
          {
            signatureKind: "path",
            signatureIdentity: "",
            displayName: "Unknown application",
            scope: "allLogins",
          },
        );

        expect(result).toBeNull();
        const listHandler = ipcHandlers.get("agentaccess.listgrants")!;
        expect(await listHandler({})).toEqual([]);
      });

      it("upsertgrant rejects an invalid scope", async () => {
        const upsertHandler = ipcHandlers.get("agentaccess.upsertgrant")!;

        const result = await upsertHandler(
          {},
          {
            signatureKind: "macosTeamId",
            signatureIdentity: "TEAMID:com.anysphere.cursor",
            displayName: "Cursor",
            scope: "everything",
          },
        );

        expect(result).toBeNull();
        const listHandler = ipcHandlers.get("agentaccess.listgrants")!;
        expect(await listHandler({})).toEqual([]);
      });

      it("upsertgrant rejects an empty signatureKind", async () => {
        const upsertHandler = ipcHandlers.get("agentaccess.upsertgrant")!;

        const result = await upsertHandler(
          {},
          {
            signatureKind: "",
            signatureIdentity: "TEAMID:com.anysphere.cursor",
            displayName: "Cursor",
            scope: "allLogins",
          },
        );

        expect(result).toBeNull();
      });

      it("findgrant never matches (and never touches storage for) an empty signatureIdentity key", async () => {
        const findHandler = ipcHandlers.get("agentaccess.findgrant")!;

        const result = await findHandler({}, { signatureKind: "path", signatureIdentity: "" });

        expect(result).toBeNull();
      });
    });
  });

  describe("agentaccess.stop IPC handler", () => {
    it("should stop the agent state", async () => {
      const handler = ipcHandlers.get("agentaccess.stop")!;
      await handler({});

      expect(mockAgentState.stop).toHaveBeenCalled();
    });

    it("should be a no-op when called a second time after the agent is cleared", async () => {
      const handler = ipcHandlers.get("agentaccess.stop")!;
      await handler({});
      mockAgentState.stop.mockClear();

      await expect(handler({})).resolves.not.toThrow();
      expect(mockAgentState.stop).not.toHaveBeenCalled();
    });
  });

  describe("pass-through handlers", () => {
    it("should proxy getFingerprint", async () => {
      const result = await ipcHandlers.get("agentaccess.getfingerprint")!({});
      expect(result).toBe("abc123");
    });

    it("should proxy generatePskToken with name and reusable", async () => {
      await ipcHandlers.get("agentaccess.generatepsktoken")!(
        {},
        { name: "My Device", reusable: true },
      );
      expect(mockAgentState.generatePskToken).toHaveBeenCalledWith("My Device", true);
    });

    it("should proxy generateRendezvousCode with name", async () => {
      await ipcHandlers.get("agentaccess.generaterendezvouscode")!({}, { name: null });
      expect(mockAgentState.generateRendezvousCode).toHaveBeenCalledWith(null);
    });

    it("should proxy listConnections", async () => {
      const result = await ipcHandlers.get("agentaccess.listconnections")!({});
      expect(mockAgentState.listConnections).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("should proxy removeConnection with a fingerprint", async () => {
      await ipcHandlers.get("agentaccess.removeconnection")!({}, { fingerprint: "fp-1" });
      expect(mockAgentState.removeConnection).toHaveBeenCalledWith("fp-1");
    });
  });
});

// Must stay byte-for-byte identical to `sanitize_username` in `bitwarden/agent-access`'s
// `crates/ap-cli/src/transport/local.rs` — the desktop side and the `aac` CLI independently
// compute the same Windows named-pipe path from the same OS username with no handshake to
// reconcile a mismatch, so any divergence here silently breaks the Windows local transport for
// any username containing a dot, space, or non-ASCII character. These are the exact vectors both
// sides are pinned to.
describe("sanitizeWindowsPipeUsername", () => {
  it.each([
    ["john.doe", "john_doe"],
    ["CORP\\max power!", "CORP_max_power_"],
    ["plainuser", "plainuser"],
  ])("sanitizes %s to %s", (input, expected) => {
    expect(sanitizeWindowsPipeUsername(input)).toBe(expected);
  });
});
