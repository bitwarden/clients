import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  createUrlTreeFromSnapshot,
} from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { Unassigned } from "@bitwarden/common/admin-console/models/collections";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";

import { vaultFilterLegacyRedirectGuard } from "./vault-filter-legacy-redirect.guard";

jest.mock("@angular/router", () => ({
  ...jest.requireActual("@angular/router"),
  createUrlTreeFromSnapshot: jest.fn(),
}));

describe("vaultFilterLegacyRedirectGuard", () => {
  let configService: MockProxy<ConfigService>;
  let router: MockProxy<Router>;

  const state = mock<RouterStateSnapshot>();
  const mockUrlTree = mock<UrlTree>();
  const mockScopeUrlTree = mock<UrlTree>();

  function makeRoute(queryParams: Record<string, string | string[]>): ActivatedRouteSnapshot {
    // The param map is assigned after construction rather than passed as a partial:
    // jest-mock-extended wraps nested values in proxies, which mangles array-valued params.
    const route = mock<ActivatedRouteSnapshot>();
    Object.assign(route, { queryParamMap: convertToParamMap(queryParams) });
    return route;
  }

  function runGuard(route: ActivatedRouteSnapshot) {
    return TestBed.runInInjectionContext(() => vaultFilterLegacyRedirectGuard(route, state));
  }

  beforeEach(() => {
    configService = mock<ConfigService>();
    router = mock<Router>();
    router.createUrlTree.mockReturnValue(mockScopeUrlTree);
    jest.mocked(createUrlTreeFromSnapshot).mockReturnValue(mockUrlTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: Router, useValue: router },
      ],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("when VFO1Foundation is disabled", () => {
    beforeEach(() => {
      configService.getFeatureFlag.mockResolvedValue(false);
    });

    it("returns true without redirecting", async () => {
      const result = await runGuard(makeRoute({ type: "login" }));

      expect(result).toBe(true);
      expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
    });

    it("returns true without redirecting a scope type", async () => {
      const result = await runGuard(makeRoute({ type: "trash" }));

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
        expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
      });

      it("returns true when only new-style vault.* params are present", async () => {
        // New-style params don't match any legacy key, so no redirect is needed.
        expect(await runGuard(makeRoute({ "vault.type": "1" }))).toBe(true);
        expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
      });
    });

    describe("redirect", () => {
      it("returns the UrlTree from createUrlTreeFromSnapshot", async () => {
        expect(await runGuard(makeRoute({ type: "login" }))).toBe(mockUrlTree);
      });

      it("calls createUrlTreeFromSnapshot with the route snapshot and empty commands", async () => {
        const route = makeRoute({ type: "login" });
        await runGuard(route);

        expect(createUrlTreeFromSnapshot).toHaveBeenCalledWith(route, [], expect.any(Object));
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

          const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
          expect(queryParams).toEqual(
            expect.objectContaining({ "vault.type": String(cipherType) }),
          );
        });
      });

      it("maps ?type=favorites → ?vault.favorites=true", async () => {
        await runGuard(makeRoute({ type: "favorites" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(expect.objectContaining({ "vault.favorites": "true" }));
      });

      it("returns true without redirecting for unmapped types like ?type=all", async () => {
        expect(await runGuard(makeRoute({ type: "all" }))).toBe(true);
        expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
        expect(router.createUrlTree).not.toHaveBeenCalled();
      });

      it("returns true without redirecting for ?sharedFolderId=all (no filter needed)", async () => {
        expect(await runGuard(makeRoute({ sharedFolderId: "all" }))).toBe(true);
        expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
      });
    });

    describe("scope mapping", () => {
      const SCOPE_CASES: [string, string][] = [
        ["trash", "trash"],
        ["archive", "archive"],
      ];

      SCOPE_CASES.forEach(([legacyType, segment]) => {
        it(`redirects ?type=${legacyType} → /vault/${segment}`, async () => {
          expect(await runGuard(makeRoute({ type: legacyType }))).toBe(mockScopeUrlTree);

          expect(router.createUrlTree).toHaveBeenCalledWith(
            ["/vault", segment],
            expect.any(Object),
          );
        });

        it(`strips ?type=${legacyType} from the redirect`, async () => {
          await runGuard(makeRoute({ type: legacyType }));

          const [, options] = router.createUrlTree.mock.calls[0];
          expect(options?.queryParams?.["type"]).toBeUndefined();
        });
      });

      it("does not build a param-only redirect for a scope type", async () => {
        await runGuard(makeRoute({ type: "trash" }));

        expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
      });

      it("carries the other converted filters onto the scope route", async () => {
        await runGuard(makeRoute({ type: "trash", vaultId: "org-123", search: "amazon" }));

        const [, options] = router.createUrlTree.mock.calls[0];
        expect(options?.queryParams).toEqual({
          "vault.vault": "org-123",
          "vault.search": "amazon",
        });
      });

      it("preserves non-legacy params on the scope route", async () => {
        await runGuard(makeRoute({ type: "archive", cipherId: "cipher-1", action: "view" }));

        const [, options] = router.createUrlTree.mock.calls[0];
        expect(options?.queryParams).toEqual({ cipherId: "cipher-1", action: "view" });
      });
    });

    describe("folder mapping", () => {
      it("maps ?folderId → ?vault.folder", async () => {
        await runGuard(makeRoute({ folderId: "folder-abc" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(expect.objectContaining({ "vault.folder": "folder-abc" }));
      });

      it("maps ?folderId=unassigned → ?vault.folder=noFolder", async () => {
        await runGuard(makeRoute({ folderId: Unassigned }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(expect.objectContaining({ "vault.folder": "noFolder" }));
      });
    });

    describe("shared folder mapping", () => {
      it("maps ?sharedFolderId → ?vault.sharedFolder", async () => {
        await runGuard(makeRoute({ sharedFolderId: "col-123" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(expect.objectContaining({ "vault.sharedFolder": "col-123" }));
      });

      it("maps ?collectionId → ?vault.sharedFolder", async () => {
        await runGuard(makeRoute({ collectionId: "col-456" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(expect.objectContaining({ "vault.sharedFolder": "col-456" }));
      });

      it("prefers ?sharedFolderId over ?collectionId when both are present", async () => {
        await runGuard(makeRoute({ sharedFolderId: "primary", collectionId: "fallback" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(expect.objectContaining({ "vault.sharedFolder": "primary" }));
      });

      it("omits vault.sharedFolder when ?sharedFolderId=all (means no filter)", async () => {
        await runGuard(makeRoute({ sharedFolderId: "all", organizationId: "org-123" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams?.["vault.sharedFolder"]).toBeUndefined();
      });
    });

    describe("vault (organization) mapping", () => {
      it("maps ?organizationId → ?vault.vault", async () => {
        await runGuard(makeRoute({ organizationId: "org-abc" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(expect.objectContaining({ "vault.vault": "org-abc" }));
      });

      it("maps ?vaultId → ?vault.vault", async () => {
        await runGuard(makeRoute({ vaultId: "vault-abc" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(expect.objectContaining({ "vault.vault": "vault-abc" }));
      });

      it("prefers ?vaultId over ?organizationId when both are present", async () => {
        await runGuard(makeRoute({ vaultId: "primary", organizationId: "fallback" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(expect.objectContaining({ "vault.vault": "primary" }));
      });

      it("maps ?vaultId=unassigned → ?vault.vault=myVault", async () => {
        await runGuard(makeRoute({ vaultId: Unassigned }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(expect.objectContaining({ "vault.vault": "myVault" }));
      });

      it("maps ?organizationId=unassigned → ?vault.vault=myVault", async () => {
        await runGuard(makeRoute({ organizationId: Unassigned }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(expect.objectContaining({ "vault.vault": "myVault" }));
      });
    });

    describe("search mapping", () => {
      it("maps ?search → ?vault.search", async () => {
        await runGuard(makeRoute({ search: "hello world" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(expect.objectContaining({ "vault.search": "hello world" }));
      });
    });

    describe("legacy key stripping", () => {
      it("strips all legacy keys from the redirect URL", async () => {
        await runGuard(makeRoute({ type: "login" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(Object.keys(queryParams ?? {})).toEqual(["vault.type"]);
      });

      it("preserves non-legacy params like cipherId and action", async () => {
        await runGuard(makeRoute({ type: "login", cipherId: "cipher-abc", action: "add" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(
          expect.objectContaining({
            cipherId: "cipher-abc",
            action: "add",
            "vault.type": String(CipherType.Login),
          }),
        );
        expect(queryParams?.["type"]).toBeUndefined();
      });

      it("preserves every value of a repeated non-legacy param", async () => {
        await runGuard(makeRoute({ folderId: "folder-1", "vault.sharedFolder": ["a", "b"] }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual({
          "vault.sharedFolder": ["a", "b"],
          "vault.folder": "folder-1",
        });
      });

      it("preserves a single-valued non-legacy param as a string", async () => {
        await runGuard(makeRoute({ folderId: "folder-1", "vault.sharedFolder": ["a"] }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams?.["vault.sharedFolder"]).toBe("a");
      });
    });

    describe("untranslatable type combined with other redirectable params", () => {
      it("preserves type=all in the redirect when combined with vaultId", async () => {
        await runGuard(makeRoute({ vaultId: "org-123", type: "all" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(
          expect.objectContaining({ "vault.vault": "org-123", type: "all" }),
        );
      });

      it("still strips type when it was translated", async () => {
        await runGuard(makeRoute({ vaultId: "org-123", type: "login" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams?.["type"]).toBeUndefined();
        expect(queryParams?.["vault.type"]).toBe(String(CipherType.Login));
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

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams?.["vault.type"]).toBe(String(CipherType.Login));
        expect(queryParams?.["vault.folder"]).toBe("folder-1");
        expect(queryParams?.["vault.search"]).toBe("amazon");
      });

      it("converts type and sharedFolderId together", async () => {
        await runGuard(makeRoute({ type: "card", sharedFolderId: "col-999" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams?.["vault.type"]).toBe(String(CipherType.Card));
        expect(queryParams?.["vault.sharedFolder"]).toBe("col-999");
      });
    });
  });
});
