import { ipcRenderer } from "electron";

import { AUTOTYPE_MVP_IPC_CHANNELS } from "./models/ipc-channels";
import preload from "./preload";

// Mock electron modules
jest.mock("electron", () => ({
  ipcRenderer: {
    on: jest.fn(),
    send: jest.fn(),
    removeListener: jest.fn(),
  },
}));

describe("autofill preload", () => {
  beforeEach(() => {
    // Reset, not clear: some tests below install their own mock implementations.
    jest.resetAllMocks();
  });

  afterEach(() => {
    // The bound-listener reference lives at module scope in preload.ts and
    // persists across tests in this file -- clear it so each test starts
    // with no listener bound.
    preload.stopListeningAutotypeRequestMvp();
  });

  describe("listenAutotypeRequestMvp", () => {
    it("registers a listener on the LISTEN channel", () => {
      preload.listenAutotypeRequestMvp(jest.fn());

      expect(ipcRenderer.on).toHaveBeenCalledWith(
        AUTOTYPE_MVP_IPC_CHANNELS.LISTEN,
        expect.any(Function),
      );
      expect(ipcRenderer.removeListener).not.toHaveBeenCalled();
    });

    it("removes the previous listener before registering a new one when called repeatedly", () => {
      const callOrder: string[] = [];
      (ipcRenderer.on as jest.Mock).mockImplementation(() => callOrder.push("on"));
      (ipcRenderer.removeListener as jest.Mock).mockImplementation(() =>
        callOrder.push("removeListener"),
      );

      preload.listenAutotypeRequestMvp(jest.fn());
      preload.listenAutotypeRequestMvp(jest.fn());

      // Every registration after the first is preceded by a removal, so at
      // most one listener is ever bound to the channel.
      expect(callOrder).toEqual(["on", "removeListener", "on"]);
    });

    it("removes exactly the handler it previously registered", () => {
      preload.listenAutotypeRequestMvp(jest.fn());
      const [, firstHandler] = (ipcRenderer.on as jest.Mock).mock.calls[0];

      preload.listenAutotypeRequestMvp(jest.fn());

      expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
        AUTOTYPE_MVP_IPC_CHANNELS.LISTEN,
        firstHandler,
      );
    });
  });

  describe("stopListeningAutotypeRequestMvp", () => {
    it("removes the bound listener", () => {
      preload.listenAutotypeRequestMvp(jest.fn());
      const [, handler] = (ipcRenderer.on as jest.Mock).mock.calls[0];

      preload.stopListeningAutotypeRequestMvp();

      expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
        AUTOTYPE_MVP_IPC_CHANNELS.LISTEN,
        handler,
      );
    });

    it("does nothing when no listener is bound", () => {
      preload.stopListeningAutotypeRequestMvp();

      expect(ipcRenderer.removeListener).not.toHaveBeenCalled();
    });

    it("is safe to call twice in a row", () => {
      preload.listenAutotypeRequestMvp(jest.fn());

      preload.stopListeningAutotypeRequestMvp();
      preload.stopListeningAutotypeRequestMvp();

      expect(ipcRenderer.removeListener).toHaveBeenCalledTimes(1);
    });
  });
});
