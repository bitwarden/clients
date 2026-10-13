/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { ipcMain } from "electron";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { sshagent } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";

import { MainSshAgentService } from "./main-ssh-agent.service";

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  sshagent: {
    SshAgentState: {
      serve: jest.fn(),
    },
  },
}));

describe("MainSshAgentService", () => {
  let mockLogService: jest.Mocked<LogService>;
  let mockMessagingService: jest.Mocked<MessagingService>;

  let ipcHandlers: Map<string, Function>;
  let mockAgentState: {
    isRunning: jest.Mock;
    replace: jest.Mock;
    stop: jest.Mock;
  };

  let capturedSignCb: (err: Error | null, data: sshagent.SignRequestData) => Promise<boolean>;
  let capturedListCb: (err: Error | null) => Promise<boolean>;

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
      replace: jest.fn(),
      stop: jest.fn(),
    };

    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: Function) => {
      ipcHandlers.set(channel, handler);
    });

    (sshagent.SshAgentState.serve as jest.Mock).mockImplementation(
      (sign: Function, list: Function) => {
        capturedSignCb = sign as any;
        capturedListCb = list as any;
        return Promise.resolve(mockAgentState);
      },
    );

    new MainSshAgentService(mockLogService, mockMessagingService);
    await ipcHandlers.get("sshagent.init")!({});
    await Promise.resolve(); // let agentState settle
  });

  describe("constructor", () => {
    // Handlers are registered up front rather than on INIT, so a call that arrives before the
    // agent is started is a no-op instead of an Electron "No handler registered" throw.
    it.each([
      "sshagent.init",
      "sshagent.isloaded",
      "sshagent.replace",
      "sshagent.signrequestresponse",
      "sshagent.stop",
      "sshagent.listkeysresponse",
    ])("should register the %s IPC handler", (channel) => {
      expect(ipcHandlers.has(channel)).toBe(true);
    });
  });

  describe("sshagent.isloaded IPC handler", () => {
    it("should return false before sshagent.init IPC is called", async () => {
      // Create a fresh service that has not received the INIT IPC call
      new MainSshAgentService(mockLogService, mockMessagingService);
      const handler = ipcHandlers.get("sshagent.isloaded")!;
      expect(await handler({})).toBe(false);
    });

    it("should return agentState.isRunning() after sshagent.init IPC resolves", async () => {
      const handler = ipcHandlers.get("sshagent.isloaded")!;
      expect(await handler({})).toBe(true);
    });

    it("should return false after sshagent.stop is called", async () => {
      await ipcHandlers.get("sshagent.stop")!({});
      const handler = ipcHandlers.get("sshagent.isloaded")!;
      expect(await handler({})).toBe(false);
    });
  });

  describe("sshagent.init IPC handler", () => {
    it("should call sshagent.SshAgentState.serve with sign and list callbacks", () => {
      expect(sshagent.SshAgentState.serve).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
      );
    });

    it("should log success after serve resolves", async () => {
      expect(mockLogService.info).toHaveBeenCalledWith("SSH agent started");
    });

    it("should log error if serve rejects", async () => {
      const error = new Error("napi bind failed");
      (sshagent.SshAgentState.serve as jest.Mock).mockRejectedValueOnce(error);

      // Re-create service and invoke INIT again with the rejecting mock
      new MainSshAgentService(mockLogService, mockMessagingService);
      await ipcHandlers.get("sshagent.init")!({});
      await Promise.resolve(); // propagates rejection through .then()
      await Promise.resolve(); // .catch() handler runs

      expect(mockLogService.error).toHaveBeenCalledWith("SSH agent encountered an error: ", error);
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
    } as unknown as sshagent.SignRequestData;

    it("should send sshagent.signrequest with the correct fields", () => {
      void capturedSignCb(null, mockSignData);

      expect(mockMessagingService.send).toHaveBeenCalledWith("sshagent.signrequest", {
        cipherId: "cipher-abc",
        requestId: 1,
        processName: "ssh",
        isAgentForwarding: false,
        namespace: "ssh",
        hostFingerprint: undefined,
      });
    });

    it("should resolve with true when the renderer accepts", async () => {
      const signPromise = capturedSignCb(null, mockSignData);

      const responseHandler = ipcHandlers.get("sshagent.signrequestresponse")!;
      await responseHandler({}, { requestId: 1, accepted: true });

      expect(await signPromise).toBe(true);
    });

    it("should resolve with false when the renderer rejects", async () => {
      const signPromise = capturedSignCb(null, mockSignData);

      const responseHandler = ipcHandlers.get("sshagent.signrequestresponse")!;
      await responseHandler({}, { requestId: 1, accepted: false });

      expect(await signPromise).toBe(false);
    });
  });

  describe("requestListKeys (via list callback)", () => {
    it("should send sshagent.listkeysrequest with a requestId", () => {
      void capturedListCb(null);

      expect(mockMessagingService.send).toHaveBeenCalledWith("sshagent.listkeysrequest", {
        requestId: expect.any(Number),
      });
    });

    it("should resolve with true when the renderer accepts", async () => {
      const listPromise = capturedListCb(null);

      const responseHandler = ipcHandlers.get("sshagent.listkeysresponse")!;
      await responseHandler({}, { requestId: 1, accepted: true });

      expect(await listPromise).toBe(true);
    });

    it("should resolve with false when the renderer rejects", async () => {
      const listPromise = capturedListCb(null);

      const responseHandler = ipcHandlers.get("sshagent.listkeysresponse")!;
      await responseHandler({}, { requestId: 1, accepted: false });

      expect(await listPromise).toBe(false);
    });
  });

  describe("sshagent.replace IPC handler", () => {
    const keys = [{ name: "My Key", privateKey: "key-data", cipherId: "cipher-1" }];

    it("should call replace with the provided keys", async () => {
      const handler = ipcHandlers.get("sshagent.replace")!;
      await handler({}, keys);

      expect(mockAgentState.replace).toHaveBeenCalledWith(keys);
    });

    it("should not call replace when agent is not running", async () => {
      mockAgentState.isRunning.mockReturnValue(false);

      const handler = ipcHandlers.get("sshagent.replace")!;
      await handler({}, keys);

      expect(mockAgentState.replace).not.toHaveBeenCalled();
    });
  });

  describe("sshagent.stop IPC handler", () => {
    it("should call stop on the agent state", async () => {
      const handler = ipcHandlers.get("sshagent.stop")!;
      await handler({});

      expect(mockAgentState.stop).toHaveBeenCalled();
    });

    it("should be a no-op when called a second time after the agent is cleared", async () => {
      const handler = ipcHandlers.get("sshagent.stop")!;
      await handler({});
      mockAgentState.stop.mockClear();

      // agentState is now null; second call should not throw or call stop again
      await expect(handler({})).resolves.not.toThrow();
      expect(mockAgentState.stop).not.toHaveBeenCalled();
    });

    it("should allow the server to restart via INIT after a stop", async () => {
      (sshagent.SshAgentState.serve as jest.Mock).mockClear();

      const stopHandler = ipcHandlers.get("sshagent.stop")!;
      await stopHandler({});

      await ipcHandlers.get("sshagent.init")!({});
      await Promise.resolve();

      expect(sshagent.SshAgentState.serve).toHaveBeenCalledTimes(1);
    });
  });
});
