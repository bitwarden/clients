/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { ipcMain } from "electron";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { sshagent_v2 } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";

import { MainSshAgentService } from "./main-ssh-agent.service";

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  sshagent: {
    serve: jest.fn(),
    isRunning: jest.fn(),
    setKeys: jest.fn(),
    lock: jest.fn(),
    clearKeys: jest.fn(),
  },
  sshagent_v2: {
    SshAgentState: {
      serve: jest.fn(),
    },
  },
}));

describe("MainSshAgentService", () => {
  let mockLogService: jest.Mocked<LogService>;
  let mockMessagingService: jest.Mocked<MessagingService>;

  let ipcHandlers: Map<string, Function>;
  let mockAgentStateV2: {
    isRunning: jest.Mock;
    setKeys: jest.Mock;
    lock: jest.Mock;
    clearKeys: jest.Mock;
  };

  beforeEach(() => {
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

    mockAgentStateV2 = {
      isRunning: jest.fn().mockReturnValue(true),
      setKeys: jest.fn(),
      lock: jest.fn(),
      clearKeys: jest.fn(),
    };

    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: Function) => {
      ipcHandlers.set(channel, handler);
    });
  });

  describe("v2 (useV2 = true)", () => {
    let capturedUnlockCb: () => Promise<boolean>;
    let capturedSignCb: (data: sshagent_v2.SignRequestData) => Promise<boolean>;

    beforeEach(async () => {
      (sshagent_v2.SshAgentState.serve as jest.Mock).mockImplementation(
        (unlock: Function, sign: Function) => {
          capturedUnlockCb = unlock as any;
          capturedSignCb = sign as any;
          return Promise.resolve(mockAgentStateV2);
        },
      );

      new MainSshAgentService(mockLogService, mockMessagingService);
      await ipcHandlers.get("sshagent.init")!({}, { useV2: true });
      await Promise.resolve(); // let agentStateV2 settle
    });

    describe("constructor", () => {
      it("should register sshagent.init IPC handler", () => {
        expect(ipcHandlers.has("sshagent.init")).toBe(true);
      });

      it("should register sshagent.isloaded IPC handler", () => {
        expect(ipcHandlers.has("sshagent.isloaded")).toBe(true);
      });
    });

    describe("sshagent.init IPC handler (registration)", () => {
      it("should register sshagent.setkeys IPC handler", () => {
        expect(ipcHandlers.has("sshagent.setkeys")).toBe(true);
      });

      it("should register sshagent.signrequestresponse IPC handler", () => {
        expect(ipcHandlers.has("sshagent.signrequestresponse")).toBe(true);
      });

      it("should register sshagent.lock IPC handler", () => {
        expect(ipcHandlers.has("sshagent.lock")).toBe(true);
      });

      it("should register sshagent.clearkeys IPC handler", () => {
        expect(ipcHandlers.has("sshagent.clearkeys")).toBe(true);
      });
    });

    describe("sshagent.isloaded IPC handler", () => {
      it("should return false before sshagent.init IPC is called", async () => {
        // Create a fresh service that has not received the INIT IPC call
        new MainSshAgentService(mockLogService, mockMessagingService);
        const handler = ipcHandlers.get("sshagent.isloaded")!;
        expect(await handler({})).toBe(false);
      });

      it("should return true after sshagent.init IPC resolves", async () => {
        const handler = ipcHandlers.get("sshagent.isloaded")!;
        expect(await handler({})).toBe(true);
      });
    });

    describe("sshagent.init IPC handler", () => {
      it("should call sshagent_v2.SshAgentState.serve with unlock and sign callbacks", () => {
        expect(sshagent_v2.SshAgentState.serve).toHaveBeenCalledWith(
          expect.any(Function),
          expect.any(Function),
        );
      });

      it("should log success after serve resolves", async () => {
        expect(mockLogService.info).toHaveBeenCalledWith("SSH agent v2 started");
      });

      it("should log error if serve rejects", async () => {
        const error = new Error("napi bind failed");
        (sshagent_v2.SshAgentState.serve as jest.Mock).mockRejectedValueOnce(error);

        // Re-create service and invoke INIT again with the rejecting mock
        new MainSshAgentService(mockLogService, mockMessagingService);
        await ipcHandlers.get("sshagent.init")!({}, { useV2: true });
        await Promise.resolve(); // propagates rejection through .then()
        await Promise.resolve(); // .catch() handler runs

        expect(mockLogService.error).toHaveBeenCalledWith(
          "SSH agent v2 encountered an error: ",
          error,
        );
      });
    });

    describe("requestUnlock (via unlock callback)", () => {
      it("should send sshagent.unlockrequest with a request ID", () => {
        void capturedUnlockCb();

        expect(mockMessagingService.send).toHaveBeenCalledWith("sshagent.unlockrequest", {
          requestId: 1,
        });
      });

      it("should resolve with true when the renderer accepts", async () => {
        const unlockPromise = capturedUnlockCb();

        const responseHandler = ipcHandlers.get("sshagent.signrequestresponse")!;
        await responseHandler({}, { requestId: 1, accepted: true });

        expect(await unlockPromise).toBe(true);
      });

      it("should resolve with false when the renderer rejects", async () => {
        const unlockPromise = capturedUnlockCb();

        const responseHandler = ipcHandlers.get("sshagent.signrequestresponse")!;
        await responseHandler({}, { requestId: 1, accepted: false });

        expect(await unlockPromise).toBe(false);
      });

      it("should handle multiple concurrent requests independently", async () => {
        const promise1 = capturedUnlockCb(); // requestId: 1
        const promise2 = capturedUnlockCb(); // requestId: 2

        const responseHandler = ipcHandlers.get("sshagent.signrequestresponse")!;
        // Respond out of order: deny 2, accept 1
        await responseHandler({}, { requestId: 2, accepted: false });
        await responseHandler({}, { requestId: 1, accepted: true });

        expect(await promise1).toBe(true);
        expect(await promise2).toBe(false);
      });

      it("should remove the pending request after it is resolved", async () => {
        const responseHandler = ipcHandlers.get("sshagent.signrequestresponse")!;

        const unlockPromise = capturedUnlockCb();
        await responseHandler({}, { requestId: 1, accepted: true });
        await unlockPromise;

        // Responding again with the same requestId should be a no-op (no error thrown)
        await expect(responseHandler({}, { requestId: 1, accepted: false })).resolves.not.toThrow();
      });
    });

    describe("requestSign (via sign callback)", () => {
      const mockSignData = {
        cipherId: "cipher-abc",
        signRequest: {
          publicKey: { keyType: "Ed25519", keypair: "keypair-data" },
          processName: "ssh",
          isForwarding: false,
          namespace: "ssh",
        },
      } as unknown as sshagent_v2.SignRequestData;

      it("should send sshagent.signrequest with the correct fields", () => {
        void capturedSignCb(mockSignData);

        expect(mockMessagingService.send).toHaveBeenCalledWith("sshagent.signrequest", {
          cipherId: "cipher-abc",
          isListRequest: false,
          requestId: 1,
          processName: "ssh",
          isAgentForwarding: false,
          namespace: "ssh",
        });
      });

      it("should resolve with true when the renderer accepts", async () => {
        const signPromise = capturedSignCb(mockSignData);

        const responseHandler = ipcHandlers.get("sshagent.signrequestresponse")!;
        await responseHandler({}, { requestId: 1, accepted: true });

        expect(await signPromise).toBe(true);
      });

      it("should resolve with false when the renderer rejects", async () => {
        const signPromise = capturedSignCb(mockSignData);

        const responseHandler = ipcHandlers.get("sshagent.signrequestresponse")!;
        await responseHandler({}, { requestId: 1, accepted: false });

        expect(await signPromise).toBe(false);
      });
    });

    describe("sshagent.setkeys IPC handler", () => {
      const keys = [{ name: "My Key", privateKey: "key-data", cipherId: "cipher-1" }];

      it("should call setKeys with the provided keys", async () => {
        const handler = ipcHandlers.get("sshagent.setkeys")!;
        await handler({}, keys);

        expect(mockAgentStateV2.setKeys).toHaveBeenCalledWith(keys);
      });

      it("should not call setKeys when agent is not running", async () => {
        mockAgentStateV2.isRunning.mockReturnValue(false);

        const handler = ipcHandlers.get("sshagent.setkeys")!;
        await handler({}, keys);

        expect(mockAgentStateV2.setKeys).not.toHaveBeenCalled();
      });
    });

    describe("sshagent.lock IPC handler", () => {
      it("should call lock on the agent state", async () => {
        const handler = ipcHandlers.get("sshagent.lock")!;
        await handler({});

        expect(mockAgentStateV2.lock).toHaveBeenCalled();
      });

      it("should not call lock when agent is not running", async () => {
        mockAgentStateV2.isRunning.mockReturnValue(false);

        const handler = ipcHandlers.get("sshagent.lock")!;
        await handler({});

        expect(mockAgentStateV2.lock).not.toHaveBeenCalled();
      });
    });

    describe("sshagent.clearkeys IPC handler", () => {
      it("should call clearKeys on the agent state", async () => {
        const handler = ipcHandlers.get("sshagent.clearkeys")!;
        await handler({});

        expect(mockAgentStateV2.clearKeys).toHaveBeenCalled();
      });

      it("should call clearKeys even when agent is not running", async () => {
        mockAgentStateV2.isRunning.mockReturnValue(false);

        const handler = ipcHandlers.get("sshagent.clearkeys")!;
        await handler({});

        expect(mockAgentStateV2.clearKeys).toHaveBeenCalled();
      });
    });
  });
});
