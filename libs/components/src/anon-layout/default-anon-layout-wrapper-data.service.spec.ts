import { ANON_LAYOUT_DEFAULTS } from "./anon-layout-defaults";
import { AnonLayoutWrapperData } from "./anon-layout-wrapper.component";
import { DefaultAnonLayoutWrapperDataService } from "./default-anon-layout-wrapper-data.service";

describe("DefaultAnonLayoutWrapperDataService", () => {
  let service: DefaultAnonLayoutWrapperDataService;
  let emissions: Partial<AnonLayoutWrapperData>[];

  beforeEach(() => {
    service = new DefaultAnonLayoutWrapperDataService();
    emissions = [];
    service.anonLayoutWrapperData$().subscribe((data) => emissions.push(data));
  });

  describe("setAnonLayoutWrapperData", () => {
    it("emits the data to subscribers of anonLayoutWrapperData$", () => {
      const data: Partial<AnonLayoutWrapperData> = { pageTitle: "Welcome" };

      service.setAnonLayoutWrapperData(data);

      expect(emissions).toEqual([data]);
    });

    it("emits sequentially for multiple calls", () => {
      service.setAnonLayoutWrapperData({ pageTitle: "First" });
      service.setAnonLayoutWrapperData({ pageTitle: "Second" });

      expect(emissions).toEqual([{ pageTitle: "First" }, { pageTitle: "Second" }]);
    });
  });

  describe("anonLayoutWrapperData$", () => {
    it("uses a non-replaying Subject (late subscribers don't see past emissions)", () => {
      service.setAnonLayoutWrapperData({ pageTitle: "Before subscribe" });

      const lateEmissions: Partial<AnonLayoutWrapperData>[] = [];
      service.anonLayoutWrapperData$().subscribe((data) => lateEmissions.push(data));

      expect(lateEmissions).toEqual([]);
    });
  });

  describe("cacheRouteData", () => {
    it("does not emit through anonLayoutWrapperData$", () => {
      service.cacheRouteData({ pageTitle: "Cached" });

      expect(emissions).toEqual([]);
    });

    it("overwrites prior cached data on subsequent calls", () => {
      service.cacheRouteData({ pageTitle: "First" });
      service.cacheRouteData({ pageSubtitle: "Second" });
      service.resetToCachedRouteData();

      // Second cache's value wins.
      expect(emissions[0].pageSubtitle).toBe("Second");
      // First cache's value is gone (cache is replaced, not merged); falls back to default.
      expect(emissions[0].pageTitle).toBe(ANON_LAYOUT_DEFAULTS.pageTitle);
    });
  });

  describe("resetToCachedRouteData", () => {
    it("emits ANON_LAYOUT_DEFAULTS when no cache has been set", () => {
      service.resetToCachedRouteData();

      expect(emissions[0]).toEqual(ANON_LAYOUT_DEFAULTS);
    });

    it("spreads cached values over ANON_LAYOUT_DEFAULTS", () => {
      service.cacheRouteData({ pageTitle: "Cached title", hidePageIcon: true });
      service.resetToCachedRouteData();

      expect(emissions[0]).toEqual({
        ...ANON_LAYOUT_DEFAULTS,
        pageTitle: "Cached title",
        hidePageIcon: true,
      });
    });

    it("cached values win over default values where keys overlap", () => {
      // ANON_LAYOUT_DEFAULTS.hidePageIcon is false; cache it as true.
      service.cacheRouteData({ hidePageIcon: true });
      service.resetToCachedRouteData();

      expect(emissions[0].hidePageIcon).toBe(true);
    });

    it("emits default values for keys the cache doesn't declare", () => {
      service.cacheRouteData({ pageTitle: "Only title" });
      service.resetToCachedRouteData();

      // pageIcon wasn't cached, so it should fall back to the default (null).
      expect(emissions[0].pageIcon).toBe(ANON_LAYOUT_DEFAULTS.pageIcon);
      expect(emissions[0].hidePageIcon).toBe(ANON_LAYOUT_DEFAULTS.hidePageIcon);
      expect(emissions[0].contentVerticalPadding).toBe(ANON_LAYOUT_DEFAULTS.contentVerticalPadding);
    });

    it("emits a complete payload containing every ANON_LAYOUT_DEFAULTS key", () => {
      service.cacheRouteData({ pageTitle: "Some title" });
      service.resetToCachedRouteData();

      // Every key in ANON_LAYOUT_DEFAULTS should appear in the emission.
      for (const key of Object.keys(ANON_LAYOUT_DEFAULTS) as (keyof AnonLayoutWrapperData)[]) {
        expect(emissions[0]).toHaveProperty(key);
      }
    });
  });
});
