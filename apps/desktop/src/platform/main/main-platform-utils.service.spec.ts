import { ClientType, DeviceType } from "@bitwarden/common/enums";

import { MainPlatformUtilsService } from "./main-platform-utils.service";

jest.mock("electron", () => ({
  app: { getVersion: jest.fn(() => "2024.1.2") },
}));

jest.mock("../../utils", () => ({
  isDev: jest.fn(() => false),
  isMacAppStore: jest.fn(() => false),
}));

describe("MainPlatformUtilsService", () => {
  let service: MainPlatformUtilsService;

  beforeEach(() => {
    service = new MainPlatformUtilsService();
  });

  it("reports the Desktop client type", () => {
    expect(service.getClientType()).toBe(ClientType.Desktop);
  });

  it("maps the current platform to a Desktop device type", () => {
    const expected =
      process.platform === "win32"
        ? DeviceType.WindowsDesktop
        : process.platform === "darwin"
          ? DeviceType.MacOsDesktop
          : DeviceType.LinuxDesktop;
    expect(service.getDevice()).toBe(expected);
  });

  it("supports secure storage (OS credential store)", () => {
    expect(service.supportsSecureStorage()).toBe(true);
  });

  it("parses the application version number, stripping build/pre-release suffixes", async () => {
    await expect(service.getApplicationVersionNumber()).resolves.toBe("2024.1.2");
  });

  it("throws for UI-only members that are unreachable from the main SDK stack", () => {
    expect(() => service.launchUri("https://example.com")).toThrow();
    expect(() => service.copyToClipboard("x")).toThrow();
  });
});
