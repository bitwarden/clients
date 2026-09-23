import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";
import { ManagementProfile } from "@bitwarden/sdk-internal";

import { DesktopManagedSettingsService } from "./desktop-managed-settings.service";

function profile(settings: [string, string][]): ManagementProfile {
  return { version: 1, updatedAt: 0, settings: new Map(settings) };
}

function createSut(): DesktopManagedSettingsService {
  return new DesktopManagedSettingsService(new Promise(() => {}), mock<LogService>());
}

describe("DesktopManagedSettingsService", () => {
  let currentMock: jest.Mock<Promise<ManagementProfile | undefined>, []>;
  let onUpdatedMock: jest.Mock<void, [(profile: ManagementProfile | undefined) => void]>;
  let onUpdatedCallback: ((profile: ManagementProfile | undefined) => void) | undefined;

  beforeEach(() => {
    onUpdatedCallback = undefined;
    currentMock = jest.fn();
    onUpdatedMock = jest.fn((callback) => {
      onUpdatedCallback = callback;
    });

    (globalThis as any).ipc = {
      platform: {
        managedSettings: {
          current: currentMock,
          onUpdated: onUpdatedMock,
        },
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).ipc;
  });

  it("reflects a profile already active in the main process when current resolves", async () => {
    currentMock.mockResolvedValue(profile([["a", "1"]]));

    const service = createSut();
    await Promise.resolve();
    await Promise.resolve();

    expect(service.get("a")).toBe("1");
    expect(service.isManaged("a")).toBe(true);
  });

  it("reflects a profile pushed via onUpdated after construction", async () => {
    currentMock.mockResolvedValue(undefined);

    const service = createSut();
    await Promise.resolve();
    await Promise.resolve();

    onUpdatedCallback!(profile([["a", "1"]]));

    expect(service.get("a")).toBe("1");
  });

  it("re-emits to a get$ subscriber when a profile is pushed via onUpdated", async () => {
    currentMock.mockResolvedValue(undefined);

    const service = createSut();
    await Promise.resolve();
    await Promise.resolve();

    const values: (string | undefined)[] = [];
    service.get$("a").subscribe((v) => values.push(v));

    onUpdatedCallback!(profile([["a", "1"]]));

    expect(values).toEqual([undefined, "1"]);
  });

  it("clears a previously present key when undefined is pushed via onUpdated", async () => {
    currentMock.mockResolvedValue(undefined);

    const service = createSut();
    await Promise.resolve();
    await Promise.resolve();

    onUpdatedCallback!(profile([["a", "1"]]));
    expect(service.get("a")).toBe("1");

    onUpdatedCallback!(undefined);

    expect(service.get("a")).toBeUndefined();
  });

  it("registers onUpdated before invoking current", () => {
    const order: string[] = [];
    onUpdatedMock.mockImplementation((callback) => {
      order.push("onUpdated");
      onUpdatedCallback = callback;
    });
    currentMock.mockImplementation(() => {
      order.push("current");
      return Promise.resolve(undefined);
    });

    createSut();

    expect(order).toEqual(["onUpdated", "current"]);
  });

  it("does not clobber a profile pushed via onUpdated while current is still pending", async () => {
    let resolveCurrent!: (value: ManagementProfile | undefined) => void;
    currentMock.mockReturnValue(
      new Promise<ManagementProfile | undefined>((resolve) => {
        resolveCurrent = resolve;
      }),
    );

    const service = createSut();

    onUpdatedCallback!(profile([["a", "1"]]));
    expect(service.get("a")).toBe("1");

    resolveCurrent(undefined);
    await Promise.resolve();
    await Promise.resolve();

    expect(service.get("a")).toBe("1");
  });
});
