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
    replace: jest.Mock;
    stop: jest.Mock;
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
      replace: jest.fn(),
      stop: jest.fn(),
    };

    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: Function) => {
      ipcHandlers.set(channel, handler);
    });
  });

  describe("v2 (useV2 = true)", () => {
    let capturedSignCb: (data: sshagent_v2.SignRequestData) => Promise<boolean>;

    beforeEach(async () => {
      (sshagent_v2.SshAgentState.serve as jest.Mock).mockImplementation((sign: Function) => {
        capturedSignCb = sign as any;
        return Promise.resolve(mockAgentStateV2);
      });

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
      it("should register sshagent.replace IPC handler", () => {
        expect(ipcHandlers.has("sshagent.replace")).toBe(true);
      });

      it("should register sshagent.signrequestresponse IPC handler", () => {
        expect(ipcHandlers.has("sshagent.signrequestresponse")).toBe(true);
      });

      it("should register sshagent.stop IPC handler", () => {
        expect(ipcHandlers.has("sshagent.stop")).toBe(true);
      });

      it("should not register sshagent.lock IPC handler", () => {
        expect(ipcHandlers.has("sshagent.lock")).toBe(false);
      });
    });

    describe("sshagent.isloaded IPC handler", () => {
      it("should return false before sshagent.init IPC is called", async () => {
        // Create a fresh service that has not received the INIT IPC call
        new MainSshAgentService(mockLogService, mockMessagingService);
        const handler = ipcHandlers.get("sshagent.isloaded")!;
        expect(await handler({})).toBe(false);
      });

      it("should return agentStateV2.isRunning() after sshagent.init IPC resolves", async () => {
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
      it("should call sshagent_v2.SshAgentState.serve with sign callback only", () => {
        expect(sshagent_v2.SshAgentState.serve).toHaveBeenCalledWith(expect.any(Function));
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

      it("should not re-register V2 IPC handlers on a second INIT call", async () => {
        const handleCallCount = (ipcMain.handle as jest.Mock).mock.calls.length;

        await ipcHandlers.get("sshagent.init")!({}, { useV2: true });

        expect((ipcMain.handle as jest.Mock).mock.calls.length).toBe(handleCallCount);
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

    describe("sshagent.replace IPC handler", () => {
      const keys = [{ name: "My Key", privateKey: "key-data", cipherId: "cipher-1" }];

      it("should call replace with the provided keys", async () => {
        const handler = ipcHandlers.get("sshagent.replace")!;
        await handler({}, keys);

        expect(mockAgentStateV2.replace).toHaveBeenCalledWith(keys);
      });

      it("should not call replace when agent is not running", async () => {
        mockAgentStateV2.isRunning.mockReturnValue(false);

        const handler = ipcHandlers.get("sshagent.replace")!;
        await handler({}, keys);

        expect(mockAgentStateV2.replace).not.toHaveBeenCalled();
      });
    });

    describe("sshagent.stop IPC handler", () => {
      it("should call stop on the agent state", async () => {
        const handler = ipcHandlers.get("sshagent.stop")!;
        await handler({});

        expect(mockAgentStateV2.stop).toHaveBeenCalled();
      });

      it("should be a no-op when called a second time after the agent is cleared", async () => {
        const handler = ipcHandlers.get("sshagent.stop")!;
        await handler({});
        mockAgentStateV2.stop.mockClear();

        // agentStateV2 is now null; second call should not throw or call stop again
        await expect(handler({})).resolves.not.toThrow();
        expect(mockAgentStateV2.stop).not.toHaveBeenCalled();
      });

      it("should allow the server to restart via INIT after a stop", async () => {
        (sshagent_v2.SshAgentState.serve as jest.Mock).mockClear();

        const stopHandler = ipcHandlers.get("sshagent.stop")!;
        await stopHandler({});

        await ipcHandlers.get("sshagent.init")!({}, { useV2: true });
        await Promise.resolve();

        expect(sshagent_v2.SshAgentState.serve).toHaveBeenCalledTimes(1);
      });
    });
  });
});
