import { TestBed } from "@angular/core/testing";
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  convertToParamMap,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";

import { vaultFilterLegacyRedirectGuard } from "./vault-filter-legacy-redirect.guard";

describe("vaultFilterLegacyRedirectGuard", () => {
  let router: MockProxy<Router>;
  let activatedRoute: MockProxy<ActivatedRoute>;
  let configService: MockProxy<ConfigService>;

  const state = mock<RouterStateSnapshot>();
  const mockUrlTree = mock<UrlTree>();

  function makeRoute(queryParams: Record<string, string>): ActivatedRouteSnapshot {
    return mock<ActivatedRouteSnapshot>({ queryParamMap: convertToParamMap(queryParams) });
  }

  function runGuard(route: ActivatedRouteSnapshot) {
    return TestBed.runInInjectionContext(() => vaultFilterLegacyRedirectGuard(route, state));
  }

  beforeEach(() => {
    router = mock<Router>();
    activatedRoute = mock<ActivatedRoute>();
    configService = mock<ConfigService>();

    router.createUrlTree.mockReturnValue(mockUrlTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRoute },
        { provide: ConfigService, useValue: configService },
      ],
    });
  });

  describe("when VFO1Foundation is disabled", () => {
    beforeEach(() => {
      configService.getFeatureFlag.mockResolvedValue(false);
    });

    it("returns true without redirecting", async () => {
      const result = await runGuard(makeRoute({ type: "login" }));

      expect(result).toBe(true);
      expect(router.createUrlTree).not.toHaveBeenCalled();
    });

    it("verifies the guard checked the correct feature flag", async () => {
      await runGuard(makeRoute({ type: "login" }));

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.VFO1Foundation);
    });
  });

  describe("when VFO1Foundation is enabled", () => {
    beforeEach(() => {
      configService.getFeatureFlag.mockResolvedValue(true);
    });

    describe("with no legacy params", () => {
      it("returns true when no query params are present", async () => {
        expect(await runGuard(makeRoute({}))).toBe(true);
        expect(router.createUrlTree).not.toHaveBeenCalled();
      });

      it("returns true when only new-style vault.* params are present", async () => {
        // New-style params don't match any legacy key, so no redirect is needed.
        expect(await runGuard(makeRoute({ "vault.type": "1" }))).toBe(true);
        expect(router.createUrlTree).not.toHaveBeenCalled();
      });
    });

    describe("returns the URL tree from router.createUrlTree on redirect", () => {
      it("returns the url tree when a redirect is triggered", async () => {
        expect(await runGuard(makeRoute({ type: "login" }))).toBe(mockUrlTree);
      });
    });

    describe("type mapping", () => {
      const TYPE_CASES: [string, CipherType][] = [
        ["login", CipherType.Login],
        ["card", CipherType.Card],
        ["identity", CipherType.Identity],
        ["note", CipherType.SecureNote],
        ["sshKey", CipherType.SshKey],
        ["driversLicense", CipherType.DriversLicense],
        ["bankAccount", CipherType.BankAccount],
        ["passport", CipherType.Passport],
      ];

      TYPE_CASES.forEach(([legacyType, cipherType]) => {
        it(`maps ?type=${legacyType} → ?vault.type=${cipherType}`, async () => {
          await runGuard(makeRoute({ type: legacyType }));

          expect(router.createUrlTree).toHaveBeenCalledWith([], {
            relativeTo: activatedRoute,
            queryParams: expect.objectContaining({ "vault.type": String(cipherType) }),
            queryParamsHandling: "merge",
          });
        });
      });

      it("maps ?type=favorites → ?vault.favorites=true", async () => {
        await runGuard(makeRoute({ type: "favorites" }));

        expect(router.createUrlTree).toHaveBeenCalledWith([], {
          relativeTo: activatedRoute,
          queryParams: expect.objectContaining({ "vault.favorites": "true" }),
          queryParamsHandling: "merge",
        });
      });

      it("does not add vault.type or vault.favorites for unknown types like ?type=trash", async () => {
        await runGuard(makeRoute({ type: "trash" }));

        const { queryParams } = router.createUrlTree.mock.calls[0][1];
        expect(queryParams["vault.type"]).toBeUndefined();
        expect(queryParams["vault.favorites"]).toBeUndefined();
      });
    });

    describe("folder mapping", () => {
      it("maps ?folderId → ?vault.folder", async () => {
        await runGuard(makeRoute({ folderId: "folder-abc" }));

        expect(router.createUrlTree).toHaveBeenCalledWith([], {
          relativeTo: activatedRoute,
          queryParams: expect.objectContaining({ "vault.folder": "folder-abc" }),
          queryParamsHandling: "merge",
        });
      });
    });

    describe("shared folder mapping", () => {
      it("maps ?sharedFolderId → ?vault.sharedFolder", async () => {
        await runGuard(makeRoute({ sharedFolderId: "col-123" }));

        expect(router.createUrlTree).toHaveBeenCalledWith([], {
          relativeTo: activatedRoute,
          queryParams: expect.objectContaining({ "vault.sharedFolder": "col-123" }),
          queryParamsHandling: "merge",
        });
      });

      it("maps ?collectionId → ?vault.sharedFolder", async () => {
        await runGuard(makeRoute({ collectionId: "col-456" }));

        expect(router.createUrlTree).toHaveBeenCalledWith([], {
          relativeTo: activatedRoute,
          queryParams: expect.objectContaining({ "vault.sharedFolder": "col-456" }),
          queryParamsHandling: "merge",
        });
      });

      it("prefers ?sharedFolderId over ?collectionId when both are present", async () => {
        await runGuard(makeRoute({ sharedFolderId: "primary", collectionId: "fallback" }));

        expect(router.createUrlTree).toHaveBeenCalledWith([], {
          relativeTo: activatedRoute,
          queryParams: expect.objectContaining({ "vault.sharedFolder": "primary" }),
          queryParamsHandling: "merge",
        });
      });
    });

    describe("vault (organization) mapping", () => {
      it("maps ?organizationId → ?vault.vault", async () => {
        await runGuard(makeRoute({ organizationId: "org-abc" }));

        expect(router.createUrlTree).toHaveBeenCalledWith([], {
          relativeTo: activatedRoute,
          queryParams: expect.objectContaining({ "vault.vault": "org-abc" }),
          queryParamsHandling: "merge",
        });
      });

      it("maps ?vaultId → ?vault.vault", async () => {
        await runGuard(makeRoute({ vaultId: "vault-abc" }));

        expect(router.createUrlTree).toHaveBeenCalledWith([], {
          relativeTo: activatedRoute,
          queryParams: expect.objectContaining({ "vault.vault": "vault-abc" }),
          queryParamsHandling: "merge",
        });
      });

      it("prefers ?vaultId over ?organizationId when both are present", async () => {
        await runGuard(makeRoute({ vaultId: "primary", organizationId: "fallback" }));

        expect(router.createUrlTree).toHaveBeenCalledWith([], {
          relativeTo: activatedRoute,
          queryParams: expect.objectContaining({ "vault.vault": "primary" }),
          queryParamsHandling: "merge",
        });
      });
    });

    describe("search mapping", () => {
      it("maps ?search → ?vault.search", async () => {
        await runGuard(makeRoute({ search: "hello world" }));

        expect(router.createUrlTree).toHaveBeenCalledWith([], {
          relativeTo: activatedRoute,
          queryParams: expect.objectContaining({ "vault.search": "hello world" }),
          queryParamsHandling: "merge",
        });
      });
    });

    describe("legacy key clearing", () => {
      it("clears out all legacy keys", async () => {
        await runGuard(makeRoute({ type: "login" }));

        const { queryParams } = router.createUrlTree.mock.calls[0][1];
        expect(Object.keys(queryParams)).toEqual(["vault.type"]);
      });
    });

    describe("combined params", () => {
      it("converts multiple legacy params in a single redirect", async () => {
        await runGuard(
          makeRoute({
            type: "login",
            folderId: "folder-1",
            search: "amazon",
          }),
        );

        const { queryParams } = router.createUrlTree.mock.calls[0][1];
        expect(queryParams["vault.type"]).toBe(String(CipherType.Login));
        expect(queryParams["vault.folder"]).toBe("folder-1");
        expect(queryParams["vault.search"]).toBe("amazon");
      });

      it("converts type and sharedFolderId together", async () => {
        await runGuard(makeRoute({ type: "card", sharedFolderId: "col-999" }));

        const { queryParams } = router.createUrlTree.mock.calls[0][1];
        expect(queryParams["vault.type"]).toBe(String(CipherType.Card));
        expect(queryParams["vault.sharedFolder"]).toBe("col-999");
      });

      it("passes relativeTo and queryParamsHandling correctly", async () => {
        await runGuard(makeRoute({ search: "test" }));

        expect(router.createUrlTree).toHaveBeenCalledWith([], {
          relativeTo: activatedRoute,
          queryParams: expect.any(Object),
          queryParamsHandling: "merge",
        });
      });
    });
  });
});
