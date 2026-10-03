import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcClient, ipcRequestDiscover } from "@bitwarden/sdk-internal";

import { CliDesktopIpcTransport, ProxyConnection } from "./cli-desktop-ipc.transport";
import {
  CliIpcService,
  IPC_SOCKET_DIR_ENV,
  MINIMUM_BIOMETRIC_DESKTOP_VERSION,
} from "./cli-ipc.service";

jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  ipcRequestDiscover: jest.fn(),
}));

describe("CliIpcService", () => {
  const logService = mock<LogService>();
  const client = mock<IpcClient>();
  const transport = mock<CliDesktopIpcTransport>();

  let service: CliIpcService;

  /** Stands in for the transport's `proxyConnection` getter, which a mock leaves undefined. */
  function reportProxy(connection: ProxyConnection): void {
    Object.defineProperty(transport, "proxyConnection", {
      configurable: true,
      value: connection,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env[IPC_SOCKET_DIR_ENV];
    reportProxy({ connected: false });
    service = new CliIpcService(logService);
    Object.defineProperty(service, "_client", { configurable: true, value: client });
    Object.assign(service as object, {
      initialization: Promise.resolve(),
      transport,
    });
  });

  it("discovers the connected desktop version", async () => {
    jest.mocked(ipcRequestDiscover).mockResolvedValue({ version: "2026.9.0" });

    await expect(service.verifyDesktopConnection()).resolves.toBe("2026.9.0");
    expect(ipcRequestDiscover).toHaveBeenCalledWith(
      client,
      "DesktopRenderer",
      expect.any(AbortSignal),
    );

    await expect(service.verifyDesktopConnection()).resolves.toBe("2026.9.0");
    expect(ipcRequestDiscover).toHaveBeenCalledTimes(1);
  });

  it("disconnects and reports the minimum version when discovery fails", async () => {
    jest.mocked(ipcRequestDiscover).mockRejectedValue(new Error("request timed out"));

    await expect(service.verifyDesktopConnection()).rejects.toThrow(
      `Biometric unlock requires Bitwarden Desktop ${MINIMUM_BIOMETRIC_DESKTOP_VERSION} or newer`,
    );
    expect(transport.disconnect).toHaveBeenCalled();
  });

  it("disconnects when the discovered desktop version is too old", async () => {
    jest.mocked(ipcRequestDiscover).mockResolvedValue({ version: "2026.8.0" });

    await expect(service.verifyDesktopConnection()).rejects.toThrow(
      `Biometric unlock requires Bitwarden Desktop ${MINIMUM_BIOMETRIC_DESKTOP_VERSION} or newer`,
    );
    expect(transport.disconnect).toHaveBeenCalled();
  });

  describe("when the proxy connected but nothing answered", () => {
    beforeEach(() => {
      reportProxy({ connected: true, proxyPath: "/tmp/desktop_proxy" });
      jest.mocked(ipcRequestDiscover).mockRejectedValue(new Error("request timed out"));
    });

    it("names the proxy and the socket directory it was pointed at", async () => {
      process.env[IPC_SOCKET_DIR_ENV] = "/tmp/debug-sockets";

      await expect(service.verifyDesktopConnection()).rejects.toThrow(
        `The Bitwarden Desktop proxy at /tmp/desktop_proxy connected, but no desktop app answered`,
      );
      await expect(service.verifyDesktopConnection()).rejects.toThrow("/tmp/debug-sockets");
    });

    it("points out an unset socket directory, which a debug desktop app would have set", async () => {
      await expect(service.verifyDesktopConnection()).rejects.toThrow(
        `${IPC_SOCKET_DIR_ENV} is unset`,
      );
    });
  });
});
