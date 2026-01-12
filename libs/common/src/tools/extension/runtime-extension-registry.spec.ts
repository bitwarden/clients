import { deepFreeze } from "../util";

import { Field, Site, Permission } from "./data";
import { ExtensionSite } from "./extension-site";
import { DefaultFields, DefaultSites } from "./metadata";
import { RuntimeExtensionRegistry } from "./runtime-extension-registry";
import { ExtensionMetadata, SiteId, SiteMetadata, VendorMetadata } from "./type";
import { Bitwarden } from "./vendor/bitwarden";

// arbitrary test entities
const SomeSiteId: SiteId = Site.forwarder;

const SomeSite: SiteMetadata = Object.freeze({
  id: SomeSiteId,
  availableFields: [],
});

const SomeVendor = Bitwarden;
const SomeVendorId = SomeVendor.id;
const SomeExtension: ExtensionMetadata = deepFreeze({
  site: SomeSite,
  product: { vendor: SomeVendor, name: "Some Product" },
  host: { authorization: "bearer", selfHost: "maybe", baseUrl: "https://vault.bitwarden.com" },
  requestedFields: [],
});

const JustTrustUs: VendorMetadata = Object.freeze({
  id: "justrustus" as any,
  name: "JustTrust.Us",
});
const JustTrustUsExtension: ExtensionMetadata = deepFreeze({
  site: SomeSite,
  product: { vendor: JustTrustUs },
  host: { authorization: "bearer", selfHost: "maybe", baseUrl: "https://justrust.us" },
  requestedFields: [],
});

// In the following tests, not-null assertions (`!`) indicate that
// the returned object should never be null or undefined given
// the conditions defined within the test case
describe("RuntimeExtensionRegistry", () => {
  describe("registerSite", () => {
    it("registers an extension site", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, []);

      const result = registry.registerSite(SomeSite).site(SomeSiteId);

      expect(result).toEqual(SomeSite);
    });

    it("interns the site", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, []);

      const result = registry.registerSite(SomeSite).site(SomeSiteId);

      expect(result).not.toBe(SomeSite);
    });

    it("registers an extension site with fields", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);
      const site: SiteMetadata = {
        ...SomeSite,
        availableFields: [Field.baseUrl],
      };

      const result = registry.registerSite(site).site(SomeSiteId);

      expect(result).toEqual(site);
    });

    it("ignores unavailable sites", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      const ignored: SiteMetadata = {
        id: "an-unavailable-site" as any,
        availableFields: [],
      };

      const result = registry.registerSite(ignored).sites();

      expect(result).toEqual([]);
    });

    it("ignores duplicate registrations", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, []);
      const ignored: SiteMetadata = {
        ...SomeSite,
        availableFields: [Field.token],
      };

      const result = registry.registerSite(SomeSite).registerSite(ignored).site(SomeSiteId);

      expect(result).toEqual(SomeSite);
    });

    it("ignores unknown available fields", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);
      const ignored: SiteMetadata = {
        ...SomeSite,
        availableFields: [SomeSite.availableFields, "ignored" as any],
      };

      const { availableFields } = registry.registerSite(ignored).site(SomeSiteId)!;

      expect(availableFields).toEqual(SomeSite.availableFields);
    });

    it("freezes the site definition", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, []);
      const site = registry.registerSite(SomeSite).site(SomeSiteId)!;

      // reassigning `availableFields` throws b/c the object is frozen
      expect(() => (site.availableFields = [Field.domain])).toThrow();
    });
  });

  describe("site", () => {
    it("returns `undefined` for an unknown site", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);

      const result = registry.site(SomeSiteId);

      expect(result).toBeUndefined();
    });

    it("returns the same result when called repeatedly", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);
      registry.registerSite(SomeSite);

      const first = registry.site(SomeSiteId);
      const second = registry.site(SomeSiteId);

      expect(first).toBe(second);
    });
  });

  describe("sites", () => {
    it("lists registered sites", () => {
      const registry = new RuntimeExtensionRegistry([SomeSiteId, "bar"] as any[], DefaultFields);
      const barSite: SiteMetadata = {
        id: "bar" as any,
        availableFields: [],
      };

      const result = registry.registerSite(SomeSite).registerSite(barSite).sites();

      expect(result.some(({ site }) => site.id === SomeSiteId)).toBe(true);
      expect(result.some(({ site }) => site.id === barSite.id)).toBe(true);
    });

    it("includes permissions for a site", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);

      const result = registry
        .registerSite(SomeSite)
        .setPermission({ site: SomeSite.id }, Permission.allow)
        .sites();

      expect(result).toEqual([{ site: SomeSite, permission: Permission.allow }]);
    });

    it("ignores duplicate registrations", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);
      const ignored: SiteMetadata = {
        ...SomeSite,
        availableFields: [Field.token],
      };

      const result = registry.registerSite(SomeSite).registerSite(ignored).sites();

      expect(result).toEqual([{ site: SomeSite }]);
    });

    it("ignores permissions for other sites", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);

      const result = registry
        .registerSite(SomeSite)
        .setPermission({ site: SomeSite.id }, Permission.allow)
        .setPermission({ site: "bar" as any }, Permission.deny)
        .sites();

      expect(result).toEqual([{ site: SomeSite, permission: Permission.allow }]);
    });
  });

  describe("registerVendor", () => {
    it("registers a vendor", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      const result = registry.registerVendor(SomeVendor).vendors();

      expect(result).toEqual([{ vendor: SomeVendor }]);
    });

    it("freezes the vendor definition", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      // copy `SomeVendor` because it is already frozen
      const original: VendorMetadata = { ...SomeVendor };

      const [{ vendor }] = registry.registerVendor(original).vendors();

      // reassigning `name` throws b/c the object is frozen
      expect(() => (vendor.name = "Bytewarden")).toThrow();
    });
  });

  describe("vendor", () => {
    it("returns `undefined` for an unknown site", () => {
      const registry = new RuntimeExtensionRegistry([], []);

      const result = registry.vendor(SomeVendorId);

      expect(result).toBeUndefined();
    });

    it("returns the same result when called repeatedly", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);
      registry.registerVendor(SomeVendor);

      const first = registry.vendor(SomeVendorId);
      const second = registry.vendor(SomeVendorId);

      expect(first).toBe(second);
    });
  });

  describe("vendors", () => {
    it("lists registered vendors", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      registry.registerVendor(SomeVendor).registerVendor(JustTrustUs);

      const result = registry.vendors();

      expect(result.some(({ vendor }) => vendor.id === SomeVendorId)).toBe(true);
      expect(result.some(({ vendor }) => vendor.id === JustTrustUs.id)).toBe(true);
    });

    it("includes permissions for a vendor", () => {
      const registry = new RuntimeExtensionRegistry([], []);

      const result = registry
        .registerVendor(SomeVendor)
        .setPermission({ vendor: SomeVendorId }, Permission.allow)
        .vendors();

      expect(result).toEqual([{ vendor: SomeVendor, permission: Permission.allow }]);
    });

    it("ignores duplicate registrations", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      const vendor: VendorMetadata = SomeVendor;
      const ignored: VendorMetadata = {
        ...SomeVendor,
        name: "Duplicate",
      };

      const result = registry.registerVendor(vendor).registerVendor(ignored).vendors();

      expect(result).toEqual([{ vendor }]);
    });

    it("ignores permissions for other sites", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);
      registry.registerVendor(SomeVendor).setPermission({ vendor: SomeVendorId }, Permission.allow);

      const result = registry.setPermission({ vendor: JustTrustUs.id }, Permission.deny).vendors();

      expect(result).toEqual([{ vendor: SomeVendor, permission: Permission.allow }]);
    });
  });

  describe("setPermission", () => {
    it("sets the all permission", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      const target = { all: true } as const;

      const permission = registry.setPermission(target, Permission.allow).permission(target);

      expect(permission).toEqual(Permission.allow);
    });

    it("sets a vendor permission", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      const target = { vendor: SomeVendorId };

      const permission = registry.setPermission(target, Permission.allow).permission(target);

      expect(permission).toEqual(Permission.allow);
    });

    it("sets a site permission", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, []);
      const target = { site: SomeSiteId };

      const permission = registry.setPermission(target, Permission.allow).permission(target);

      expect(permission).toEqual(Permission.allow);
    });

    it("ignores a site permission unless it is in the allowed sites list", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      const target = { site: SomeSiteId };

      const permission = registry.setPermission(target, Permission.allow).permission(target);

      expect(permission).toBeUndefined();
    });

    it("throws when a permission is invalid", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, []);

      expect(() => registry.setPermission({ all: true }, "invalid" as any)).toThrow();
    });

    it("throws when the extension set is the wrong type", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      const target = { invalid: "invalid" } as any;

      expect(() => registry.setPermission(target, Permission.allow)).toThrow();
    });
  });

  describe("permission", () => {
    it("gets the default all permission", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      const target = { all: true } as const;

      const permission = registry.permission(target);

      expect(permission).toEqual(Permission.default);
    });

    it("gets an all permission", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      const target = { all: true } as const;
      registry.setPermission(target, Permission.none);

      const permission = registry.permission(target);

      expect(permission).toEqual(Permission.none);
    });

    it("gets a vendor permission", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      const target = { vendor: SomeVendorId };
      registry.setPermission(target, Permission.allow);

      const permission = registry.permission(target);

      expect(permission).toEqual(Permission.allow);
    });

    it("gets a site permission", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, []);
      const target = { site: SomeSiteId };
      registry.setPermission(target, Permission.allow);

      const permission = registry.permission(target);

      expect(permission).toEqual(Permission.allow);
    });

    it("gets a vendor permission", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      const target = { vendor: SomeVendorId };
      registry.setPermission(target, Permission.allow);

      const permission = registry.permission(target);

      expect(permission).toEqual(Permission.allow);
    });

    it("returns undefined when the extension set is the wrong type", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      const target = { invalid: "invalid" } as any;

      const permission = registry.permission(target);

      expect(permission).toBeUndefined();
    });
  });

  describe("permissions", () => {
    it("returns a default all permission by default", () => {
      const registry = new RuntimeExtensionRegistry([], []);

      const permission = registry.permissions();

      expect(permission).toEqual([{ set: { all: true }, permission: Permission.default }]);
    });

    it("returns the all permission", () => {
      const registry = new RuntimeExtensionRegistry([], []);
      registry.setPermission({ all: true }, Permission.none);

      const permission = registry.permissions();

      expect(permission).toEqual([{ set: { all: true }, permission: Permission.none }]);
    });

    it("includes site permissions", () => {
      const registry = new RuntimeExtensionRegistry([SomeSiteId, "bar"] as any[], DefaultFields);
      registry.registerSite(SomeSite).setPermission({ site: SomeSiteId }, Permission.allow);
      registry
        .registerSite({
          id: "bar" as any,
          availableFields: [],
        })
        .setPermission({ site: "bar" as any }, Permission.deny);

      const result = registry.permissions();

      expect(
        result.some((p: any) => p.set.site === SomeSiteId && p.permission === Permission.allow),
      ).toBe(true);
      expect(
        result.some((p: any) => p.set.site === "bar" && p.permission === Permission.deny),
      ).toBe(true);
    });

    it("includes vendor permissions", () => {
      const registry = new RuntimeExtensionRegistry([], DefaultFields);
      registry.registerVendor(SomeVendor).setPermission({ vendor: SomeVendorId }, Permission.allow);
      registry
        .registerVendor(JustTrustUs)
        .setPermission({ vendor: JustTrustUs.id }, Permission.deny);

      const result = registry.permissions();

      expect(
        result.some((p: any) => p.set.vendor === SomeVendorId && p.permission === Permission.allow),
      ).toBe(true);
      expect(
        result.some(
          (p: any) => p.set.vendor === JustTrustUs.id && p.permission === Permission.deny,
        ),
      ).toBe(true);
    });
  });

  describe("registerExtension", () => {
    it("registers an extension", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, []);
      registry.registerSite(SomeSite).registerVendor(SomeVendor);

      const result = registry.registerExtension(SomeExtension).extension(SomeSiteId, SomeVendorId);

      expect(result).toEqual(SomeExtension);
    });

    it("ignores extensions with nonregistered sites", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, []);
      registry.registerVendor(SomeVendor);

      // precondition: the site is not registered
      expect(registry.site(SomeSiteId)).toBeUndefined();

      const result = registry.registerExtension(SomeExtension).extension(SomeSiteId, SomeVendorId);

      expect(result).toBeUndefined();
    });

    it("ignores extensions with nonregistered vendors", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, []);
      registry.registerSite(SomeSite);

      // precondition: the vendor is not registered
      expect(registry.vendor(SomeVendorId)).toBeUndefined();

      const result = registry.registerExtension(SomeExtension).extension(SomeSiteId, SomeVendorId);

      expect(result).toBeUndefined();
    });

    it("ignores repeated extensions with nonregistered vendors", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, []);
      registry.registerSite(SomeSite).registerVendor(SomeVendor).registerExtension(SomeExtension);

      // precondition: the vendor is already registered
      expect(registry.extension(SomeSiteId, SomeVendorId)).toBeDefined();

      const result = registry
        .registerExtension({
          ...SomeExtension,
          requestedFields: [Field.domain],
        })
        .extension(SomeSiteId, SomeVendorId);

      expect(result).toEqual(SomeExtension);
    });

    it("interns site metadata", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, []);
      registry.registerSite(SomeSite).registerVendor(SomeVendor);

      const internedSite = registry.site(SomeSiteId);
      const result = registry.registerExtension(SomeExtension).extension(SomeSiteId, SomeVendorId)!;

      expect(result.site).toBe(internedSite);
    });

    it("interns vendor metadata", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, []);
      registry.registerSite(SomeSite).registerVendor(SomeVendor);

      const internedVendor = registry.vendor(SomeVendorId);
      const result = registry.registerExtension(SomeExtension).extension(SomeSiteId, SomeVendorId)!;

      expect(result.product.vendor).toBe(internedVendor);
    });

    it("freezes the extension metadata", () => {
      const registry = new RuntimeExtensionRegistry(DefaultSites, []);
      registry.registerSite(SomeSite).registerVendor(SomeVendor).registerExtension(SomeExtension);
      const extension = registry.extension(SomeSiteId, SomeVendorId)!;

      // field assignments & mutation functions throw b/c the object is frozen
      expect(() => ((extension.site as any) = SomeSite)).toThrow();
      expect(() => ((extension.product.vendor as any) = SomeVendor)).toThrow();
      expect(() => ((extension.product.name as any) = "SomeVendor")).toThrow();
      expect(() => ((extension.host as any) = {})).toThrow();
      expect(() => ((extension.host.selfHost as any) = {})).toThrow();
      expect(() => ((extension.host as any).authorization = "basic")).toThrow();
      expect(() => ((extension.host as any).baseUrl = "https://www.example.com")).toThrow();
      expect(() => ((extension.requestedFields as any) = [Field.baseUrl])).toThrow();
      expect(() => (extension.requestedFields as any).push(Field.baseUrl)).toThrow();
    });
  });

  describe("extension", () => {
    describe("extension", () => {
      it("returns `undefined` for an unknown extension", () => {
        const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);

        const result = registry.extension(SomeSiteId, SomeVendorId);

        expect(result).toBeUndefined();
      });

      it("interns the extension", () => {
        const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);
        registry.registerSite(SomeSite).registerVendor(SomeVendor).registerExtension(SomeExtension);

        const first = registry.extension(SomeSiteId, SomeVendorId);
        const second = registry.extension(SomeSiteId, SomeVendorId);

        expect(first).toBe(second);
      });
    });

    describe("extensions", () => {
      it("lists registered extensions", () => {
        const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);
        registry.registerSite(SomeSite);
        registry.registerVendor(SomeVendor).registerExtension(SomeExtension);
        registry.registerVendor(JustTrustUs).registerExtension(JustTrustUsExtension);

        const result = registry.extensions();

        expect(
          result.some(
            ({ extension }) =>
              extension.site.id === SomeSiteId && extension.product.vendor.id === SomeVendorId,
          ),
        ).toBe(true);
        expect(
          result.some(
            ({ extension }) =>
              extension.site.id === SomeSiteId && extension.product.vendor.id === JustTrustUs.id,
          ),
        ).toBe(true);
      });

      it("includes permissions for extensions", () => {
        const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);
        registry
          .registerSite(SomeSite)
          .registerVendor(SomeVendor)
          .registerExtension(SomeExtension)
          .setPermission({ vendor: SomeVendorId }, Permission.allow);

        const result = registry.extensions();

        expect(
          result.some(
            ({ extension, permissions }) =>
              extension.site.id === SomeSiteId &&
              extension.product.vendor.id === SomeVendorId &&
              permissions.includes(Permission.allow),
          ),
        ).toBe(true);
      });
    });

    describe("build", () => {
      it("builds an empty extension site when no extensions are registered", () => {
        const registry = new RuntimeExtensionRegistry(DefaultSites, []);
        registry.registerSite(SomeSite).registerVendor(SomeVendor);

        const result = registry.build(SomeSiteId)!;

        expect(result.extensions.size).toBe(0);
      });

      it("builds an extension site with all registered extensions", () => {
        const registry = new RuntimeExtensionRegistry(DefaultSites, []);
        registry.registerSite(SomeSite).registerVendor(SomeVendor).registerExtension(SomeExtension);
        const expected = registry.extension(SomeSiteId, SomeVendorId);

        const result = registry.build(SomeSiteId)!;

        expect(result).toBeInstanceOf(ExtensionSite);
        expect(result.extensions.get(SomeVendorId)).toBe(expected);
      });

      it("returns `undefined` for an unknown site", () => {
        const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);

        const result = registry.build(SomeSiteId);

        expect(result).toBeUndefined();
      });

      describe("when the all permission is `default`", () => {
        const allPermission = Permission.default;

        it("builds an extension site with all registered extensions", () => {
          const registry = new RuntimeExtensionRegistry(DefaultSites, []);
          registry
            .registerSite(SomeSite)
            .registerVendor(SomeVendor)
            .registerExtension(SomeExtension)
            .setPermission({ all: true }, Permission.default);
          const expected = registry.extension(SomeSiteId, SomeVendorId);

          const result = registry.build(SomeSiteId)!;

          expect(result.extensions.get(SomeVendorId)).toBe(expected);
        });

        it.each([[Permission.default], [Permission.allow]])(
          "includes sites with `%p` permission",
          (permission) => {
            const registry = new RuntimeExtensionRegistry(DefaultSites, []);
            registry
              .registerSite(SomeSite)
              .registerVendor(SomeVendor)
              .registerExtension(SomeExtension);
            registry.setPermission({ all: true }, allPermission);
            registry.setPermission({ site: SomeSiteId }, permission);

            const result = registry.build(SomeSiteId)!;

            expect(result.extensions.get(SomeVendorId)).toEqual(SomeExtension);
          },
        );

        it.each([[Permission.none], [Permission.deny]])(
          "ignores sites with `%p` permission",
          (permission) => {
            const registry = new RuntimeExtensionRegistry(DefaultSites, []);
            registry
              .registerSite(SomeSite)
              .registerVendor(SomeVendor)
              .registerExtension(SomeExtension);
            registry.setPermission({ all: true }, allPermission);
            registry.setPermission({ site: SomeSiteId }, permission);

            const result = registry.build(SomeSiteId)!;

            expect(result.extensions.size).toBe(0);
          },
        );

        it.each([[Permission.default], [Permission.allow]])(
          "includes vendors with `%p` permission",
          (permission) => {
            const registry = new RuntimeExtensionRegistry(DefaultSites, []);
            registry
              .registerSite(SomeSite)
              .registerVendor(SomeVendor)
              .registerExtension(SomeExtension);
            registry.setPermission({ all: true }, allPermission);
            registry.setPermission({ vendor: SomeVendorId }, permission);

            const result = registry.build(SomeSiteId)!;

            expect(result.extensions.get(SomeVendorId)).toEqual(SomeExtension);
          },
        );

        it.each([[Permission.none], [Permission.deny]])(
          "ignores vendors with `%p` permission",
          (permission) => {
            const registry = new RuntimeExtensionRegistry(DefaultSites, []);
            registry
              .registerSite(SomeSite)
              .registerVendor(SomeVendor)
              .registerExtension(SomeExtension);
            registry.setPermission({ all: true }, allPermission);
            registry.setPermission({ vendor: SomeVendorId }, permission);

            const result = registry.build(SomeSiteId)!;

            expect(result.extensions.size).toBe(0);
          },
        );
      });

      describe("when the all permission is `none`", () => {
        const allPermission = Permission.none;

        it("builds an empty extension site", () => {
          const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);
          registry
            .registerSite(SomeSite)
            .registerVendor(SomeVendor)
            .registerExtension(SomeExtension)
            .setPermission({ all: true }, Permission.none);

          const result = registry.build(SomeSiteId)!;

          expect(result).toBeInstanceOf(ExtensionSite);
          expect(result.extensions.size).toBe(0);
        });

        it.each([[Permission.allow]])("includes sites with `%p` permission", (permission) => {
          const registry = new RuntimeExtensionRegistry(DefaultSites, []);
          registry
            .registerSite(SomeSite)
            .registerVendor(SomeVendor)
            .registerExtension(SomeExtension);
          registry.setPermission({ all: true }, allPermission);
          registry.setPermission({ site: SomeSiteId }, permission);

          const result = registry.build(SomeSiteId)!;

          expect(result.extensions.get(SomeVendorId)).toEqual(SomeExtension);
        });

        it.each([[Permission.default], [Permission.none], [Permission.deny]])(
          "ignores sites with `%p` permission",
          (permission) => {
            const registry = new RuntimeExtensionRegistry(DefaultSites, []);
            registry
              .registerSite(SomeSite)
              .registerVendor(SomeVendor)
              .registerExtension(SomeExtension);
            registry.setPermission({ all: true }, allPermission);
            registry.setPermission({ site: SomeSiteId }, permission);

            const result = registry.build(SomeSiteId)!;

            expect(result.extensions.size).toBe(0);
          },
        );

        it.each([[Permission.allow]])("includes vendors with `%p` permission", (permission) => {
          const registry = new RuntimeExtensionRegistry(DefaultSites, []);
          registry
            .registerSite(SomeSite)
            .registerVendor(SomeVendor)
            .registerExtension(SomeExtension);
          registry.setPermission({ all: true }, allPermission);
          registry.setPermission({ vendor: SomeVendorId }, permission);

          const result = registry.build(SomeSiteId)!;

          expect(result.extensions.get(SomeVendorId)).toEqual(SomeExtension);
        });

        it.each([[Permission.default], [Permission.none], [Permission.deny]])(
          "ignores vendors with `%p` permission",
          (permission) => {
            const registry = new RuntimeExtensionRegistry(DefaultSites, []);
            registry
              .registerSite(SomeSite)
              .registerVendor(SomeVendor)
              .registerExtension(SomeExtension);
            registry.setPermission({ all: true }, allPermission);
            registry.setPermission({ vendor: SomeVendorId }, permission);

            const result = registry.build(SomeSiteId)!;

            expect(result.extensions.size).toBe(0);
          },
        );
      });

      describe("when the all permission is `allow`", () => {
        const allPermission = Permission.allow;

        it("builds an extension site with all registered extensions", () => {
          const registry = new RuntimeExtensionRegistry(DefaultSites, []);
          registry
            .registerSite(SomeSite)
            .registerVendor(SomeVendor)
            .registerExtension(SomeExtension)
            .setPermission({ all: true }, Permission.default);
          const expected = registry.extension(SomeSiteId, SomeVendorId);

          const result = registry.build(SomeSiteId)!;

          expect(result).toBeInstanceOf(ExtensionSite);
          expect(result.extensions.get(SomeVendorId)).toBe(expected);
        });

        it.each([[Permission.default], [Permission.none], [Permission.allow]])(
          "includes sites with `%p` permission",
          (permission) => {
            const registry = new RuntimeExtensionRegistry(DefaultSites, []);
            registry
              .registerSite(SomeSite)
              .registerVendor(SomeVendor)
              .registerExtension(SomeExtension);
            registry.setPermission({ all: true }, allPermission);
            registry.setPermission({ site: SomeSiteId }, permission);

            const result = registry.build(SomeSiteId)!;

            expect(result.extensions.get(SomeVendorId)).toEqual(SomeExtension);
          },
        );

        it.each([[Permission.deny]])("ignores sites with `%p` permission", (permission) => {
          const registry = new RuntimeExtensionRegistry(DefaultSites, []);
          registry
            .registerSite(SomeSite)
            .registerVendor(SomeVendor)
            .registerExtension(SomeExtension);
          registry.setPermission({ all: true }, allPermission);
          registry.setPermission({ site: SomeSiteId }, permission);

          const result = registry.build(SomeSiteId)!;

          expect(result.extensions.size).toBe(0);
        });

        it.each([[Permission.default], [Permission.none], [Permission.allow]])(
          "includes vendors with `%p` permission",
          (permission) => {
            const registry = new RuntimeExtensionRegistry(DefaultSites, []);
            registry
              .registerSite(SomeSite)
              .registerVendor(SomeVendor)
              .registerExtension(SomeExtension);
            registry.setPermission({ all: true }, allPermission);
            registry.setPermission({ vendor: SomeVendorId }, permission);

            const result = registry.build(SomeSiteId)!;

            expect(result.extensions.get(SomeVendorId)).toEqual(SomeExtension);
          },
        );

        it.each([[Permission.deny]])("ignores vendors with `%p` permission", (permission) => {
          const registry = new RuntimeExtensionRegistry(DefaultSites, []);
          registry
            .registerSite(SomeSite)
            .registerVendor(SomeVendor)
            .registerExtension(SomeExtension);
          registry.setPermission({ all: true }, allPermission);
          registry.setPermission({ vendor: SomeVendorId }, permission);

          const result = registry.build(SomeSiteId)!;

          expect(result.extensions.size).toBe(0);
        });
      });

      describe("when the all permission is `deny`", () => {
        const allPermission = Permission.deny;

        it("builds an empty extension site", () => {
          const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);
          registry
            .registerSite(SomeSite)
            .registerVendor(SomeVendor)
            .registerExtension(SomeExtension)
            .setPermission({ all: true }, Permission.deny);

          const result = registry.build(SomeSiteId)!;

          expect(result).toBeInstanceOf(ExtensionSite);
          expect(result.extensions.size).toBe(0);
        });

        it.each([[Permission.default], [Permission.none], [Permission.allow], [Permission.deny]])(
          "ignores sites with `%p` permission",
          (permission) => {
            const registry = new RuntimeExtensionRegistry(DefaultSites, []);
            registry
              .registerSite(SomeSite)
              .registerVendor(SomeVendor)
              .registerExtension(SomeExtension);
            registry.setPermission({ all: true }, allPermission);
            registry.setPermission({ site: SomeSiteId }, permission);

            const result = registry.build(SomeSiteId)!;

            expect(result.extensions.size).toBe(0);
          },
        );

        it.each([[Permission.default], [Permission.none], [Permission.allow], [Permission.deny]])(
          "ignores vendors with `%p` permission",
          (permission) => {
            const registry = new RuntimeExtensionRegistry(DefaultSites, []);
            registry
              .registerSite(SomeSite)
              .registerVendor(SomeVendor)
              .registerExtension(SomeExtension);
            registry.setPermission({ all: true }, allPermission);
            registry.setPermission({ vendor: SomeVendorId }, permission);

            const result = registry.build(SomeSiteId)!;

            expect(result.extensions.size).toBe(0);
          },
        );
      });
    });
  });
});
