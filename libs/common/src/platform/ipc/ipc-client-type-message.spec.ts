import { DesktopIpcPeerClientType, isIpcClientTypeMessage } from "./ipc-message";

describe("isIpcClientTypeMessage", () => {
  it("accepts an announcement for a known client type", () => {
    expect(isIpcClientTypeMessage({ clientType: DesktopIpcPeerClientType.Cli })).toBe(true);
  });

  it("rejects an unknown client type, which must not become an endpoint", () => {
    expect(isIpcClientTypeMessage({ clientType: "web" })).toBe(false);
  });

  it.each([
    ["a Chrome", "a".repeat(32)],
    ["a Firefox", "{00000000-0000-0000-0000-000000000000}"],
  ])("accepts %s extension id", (_, extensionId) => {
    expect(
      isIpcClientTypeMessage({ clientType: DesktopIpcPeerClientType.Chrome, extensionId }),
    ).toBe(true);
  });

  it.each([42, { id: "x" }, "a".repeat(129)])(
    "rejects extension id %p, which would reach the log unchecked",
    (extensionId) => {
      expect(
        isIpcClientTypeMessage({ clientType: DesktopIpcPeerClientType.Cli, extensionId }),
      ).toBe(false);
    },
  );

  it.each([null, undefined, {}, { type: "bitwarden-ipc-message" }, "cli"])(
    "rejects %p",
    (message) => {
      expect(isIpcClientTypeMessage(message)).toBe(false);
    },
  );
});
