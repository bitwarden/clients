import { DefaultManagedSettingsService } from "./default-managed-settings.service";
import { ManagementProfile } from "./management-profile";

describe("DefaultManagedSettingsService", () => {
  let service: DefaultManagedSettingsService;

  beforeEach(() => {
    service = new DefaultManagedSettingsService();
  });

  it("returns undefined from get before any profile is set", () => {
    expect(service.get("a")).toBeUndefined();
  });

  it("returns false from isManaged before any profile is set", () => {
    expect(service.isManaged("a")).toBe(false);
  });

  describe("after updateProfile", () => {
    const profile: ManagementProfile = {
      version: 1,
      updatedAt: 0,
      settings: new Map([["a", "1"]]),
    };

    beforeEach(() => {
      service.updateProfile(profile);
    });

    it("returns the value for a managed key", () => {
      expect(service.get("a")).toBe("1");
    });

    it("returns undefined for an unmanaged key", () => {
      expect(service.get("b")).toBeUndefined();
    });

    it("returns true from isManaged for a managed key", () => {
      expect(service.isManaged("a")).toBe(true);
    });

    it("returns false from isManaged for an unmanaged key", () => {
      expect(service.isManaged("b")).toBe(false);
    });

    it("returns undefined from get after the profile is cleared", () => {
      service.updateProfile(undefined);

      expect(service.get("a")).toBeUndefined();
    });
  });

  describe("get$", () => {
    it("emits the seeded value on subscribe", () => {
      service.updateProfile({ version: 1, updatedAt: 0, settings: new Map([["a", "1"]]) });

      const values: (string | undefined)[] = [];
      service.get$("a").subscribe((v) => values.push(v));

      expect(values).toEqual(["1"]);
    });

    it("re-emits when updateProfile changes the value", () => {
      const values: (string | undefined)[] = [];
      service.get$("a").subscribe((v) => values.push(v));

      service.updateProfile({ version: 1, updatedAt: 0, settings: new Map([["a", "1"]]) });

      expect(values).toEqual([undefined, "1"]);
    });
  });
});
