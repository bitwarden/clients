import { DesktopIpcPeerClientType, isIpcClientTypeMessage } from "./ipc-message";

describe("isIpcClientTypeMessage", () => {
  it("accepts an announcement for a known client type", () => {
    expect(isIpcClientTypeMessage({ clientType: DesktopIpcPeerClientType.Cli })).toBe(true);
  });

  it("rejects an unknown client type, which must not become an endpoint", () => {
    expect(isIpcClientTypeMessage({ clientType: "web" })).toBe(false);
  });

  it.each([null, undefined, {}, { type: "bitwarden-ipc-message" }, "cli"])(
    "rejects %p",
    (message) => {
      expect(isIpcClientTypeMessage(message)).toBe(false);
    },
  );
});
