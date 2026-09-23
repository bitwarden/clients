import { ipcMain } from "electron";
import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/logging";
import { DefaultManagedSettingsService } from "@bitwarden/managed-settings";
import { ManagementProfile } from "@bitwarden/sdk-internal";

import { WindowMain } from "../../../main/window.main";
import { DesktopManagedSettingsService } from "../../services/desktop-managed-settings.service";

import { ManagedSettingsSource } from "./managed-settings-source";
import { ManagedSettingsMain } from "./managed-settings.main";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() },
}));

// Reads resolve against the JavaScript copy of the profile, so the SDK never needs to load.
const sdkNeverReady = new Promise<void>(() => {});

const CONTAINER = JSON.stringify({
  environment: { base: "https://vault.example.com" },
  appearance: { theme: "dark", compactMode: true },
});

/**
 * Exercises acquisition end to end without Electron, wiring the real main-process
 * {@link ManagedSettingsMain} to the real renderer-side {@link DesktopManagedSettingsService}
 * across a stand-in for the IPC boundary. What it proves is the breakdown's success criterion:
 * one container value resolves to the same dotted keys in both processes.
 */
describe("managed settings replication from the main process to the renderer", () => {
  let source: { location: string; read: jest.Mock; watch: jest.Mock };
  let onHostChanged: () => void;
  let mainService: DefaultManagedSettingsService;
  let rendererService: DesktopManagedSettingsService;

  /** Stands in for `webContents.send` paired with `ipcRenderer.on`. */
  const rendererListeners: ((profile: ManagementProfile | undefined) => void)[] = [];

  beforeEach(async () => {
    rendererListeners.length = 0;

    source = {
      location: "test location",
      read: jest.fn().mockResolvedValue(CONTAINER),
      watch: jest.fn().mockImplementation((onChanged: () => void) => {
        onHostChanged = onChanged;
        return Promise.resolve();
      }),
    };

    const windowMain = {
      win: {
        webContents: {
          send: (_channel: string, profile: ManagementProfile | undefined) =>
            rendererListeners.forEach((listener) => listener(profile)),
        },
      },
    } as unknown as WindowMain;

    mainService = new DefaultManagedSettingsService(sdkNeverReady);
    const main = new ManagedSettingsMain(
      source as unknown as ManagedSettingsSource,
      mainService,
      windowMain,
      mock<LogService>(),
    );
    await main.init();

    (globalThis as any).ipc = {
      platform: {
        managedSettings: {
          current: () => Promise.resolve(main.current()),
          onUpdated: (callback: (profile: ManagementProfile | undefined) => void) =>
            rendererListeners.push(callback),
        },
      },
    };

    rendererService = new DesktopManagedSettingsService(sdkNeverReady, mock<LogService>());
    // Let the renderer's `current` pull settle before any assertion.
    await Promise.resolve();
  });

  afterEach(() => {
    delete (globalThis as any).ipc;
    (ipcMain.handle as jest.Mock).mockClear();
  });

  it("resolves the same dotted keys in both processes", () => {
    for (const service of [mainService, rendererService]) {
      expect(service.get("environment.base")).toBe('"https://vault.example.com"');
      expect(service.get("appearance.theme")).toBe('"dark"');
      expect(service.get("appearance.compactMode")).toBe("true");
    }
  });

  it("reports an unmanaged key as unmanaged in both processes", () => {
    for (const service of [mainService, rendererService]) {
      expect(service.isManaged("environment.base")).toBe(true);
      expect(service.isManaged("environment.api")).toBe(false);
    }
  });

  it("applies a profile that changes after startup without a restart", async () => {
    source.read.mockResolvedValue(JSON.stringify({ environment: { base: "https://other.test" } }));

    onHostChanged();
    await Promise.resolve();

    for (const service of [mainService, rendererService]) {
      expect(service.get("environment.base")).toBe('"https://other.test"');
    }
  });

  it("clears the profile in both processes when the container value is withdrawn", async () => {
    source.read.mockResolvedValue(undefined);

    onHostChanged();
    await Promise.resolve();

    for (const service of [mainService, rendererService]) {
      expect(service.get("environment.base")).toBeUndefined();
      expect(service.isManaged("environment.base")).toBe(false);
    }
  });

  it("re-emits on a renderer get$ subscriber when the host profile changes", async () => {
    const emissions: (string | undefined)[] = [];
    rendererService.get$("environment.base").subscribe((value) => emissions.push(value));

    source.read.mockResolvedValue(JSON.stringify({ environment: { base: "https://other.test" } }));
    onHostChanged();
    await Promise.resolve();

    expect(emissions).toEqual(['"https://vault.example.com"', '"https://other.test"']);
  });

  it("leaves both processes unmanaged when the container value is not valid JSON", async () => {
    source.read.mockResolvedValue("not json");

    onHostChanged();
    await Promise.resolve();

    for (const service of [mainService, rendererService]) {
      expect(await firstValueFrom(service.get$("environment.base"))).toBeUndefined();
    }
  });
});
