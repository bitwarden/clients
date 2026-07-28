import { ipcRenderer } from "electron";

import { AUTOTYPE_MVP_IPC_CHANNELS } from "./models/ipc-channels";
import preload from "./preload";

// Mock electron modules
jest.mock("electron", () => ({
  ipcRenderer: {
    on: jest.fn(),
    send: jest.fn(),
    removeAllListeners: jest.fn(),
  },
}));

describe("autofill preload", () => {
  beforeEach(() => {
    // Reset, not clear: tests below install their own mock implementations.
    jest.resetAllMocks();
  });

  describe("listenAutotypeRequestMvp", () => {
    it("clears any existing listener before registering a new one", () => {
      preload.listenAutotypeRequestMvp(jest.fn());

      expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith(AUTOTYPE_MVP_IPC_CHANNELS.LISTEN);
      expect(ipcRenderer.on).toHaveBeenCalledWith(
        AUTOTYPE_MVP_IPC_CHANNELS.LISTEN,
        expect.any(Function),
      );
    });

    it("does not stack listeners when called repeatedly", () => {
      const callOrder: string[] = [];
      (ipcRenderer.removeAllListeners as jest.Mock).mockImplementation(() =>
        callOrder.push("removeAllListeners"),
      );
      (ipcRenderer.on as jest.Mock).mockImplementation(() => callOrder.push("on"));

      preload.listenAutotypeRequestMvp(jest.fn());
      preload.listenAutotypeRequestMvp(jest.fn());

      // Every registration is preceded by a removal, so at most one listener
      // is ever bound to the channel.
      expect(callOrder).toEqual(["removeAllListeners", "on", "removeAllListeners", "on"]);
    });
  });
});
