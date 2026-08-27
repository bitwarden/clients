import { firstValueFrom } from "rxjs";

import { ManagedSettingsClient, ManagementProfile } from "@bitwarden/sdk-internal";

import { DefaultManagedSettingsService } from "./default-managed-settings.service";

const mockUpdateProfile = jest.fn();

jest.mock("@bitwarden/sdk-internal", () => ({
  ManagedSettingsClient: jest.fn().mockImplementation(() => ({
    update_profile: mockUpdateProfile,
  })),
}));

function profile(settings: Record<string, string>, updatedAt = 1000): ManagementProfile {
  return { version: 1, updatedAt, settings: new Map(Object.entries(settings)) };
}

/** Collects every emission of `get$(key)` for the lifetime of the returned handle. */
function collect(service: DefaultManagedSettingsService, key: string) {
  const emissions: (string | undefined)[] = [];
  const subscription = service.get$(key).subscribe((value) => emissions.push(value));
  return { emissions, unsubscribe: () => subscription.unsubscribe() };
}

describe("DefaultManagedSettingsService", () => {
  let service: DefaultManagedSettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DefaultManagedSettingsService(Promise.resolve());
  });

  describe("get", () => {
    it("returns the raw JSON-encoded value for a managed key", () => {
      service.updateProfile(profile({ "environment.base": '"https://vault.example.com"' }));

      expect(service.get("environment.base")).toBe('"https://vault.example.com"');
    });

    it("returns undefined for a key absent from the profile", () => {
      service.updateProfile(profile({ "environment.base": '"https://vault.example.com"' }));

      expect(service.get("generator.password.length")).toBeUndefined();
    });

    it("returns undefined before any profile is pushed", () => {
      expect(service.get("environment.base")).toBeUndefined();
    });
  });

  describe("isManaged", () => {
    it("is true for a key present in the profile", () => {
      service.updateProfile(profile({ "environment.base": '"https://vault.example.com"' }));

      expect(service.isManaged("environment.base")).toBe(true);
    });

    it("is true for a key whose value is JSON null, because presence implies forced", () => {
      service.updateProfile(profile({ "environment.base": "null" }));

      expect(service.isManaged("environment.base")).toBe(true);
    });

    it("is false for a key absent from the profile", () => {
      service.updateProfile(profile({ "environment.base": '"https://vault.example.com"' }));

      expect(service.isManaged("generator.password.length")).toBe(false);
    });

    it("is false before any profile is pushed", () => {
      expect(service.isManaged("environment.base")).toBe(false);
    });
  });

  describe("updateProfile", () => {
    it("replaces the previously pushed profile", () => {
      service.updateProfile(profile({ "environment.base": '"https://vault.example.com"' }));

      service.updateProfile(profile({ "generator.password.length": "20" }));

      expect(service.get("environment.base")).toBeUndefined();
      expect(service.isManaged("environment.base")).toBe(false);
      expect(service.get("generator.password.length")).toBe("20");
    });

    it("clears the profile when passed undefined", () => {
      service.updateProfile(profile({ "environment.base": '"https://vault.example.com"' }));

      service.updateProfile(undefined);

      expect(service.get("environment.base")).toBeUndefined();
      expect(service.isManaged("environment.base")).toBe(false);
    });
  });

  describe("get$", () => {
    it("emits the current value on subscribe, before any push", async () => {
      await expect(firstValueFrom(service.get$("environment.base"))).resolves.toBeUndefined();
    });

    it("seeds a late subscriber with the already-pushed value", async () => {
      service.updateProfile(profile({ "environment.base": '"https://vault.example.com"' }));

      await expect(firstValueFrom(service.get$("environment.base"))).resolves.toBe(
        '"https://vault.example.com"',
      );
    });

    it("re-emits when a pushed profile changes the value", () => {
      const { emissions, unsubscribe } = collect(service, "environment.base");

      service.updateProfile(profile({ "environment.base": '"https://vault.example.com"' }));
      service.updateProfile(profile({ "environment.base": '"https://vault.other.com"' }));

      expect(emissions).toEqual([
        undefined,
        '"https://vault.example.com"',
        '"https://vault.other.com"',
      ]);
      unsubscribe();
    });

    it("emits undefined when the key is withdrawn from a later profile", () => {
      const { emissions, unsubscribe } = collect(service, "environment.base");

      service.updateProfile(profile({ "environment.base": '"https://vault.example.com"' }));
      service.updateProfile(undefined);

      expect(emissions).toEqual([undefined, '"https://vault.example.com"', undefined]);
      unsubscribe();
    });

    it("suppresses a re-push that only re-stamps updatedAt", () => {
      const settings = { "environment.base": '"https://vault.example.com"' };
      const { emissions, unsubscribe } = collect(service, "environment.base");

      service.updateProfile(profile(settings, 1000));
      service.updateProfile(profile(settings, 2000));

      expect(emissions).toEqual([undefined, '"https://vault.example.com"']);
      unsubscribe();
    });

    it("ignores a change to an unrelated key", () => {
      const { emissions, unsubscribe } = collect(service, "environment.base");

      service.updateProfile(profile({ "generator.password.length": "20" }));

      expect(emissions).toEqual([undefined]);
      unsubscribe();
    });
  });

  describe("client$", () => {
    it("does not construct the SDK handle until subscribed", () => {
      service.updateProfile(profile({ "environment.base": '"https://vault.example.com"' }));

      expect(ManagedSettingsClient).not.toHaveBeenCalled();
    });

    it("applies a profile pushed before the SDK was ready", async () => {
      let markSdkReady: () => void = () => {
        throw new Error("sdkReady executor did not run");
      };
      const sdkReady = new Promise<void>((resolve) => {
        markSdkReady = resolve;
      });
      const pending = new DefaultManagedSettingsService(sdkReady);
      const pushed = profile({ "environment.base": '"https://vault.example.com"' });

      pending.updateProfile(pushed);
      const client = firstValueFrom(pending.client$);
      expect(mockUpdateProfile).not.toHaveBeenCalled();

      markSdkReady();
      await client;

      expect(mockUpdateProfile).toHaveBeenCalledWith(pushed);
    });

    it("forwards a profile pushed after the handle exists", async () => {
      await firstValueFrom(service.client$);
      const pushed = profile({ "environment.base": '"https://vault.example.com"' });

      service.updateProfile(pushed);

      expect(mockUpdateProfile).toHaveBeenLastCalledWith(pushed);
    });

    it("forwards a cleared profile to the handle", async () => {
      await firstValueFrom(service.client$);

      service.updateProfile(undefined);

      expect(mockUpdateProfile).toHaveBeenLastCalledWith(undefined);
    });

    it("constructs the handle once across repeated subscriptions", async () => {
      const first = await firstValueFrom(service.client$);
      const second = await firstValueFrom(service.client$);

      expect(second).toBe(first);
    });
  });
});
