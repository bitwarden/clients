import { Location } from "@angular/common";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { PopupRouterCacheService } from "../../../platform/popup/view-cache/popup-router-cache.service";
import { RouteHistoryCacheState } from "../../../platform/services/popup-view-cache-background.service";

import {
  ROUTES_AFTER_EDIT_DELETION,
  VaultPopupAfterDeletionNavigationService,
} from "./vault-popup-after-deletion-navigation.service";
import { VaultPopupScrollPositionService } from "./vault-popup-scroll-position.service";

describe("VaultPopupAfterDeletionNavigationService", () => {
  let service: VaultPopupAfterDeletionNavigationService;

  let router: MockProxy<Router>;
  let location: MockProxy<Location>;
  let popupRouterCacheService: MockProxy<PopupRouterCacheService>;
  let scrollPositionService: MockProxy<VaultPopupScrollPositionService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;

  beforeEach(() => {
    router = mock<Router>();
    location = mock<Location>();
    popupRouterCacheService = mock<PopupRouterCacheService>();
    scrollPositionService = mock<VaultPopupScrollPositionService>();
    platformUtilsService = mock<PlatformUtilsService>();

    router.navigate.mockResolvedValue(true);
    platformUtilsService.isFirefox.mockReturnValue(false);

    TestBed.configureTestingModule({
      providers: [
        VaultPopupAfterDeletionNavigationService,
        { provide: Router, useValue: router },
        { provide: Location, useValue: location },
        { provide: PopupRouterCacheService, useValue: popupRouterCacheService },
        { provide: VaultPopupScrollPositionService, useValue: scrollPositionService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
      ],
    });

    service = TestBed.inject(VaultPopupAfterDeletionNavigationService);
  });

  describe("navigateAfterDeletion", () => {
    describe("scroll position reset", () => {
      it("stops the scroll position service on non-Firefox browsers", async () => {
        platformUtilsService.isFirefox.mockReturnValue(false);

        await service.navigateAfterDeletion();

        expect(scrollPositionService.stop).toHaveBeenCalledWith(true);
      });

      it("does not stop the scroll position service on Firefox", async () => {
        platformUtilsService.isFirefox.mockReturnValue(true);

        await service.navigateAfterDeletion();

        expect(scrollPositionService.stop).not.toHaveBeenCalled();
      });
    });

    describe("default route (tabsVault)", () => {
      it("navigates to the vault tab by default", async () => {
        await service.navigateAfterDeletion();

        expect(router.navigate).toHaveBeenCalledWith(["/tabs/vault"]);
      });

      it("navigates to the vault tab when explicitly provided", async () => {
        await service.navigateAfterDeletion(ROUTES_AFTER_EDIT_DELETION.tabsVault);

        expect(router.navigate).toHaveBeenCalledWith(["/tabs/vault"]);
      });

      it("does not check popup history", async () => {
        await service.navigateAfterDeletion(ROUTES_AFTER_EDIT_DELETION.tabsVault);

        expect(popupRouterCacheService.history$).not.toHaveBeenCalled();
      });
    });

    describe("non-default route", () => {
      const historyWithArchive: RouteHistoryCacheState[] = [
        { url: "/tabs/vault" } as RouteHistoryCacheState,
        { url: "/archive" } as RouteHistoryCacheState,
        { url: "/view-cipher" } as RouteHistoryCacheState,
        { url: "/edit-cipher" } as RouteHistoryCacheState,
      ];

      it("walks back through history when the route is found", async () => {
        popupRouterCacheService.history$.mockReturnValue(of(historyWithArchive));

        await service.navigateAfterDeletion(ROUTES_AFTER_EDIT_DELETION.archive);

        // archive is at index 1, current is index 3 (length - 1), so stepsBack = 1 - 3 = -2
        expect(location.historyGo).toHaveBeenCalledWith(-2);
        expect(router.navigate).not.toHaveBeenCalled();
      });

      it("falls back to router.navigate when the route is not in history", async () => {
        const historyWithoutArchive: RouteHistoryCacheState[] = [
          { url: "/tabs/vault" } as RouteHistoryCacheState,
          { url: "/view-cipher" } as RouteHistoryCacheState,
          { url: "/edit-cipher" } as RouteHistoryCacheState,
        ];
        popupRouterCacheService.history$.mockReturnValue(of(historyWithoutArchive));

        await service.navigateAfterDeletion(ROUTES_AFTER_EDIT_DELETION.archive);

        expect(location.historyGo).not.toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(["/archive"]);
      });
    });
  });
});
