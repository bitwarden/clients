import { ipcMain } from "electron";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { RENDERER_TEARDOWN_FLAG_CHANNEL } from "../renderer-teardown-flag";

import { RendererTeardownFlagMain } from "./renderer-teardown-flag.main";
import { CachedBackend } from "./storage/cached-backend";

jest.mock("electron", () => ({ ipcMain: { handle: jest.fn() } }));

describe("RendererTeardownFlagMain", () => {
  const backendReading = (value: unknown) => ({ read: () => value }) as unknown as CachedBackend;

  const enabledFor = (flag: string) => ({
    global_config_byServer: { "https://vault.bitwarden.com": { featureStates: { [flag]: true } } },
  });

  beforeEach(() => jest.clearAllMocks());

  it("is enabled when a server has the flag on", () => {
    const sut = new RendererTeardownFlagMain(
      backendReading(enabledFor(FeatureFlag.DesktopRendererTeardown)),
    );

    expect(sut.isEnabled).toBe(true);
  });

  it("is disabled when no server has the flag on", () => {
    const sut = new RendererTeardownFlagMain(backendReading(enabledFor("some-other-flag")));

    expect(sut.isEnabled).toBe(false);
  });

  it("is disabled when there is no cached config at all", () => {
    const sut = new RendererTeardownFlagMain(backendReading({}));

    expect(sut.isEnabled).toBe(false);
  });

  it("is disabled rather than throwing when the cache cannot be read", () => {
    const sut = new RendererTeardownFlagMain({
      read: () => {
        throw new Error("unreadable");
      },
    } as unknown as CachedBackend);

    expect(sut.isEnabled).toBe(false);
  });

  it("answers the renderer with the value it resolved at startup", async () => {
    const sut = new RendererTeardownFlagMain(
      backendReading(enabledFor(FeatureFlag.DesktopRendererTeardown)),
    );

    const [channel, handler] = (ipcMain.handle as jest.Mock).mock.calls[0];
    expect(channel).toBe(RENDERER_TEARDOWN_FLAG_CHANNEL);
    expect(await handler()).toBe(sut.isEnabled);
  });
});
