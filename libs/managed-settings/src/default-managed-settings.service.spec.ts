import { firstValueFrom } from "rxjs";

import { ManagedSettingsClient } from "@bitwarden/sdk-internal";

import { DefaultManagedSettingsService } from "./default-managed-settings.service";

/**
 * Stands in for the SDK handle: holds a flat profile and calls every registered change callback
 * that has not been aborted.
 */
class FakeManagedSettingsClient {
  settings: Map<string, string> | undefined;
  listeners: { callback: () => void; signal?: AbortSignal }[] = [];

  get(key: string): string | undefined {
    return this.settings?.get(key);
  }

  is_managed(key: string): boolean {
    return this.settings?.has(key) ?? false;
  }

  on_profile_changed(callback: () => void, signal?: AbortSignal): void {
    this.listeners.push({ callback, signal });
  }

  /** Applies a profile the way `update_from_json` would, then signals the change. */
  apply(settings: Record<string, string> | undefined): void {
    this.settings = settings == null ? undefined : new Map(Object.entries(settings));
    this.listeners.filter((l) => !l.signal?.aborted).forEach((l) => l.callback());
  }
}

let fakeClient: FakeManagedSettingsClient;

jest.mock("@bitwarden/sdk-internal", () => ({
  ManagedSettingsClient: jest.fn().mockImplementation(() => fakeClient),
}));

/**
 * Collects every emission of `get$(key)` for the lifetime of the returned handle. Resolves once the
 * subscription is listening to the handle's change signal, which happens after the handle resolves.
 */
async function collect(service: DefaultManagedSettingsService, key: string) {
  const emissions: (string | undefined)[] = [];
  const subscription = service.get$(key).subscribe((value) => emissions.push(value));
  await settle();
  return { emissions, unsubscribe: () => subscription.unsubscribe() };
}

/** Lets pending promise callbacks run. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe("DefaultManagedSettingsService", () => {
  let service: DefaultManagedSettingsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeClient = new FakeManagedSettingsClient();
    service = new DefaultManagedSettingsService(Promise.resolve());
    await firstValueFrom(service.client$);
  });

  describe("before the SDK has loaded", () => {
    let pending: DefaultManagedSettingsService;
    let markSdkReady: () => void;

    beforeEach(() => {
      fakeClient.apply({ "environment.base": '"https://vault.example.com"' });
      pending = new DefaultManagedSettingsService(
        new Promise<void>((resolve) => (markSdkReady = resolve)),
      );
    });

    it("returns undefined from get", () => {
      expect(pending.get("environment.base")).toBeUndefined();
    });

    it("returns false from isManaged", () => {
      expect(pending.isManaged("environment.base")).toBe(false);
    });

    it("seeds get$ with undefined, then emits the value once the SDK loads", async () => {
      const { emissions, unsubscribe } = await collect(pending, "environment.base");
      expect(emissions).toEqual([undefined]);

      markSdkReady();
      await settle();

      expect(emissions).toEqual([undefined, '"https://vault.example.com"']);
      unsubscribe();
    });

    it("reads through the handle as soon as the SDK loads, without a subscriber", async () => {
      markSdkReady();
      await settle();

      expect(pending.get("environment.base")).toBe('"https://vault.example.com"');
    });
  });

  describe("get", () => {
    it("returns the raw JSON-encoded value for a managed key", () => {
      fakeClient.apply({ "environment.base": '"https://vault.example.com"' });

      expect(service.get("environment.base")).toBe('"https://vault.example.com"');
    });

    it("returns undefined for a key absent from the profile", () => {
      fakeClient.apply({ "environment.base": '"https://vault.example.com"' });

      expect(service.get("generator.password.length")).toBeUndefined();
    });

    it("returns undefined when no profile is active", () => {
      expect(service.get("environment.base")).toBeUndefined();
    });
  });

  describe("isManaged", () => {
    it("is true for a key present in the profile", () => {
      fakeClient.apply({ "environment.base": '"https://vault.example.com"' });

      expect(service.isManaged("environment.base")).toBe(true);
    });

    it("is true for a key whose value is JSON null, because presence implies forced", () => {
      fakeClient.apply({ "environment.base": "null" });

      expect(service.isManaged("environment.base")).toBe(true);
    });

    it("is false for a key absent from the profile", () => {
      fakeClient.apply({ "environment.base": '"https://vault.example.com"' });

      expect(service.isManaged("generator.password.length")).toBe(false);
    });
  });

  describe("get$", () => {
    it("emits the current value on subscribe", async () => {
      fakeClient.apply({ "environment.base": '"https://vault.example.com"' });

      await expect(firstValueFrom(service.get$("environment.base"))).resolves.toBe(
        '"https://vault.example.com"',
      );
    });

    it("re-emits when a profile change changes the value", async () => {
      const { emissions, unsubscribe } = await collect(service, "environment.base");

      fakeClient.apply({ "environment.base": '"https://vault.example.com"' });
      fakeClient.apply({ "environment.base": '"https://vault.other.com"' });

      expect(emissions).toEqual([
        undefined,
        '"https://vault.example.com"',
        '"https://vault.other.com"',
      ]);
      unsubscribe();
    });

    it("emits undefined when the key is withdrawn", async () => {
      const { emissions, unsubscribe } = await collect(service, "environment.base");

      fakeClient.apply({ "environment.base": '"https://vault.example.com"' });
      fakeClient.apply(undefined);

      expect(emissions).toEqual([undefined, '"https://vault.example.com"', undefined]);
      unsubscribe();
    });

    it("ignores a change to an unrelated key", async () => {
      const { emissions, unsubscribe } = await collect(service, "environment.base");

      fakeClient.apply({ "generator.password.length": "20" });

      expect(emissions).toEqual([undefined]);
      unsubscribe();
    });

    it("stops listening to the change signal on unsubscribe", async () => {
      const { unsubscribe } = await collect(service, "environment.base");

      unsubscribe();

      expect(fakeClient.listeners.every((l) => l.signal?.aborted)).toBe(true);
    });
  });

  describe("client$", () => {
    it("constructs the handle once across repeated subscriptions", async () => {
      const first = await firstValueFrom(service.client$);
      const second = await firstValueFrom(service.client$);

      expect(second).toBe(first);
      expect(ManagedSettingsClient).toHaveBeenCalledTimes(1);
    });
  });
});
