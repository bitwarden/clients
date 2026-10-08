/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { ipcMain } from "electron";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { agent_access, sshagent } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";

import { WindowMain } from "../../main/window.main";

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
  let mockAnswer: jest.Mock;
  let windowMain: { win: { isDestroyed: () => boolean } | null };
  let showWindow: jest.Mock;

  let ipcHandlers: Map<string, Function>;
  let mockAgentState: {
    isRunning: jest.Mock;
    replace: jest.Mock;
    stop: jest.Mock;
  };

  let capturedSignCb: (
    err: Error | null,
    request: agent_access.AgentRequest,
  ) => Promise<agent_access.AgentOutcome>;
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

    mockAnswer = jest.fn();
    windowMain = { win: { isDestroyed: () => false } };
    showWindow = jest.fn().mockResolvedValue(undefined);

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

    createService();
    await ipcHandlers.get("sshagent.init")!({});
    await Promise.resolve(); // let agentState settle
  });

  function createService() {
    return new MainSshAgentService(
      mockLogService,
      mockMessagingService,
      windowMain as unknown as WindowMain,
      showWindow,
      mockAnswer,
    );
  }

  const sentListRequest = () => mockMessagingService.send.mock.calls.at(-1)?.[1];

  describe("constructor", () => {
    // Handlers are registered up front rather than on INIT, so a call that arrives before the
    // agent is started is a no-op instead of an Electron "No handler registered" throw.
    it.each([
      "sshagent.init",
      "sshagent.isloaded",
      "sshagent.replace",
      "sshagent.stop",
      "sshagent.ready",
      "sshagent.listkeysresponse",
    ])("should register the %s IPC handler", (channel) => {
      expect(ipcHandlers.has(channel)).toBe(true);
    });
  });

  describe("sshagent.isloaded IPC handler", () => {
    it("should return false before sshagent.init IPC is called", async () => {
      // Create a fresh service that has not received the INIT IPC call
      createService();
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
      createService();
      await ipcHandlers.get("sshagent.init")!({});
      await Promise.resolve(); // propagates rejection through .then()
      await Promise.resolve(); // .catch() handler runs

      expect(mockLogService.error).toHaveBeenCalledWith("SSH agent encountered an error: ", error);
    });
  });

  describe("sign callback", () => {
    it("should answer through the shared agent request broker", async () => {
      const request = {} as agent_access.AgentRequest;
      const outcome = {} as agent_access.AgentOutcome;
      mockAnswer.mockResolvedValue(outcome);

      expect(await capturedSignCb(null, request)).toBe(outcome);
      expect(mockAnswer).toHaveBeenCalledWith(request);
    });
  });

  describe("list callback", () => {
    it("should hold the request until the renderer is ready, then send it with an id and deadline", () => {
      void capturedListCb(null);
      expect(mockMessagingService.send).not.toHaveBeenCalled();

      ipcHandlers.get("sshagent.ready")!();

      expect(mockMessagingService.send).toHaveBeenCalledWith("sshagent.listkeysrequest", {
        requestId: expect.any(Number),
        deadline: expect.any(Number),
      });
    });

    it.each([true, false])("should resolve with the renderer's answer (%s)", async (accepted) => {
      ipcHandlers.get("sshagent.ready")!();
      const listPromise = capturedListCb(null);

      const { requestId } = sentListRequest();
      await ipcHandlers.get("sshagent.listkeysresponse")!({}, { requestId, accepted });

      expect(await listPromise).toBe(accepted);
    });

    it("should open a window when none is open", () => {
      windowMain.win = null;

      void capturedListCb(null);

      expect(showWindow).toHaveBeenCalled();
    });

    it("should refuse pending requests when the agent stops", async () => {
      const listPromise = capturedListCb(null);

      await ipcHandlers.get("sshagent.stop")!({});

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
