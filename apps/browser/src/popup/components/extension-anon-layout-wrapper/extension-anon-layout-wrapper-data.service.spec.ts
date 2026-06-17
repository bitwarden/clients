import { ANON_LAYOUT_DEFAULTS, AnonLayoutWrapperData } from "@bitwarden/components";

import { EXTENSION_ANON_LAYOUT_DEFAULTS } from "./extension-anon-layout-defaults";
import { ExtensionAnonLayoutWrapperDataService } from "./extension-anon-layout-wrapper-data.service";
import { ExtensionAnonLayoutWrapperData } from "./extension-anon-layout-wrapper.component";

describe("ExtensionAnonLayoutWrapperDataService", () => {
  let service: ExtensionAnonLayoutWrapperDataService;
  let emissions: Partial<ExtensionAnonLayoutWrapperData>[];

  beforeEach(() => {
    service = new ExtensionAnonLayoutWrapperDataService();
    emissions = [];
    service.anonLayoutWrapperData$().subscribe((data) => emissions.push(data));
  });

  // Behaviors inherited from DefaultAnonLayoutWrapperDataService (basic emission, caching
  // silently, cache replacement) are covered by the parent's spec. These tests focus on
  // the extension-specific overrides: support for extension-only fields in the emission
  // stream, and the dual-spread reset behavior.

  describe("setAnonLayoutWrapperData", () => {
    it("emits extension-only fields to subscribers", () => {
      const data: Partial<ExtensionAnonLayoutWrapperData> = {
        showLogo: true,
        showBackButton: true,
      };

      service.setAnonLayoutWrapperData(data);

      expect(emissions).toEqual([data]);
    });
  });

  describe("resetToCachedRouteData", () => {
    it("emits both ANON_LAYOUT_DEFAULTS and EXTENSION_ANON_LAYOUT_DEFAULTS when no cache has been set", () => {
      service.resetToCachedRouteData();

      expect(emissions[0]).toEqual({
        ...ANON_LAYOUT_DEFAULTS,
        ...EXTENSION_ANON_LAYOUT_DEFAULTS,
      });
    });

    it("spreads cached values over both default consts", () => {
      // cacheRouteData is inherited with a `Partial<AnonLayoutWrapperData>` signature, so
      // extension-only fields trigger an excess-property check on object literals. Typing
      // the variable as the extension partial sidesteps the check while still satisfying
      // the parameter via structural assignability.
      const cacheData: Partial<ExtensionAnonLayoutWrapperData> = {
        pageTitle: "Cached title",
        showLogo: false,
      };
      service.cacheRouteData(cacheData);
      service.resetToCachedRouteData();

      expect(emissions[0]).toEqual({
        ...ANON_LAYOUT_DEFAULTS,
        ...EXTENSION_ANON_LAYOUT_DEFAULTS,
        pageTitle: "Cached title",
        showLogo: false,
      });
    });

    it("cached values win over extension-only default values where keys overlap", () => {
      // EXTENSION_ANON_LAYOUT_DEFAULTS.showLogo is true; cache it as false.
      const cacheData: Partial<ExtensionAnonLayoutWrapperData> = { showLogo: false };
      service.cacheRouteData(cacheData);
      service.resetToCachedRouteData();

      expect(emissions[0].showLogo).toBe(false);
    });

    it("emits extension-only default values for keys the cache doesn't declare", () => {
      service.cacheRouteData({ pageTitle: "Only title" });
      service.resetToCachedRouteData();

      // Extension-only fields fall back to EXTENSION_ANON_LAYOUT_DEFAULTS.
      expect(emissions[0].showAcctSwitcher).toBe(EXTENSION_ANON_LAYOUT_DEFAULTS.showAcctSwitcher);
      expect(emissions[0].showBackButton).toBe(EXTENSION_ANON_LAYOUT_DEFAULTS.showBackButton);
      expect(emissions[0].showLogo).toBe(EXTENSION_ANON_LAYOUT_DEFAULTS.showLogo);
      expect(emissions[0].hideFooter).toBe(EXTENSION_ANON_LAYOUT_DEFAULTS.hideFooter);
    });

    it("emits a complete payload containing every key from both default consts", () => {
      service.cacheRouteData({ pageTitle: "Some title" });
      service.resetToCachedRouteData();

      for (const key of Object.keys(ANON_LAYOUT_DEFAULTS) as (keyof AnonLayoutWrapperData)[]) {
        expect(emissions[0]).toHaveProperty(key);
      }
      for (const key of Object.keys(
        EXTENSION_ANON_LAYOUT_DEFAULTS,
      ) as (keyof ExtensionAnonLayoutWrapperData)[]) {
        expect(emissions[0]).toHaveProperty(key);
      }
    });
  });
});
