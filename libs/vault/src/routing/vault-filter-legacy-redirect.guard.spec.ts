import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  createUrlTreeFromSnapshot,
} from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

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

  const state = mock<RouterStateSnapshot>();
  const mockUrlTree = mock<UrlTree>();

  function makeRoute(queryParams: Record<string, string>): ActivatedRouteSnapshot {
    return mock<ActivatedRouteSnapshot>({ queryParamMap: convertToParamMap(queryParams) });
  }

  function runGuard(route: ActivatedRouteSnapshot) {
    return TestBed.runInInjectionContext(() => vaultFilterLegacyRedirectGuard(route, state));
  }

  beforeEach(() => {
    configService = mock<ConfigService>();
    jest.mocked(createUrlTreeFromSnapshot).mockReturnValue(mockUrlTree);

    TestBed.configureTestingModule({
      providers: [{ provide: ConfigService, useValue: configService }],
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

      it("returns true without redirecting for unmapped types like ?type=trash", async () => {
        expect(await runGuard(makeRoute({ type: "trash" }))).toBe(true);
        expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
      });

      it("returns true without redirecting for unmapped types like ?type=archive", async () => {
        expect(await runGuard(makeRoute({ type: "archive" }))).toBe(true);
        expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
      });
    });

    describe("folder mapping", () => {
      it("maps ?folderId → ?vault.folder", async () => {
        await runGuard(makeRoute({ folderId: "folder-abc" }));

        const [, , queryParams] = jest.mocked(createUrlTreeFromSnapshot).mock.calls[0];
        expect(queryParams).toEqual(expect.objectContaining({ "vault.folder": "folder-abc" }));
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
